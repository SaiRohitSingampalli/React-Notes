#!/usr/bin/env node
// extract-examples.mjs: turn the handbook's example pages (E03 to E79) back into runnable projects.
//
//   node extract-examples.mjs                   every example, into ./examples/
//   node extract-examples.mjs 33 74             only the examples whose number starts with these
//   node extract-examples.mjs --out <dir>       write somewhere else
//   node extract-examples.mjs --run [33 74]     extract, then clean-install, test, type-check and build each one
//
// No dependencies; Node 22.18 or newer. Each example page lists a project's files under "## Files": a
// "### `path`" heading, then one fenced block holding the file. Exact lockfiles come from examples.lock.json.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  const usage = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7);
  console.log(usage.map((line) => line.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const runAfter = args.includes('--run');
const outAt = args.indexOf('--out');
if (outAt >= 0 && !args[outAt + 1]) { console.error('--out needs a directory'); process.exit(2); }
const out = resolve(outAt >= 0 ? args[outAt + 1] : join(here, 'examples'));
const skip = new Set(outAt >= 0 ? [outAt, outAt + 1] : []);
const prefixes = args.filter((arg, i) => !skip.has(i) && !arg.startsWith('--'));

const pages = readdirSync(here)
  .filter((f) => /^E\d\d-.+\.md$/.test(f) && !f.startsWith('E00-'))
  .filter((f) => prefixes.length === 0 || prefixes.some((p) => f.slice(1).startsWith(p)))
  .sort();
if (pages.length === 0) { console.error(`No example matches ${prefixes.join(' ')}`); process.exit(2); }
const locks = JSON.parse(readFileSync(join(here, 'examples.lock.json'), 'utf8'));

/** The files listed under "## Files": a "### `path`" heading, then a fenced block. */
function filesOf(page, markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.indexOf('## Files');
  if (start < 0) throw new Error(`${page}: no "## Files" section`);
  const files = [];
  let path = null;
  for (let i = start + 1; i < lines.length; i++) {
    const heading = /^### `([^`]+)`$/.exec(lines[i]);
    if (heading) { path = heading[1]; continue; }
    const open = /^(`{3,})([\w.+-]*)$/.exec(lines[i]);
    if (!open || !path) continue;
    const body = [];
    for (i++; i < lines.length && lines[i] !== open[1]; i++) body.push(lines[i]);
    if (i >= lines.length) throw new Error(`${page}: the block for ${path} is never closed`);
    files.push({ path, binary: open[2] === 'base64', text: body.join('\n') + '\n' });
    path = null;
  }
  return files;
}

const folders = [];
for (const page of pages) {
  const name = page.slice(1, -3);                                  // E33-api-….md → 33-api-…
  const dir = join(out, name);
  const markdown = readFileSync(join(here, page), 'utf8');
  for (const file of filesOf(page, markdown)) {
    const target = resolve(dir, file.path);
    if (!target.startsWith(dir + sep)) throw new Error(`${page}: ${file.path} is outside the project`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.binary ? Buffer.from(file.text.replace(/\s+/g, ''), 'base64') : file.text);
  }
  if (locks[name]) writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(locks[name], null, 2) + '\n');
  // The page's explanation, before the file listing, becomes the project's README (links to pages become plain text)
  const intro = markdown.slice(0, markdown.indexOf('\n## Files')).replace(/\[([^\]]+)\]\([^)\s]+\.md(#[^)]*)?\)/g, '$1');
  writeFileSync(join(dir, 'README.md'), `${intro.trimEnd()}\n\n_Extracted from \`${page}\` in the handbook._\n`);
  folders.push({ name, dir });
  console.log(`wrote ${relative(process.cwd(), dir) || '.'}${sep}`);
}

if (runAfter) {
  let failed = 0;
  for (const { name, dir } of folders) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const steps = [];
    if ((pkg.dependencies || pkg.devDependencies) && existsSync(join(dir, 'package-lock.json'))) steps.push(['ci', '--no-audit', '--no-fund']);
    steps.push(['test']);
    for (const script of ['typecheck', 'build']) if (pkg.scripts?.[script]) steps.push(['run', script]);
    if (process.stdout.isTTY) process.stdout.write(`…     ${name}\r`);
    const log = [];
    let status = 'ok';
    for (const step of steps) {
      const r = spawnSync('npm', step, { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024 });
      log.push(`$ npm ${step.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`);
      if (r.status !== 0) { status = `npm ${step.slice(0, 2).join(' ').replace(' --no-audit', '')} failed`; break; }
    }
    writeFileSync(join(dir, 'run.log'), log.join('\n'));
    if (status === 'ok') console.log(`ok    ${name}`);
    else { failed++; console.log(`FAIL  ${name}: ${status} (see ${relative(process.cwd(), join(dir, 'run.log'))})`); }
  }
  console.log(`${folders.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
