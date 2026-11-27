# E43 — Safe URLs and safe inline state

> Runnable code for [43 — Frontend Security Architecture](43-frontend-security-architecture.md). 6 tests.

`safeUrl` allows only `https`, `http`, `mailto` and `tel` URLs, keeps relative URLs relative, and runs on the server. `serializeForScript` embeds state in an inline `<script>` without letting it break out.

The tests try the usual disguises: mixed case, tabs and newlines inside the scheme, leading control characters, and `data:` and `vbscript:` URLs. The serializer's output is parsed back both as JSON and as JavaScript.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 43    # writes examples/43-frontend-security-architecture/
cd examples/43-frontend-security-architecture
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/shared/security/safe-url.ts` | 43, "2.2 Safe HTML and safe URLs" |
| `src/shared/security/serialize-for-script.ts` | 43, "2.2 Safe HTML and safe URLs" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/shared/security/safe-url.ts`

```ts
// shared/security/safe-url.ts: for any URL that came from users, CMS content or query strings
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);
const PARSE_BASE = 'https://relative.invalid'; // only for parsing; never part of the result

/** The URL if its scheme is safe, else undefined. Relative URLs stay relative. Safe to call on the server. */
export function safeUrl(input: string): string | undefined {
  const value = input.trim();
  try {
    const url = new URL(value, PARSE_BASE);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return undefined;
    return url.origin === PARSE_BASE ? value : url.href;
  } catch {
    return undefined;
  }
}
```

### `src/shared/security/serialize-for-script.ts`

```ts
// Serialising state into an inline <script> during SSR: prevent "</script>" breakouts
export function serializeForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
```

### `test/safe-url.test.ts`

```ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../src/shared/security/safe-url.ts';

test('runs without window: safe to call during server rendering', () => {
  assert.equal(typeof (globalThis as { window?: unknown }).window, 'undefined');
  assert.equal(safeUrl('/pricing'), '/pricing');
});

test('keeps relative URLs relative, and normalises absolute ones', () => {
  assert.equal(safeUrl('/pricing?plan=pro#faq'), '/pricing?plan=pro#faq');
  assert.equal(safeUrl('docs/getting-started'), 'docs/getting-started');
  assert.equal(safeUrl(' https://acme.test/a b '), 'https://acme.test/a%20b');
  assert.equal(safeUrl('mailto:help@acme.test'), 'mailto:help@acme.test');
  assert.equal(safeUrl('tel:+441234567890'), 'tel:+441234567890');
});

test('blocks script-capable and unknown schemes, however they are disguised', () => {
  for (const bad of [
    'javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
    '\u0000javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd',
  ]) assert.equal(safeUrl(bad), undefined, JSON.stringify(bad));
});

test('protocol-relative URLs resolve as absolute https URLs and are allowed', () => {
  assert.equal(safeUrl('//cdn.acme.test/logo.svg'), 'https://cdn.acme.test/logo.svg');
});
```

### `test/serialize-for-script.test.ts`

```ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { serializeForScript } from '../src/shared/security/serialize-for-script.ts';

const hostile = { name: '</script><script>alert(1)</script>', note: '<!-- x', separators: 'a\u2028b\u2029c' };

test('the output cannot close the script element or open an HTML comment', () => {
  const out = serializeForScript(hostile);
  assert.equal(out.includes('<'), false);
});

test('it round-trips through JSON.parse and through a JavaScript parser', () => {
  const out = serializeForScript(hostile);
  assert.deepEqual(JSON.parse(out), hostile);
  assert.deepEqual(vm.runInThisContext(`(${out})`), hostile);
});
```

### `package.json`

```json
{
  "name": "handbook-43-frontend-security-architecture",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.ts\"",
    "typecheck": "tsc"
  },
  "devDependencies": {
    "@types/node": "22.20.6",
    "typescript": "6.0.3"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noUncheckedIndexedAccess": false,
    "lib": [
      "es2024",
      "dom",
      "dom.iterable"
    ],
    "types": [
      "node"
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src",
    "test"
  ]
}
```

---

[← Previous: E40 — A client-side circuit breaker](E40-resilience-and-reliability.md) · [Chapter 43](43-frontend-security-architecture.md) · [Index](README.md) · [Next: E45 — An authorization policy and its test matrix →](E45-authentication-and-authorization.md)
