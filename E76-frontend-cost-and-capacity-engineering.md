# E76 — A cost and capacity model you can change

> Runnable code for [76 — Frontend Cost and Capacity Engineering](76-frontend-cost-and-capacity-engineering.md). 3 tests.

The chapter's monthly cost model for a server-rendered storefront, with the baseline and optimised scenarios behind its tables. The tests print each month's breakdown and check the conclusions: which lever matters most, and how the cache hit ratio drives origin load.

`npm run bench:ssr` repeats the `renderToString` measurement from section 4 (a 500-row page). Expect different absolute numbers on your machine; the point is the order of magnitude. `bench/load.mjs` is the load test from the same section; it needs a running production server and Linux.

The prices in `ASSUMED_PRICES` are illustrative, not quotes: put your provider's in before using the numbers.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 76    # writes examples/76-frontend-cost-and-capacity-engineering/
cd examples/76-frontend-cost-and-capacity-engineering
npm ci
npm test
npm run bench:ssr
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/cost-model.mjs` | 76, "2. A cost model you can run" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/cost-model.mjs`

```js
// ── From chapter 76, "2. A cost model you can run" ──
// cost-model.mjs: a monthly cost and capacity model for a server-rendered storefront.
// Unit prices are ILLUSTRATIVE ASSUMPTIONS, not quotes: replace them with your own contracts.
export const ASSUMED_PRICES = {
  cdnEgressPerGB: 0.05,
  cdnRequestsPerMillion: 0.75,
  vcpuHour: 0.05,
  rumEventsPerMillion: 2.0,
  replaySessionsPerThousand: 3.0,
  logsPerGB: 0.5,
};

const HOURS_PER_MONTH = 730, SECONDS_PER_MONTH = 30 * 86_400;

export function model(s, price = ASSUMED_PRICES) {
  const avgViewsPerSecond = s.pageViews / SECONDS_PER_MONTH;
  const peakViewsPerSecond = avgViewsPerSecond * s.peakToAverage;
  const renders = s.pageViews * (1 - s.htmlHitRatio);                 // cache misses reach the origin
  const peakRendersPerSecond = peakViewsPerSecond * (1 - s.htmlHitRatio);
  // Little's law: busy vCPUs = arrival rate × CPU time per request. Provision for peak, with headroom.
  const peakBusyVcpus = peakRendersPerSecond * (s.cpuMsPerRender / 1000);
  const provisionedVcpus = Math.max(s.minVcpus, Math.ceil(peakBusyVcpus * s.headroom));
  const cost = {
    cdnEgress: (s.pageViews * s.mbPerView / 1000) * price.cdnEgressPerGB,
    cdnRequests: (s.pageViews * s.requestsPerView / 1e6) * price.cdnRequestsPerMillion,
    origin: provisionedVcpus * HOURS_PER_MONTH * price.vcpuHour,
    rum: (s.pageViews * s.rumEventsPerView / 1e6) * price.rumEventsPerMillion,
    replay: (s.sessions * s.replaySampleRate / 1000) * price.replaySessionsPerThousand,
    logs: (renders / 1e6) * s.logGBPerMillionRenders * price.logsPerGB,
  };
  const total = Object.values(cost).reduce((a, b) => a + b, 0);
  return { avgViewsPerSecond, peakViewsPerSecond, peakRendersPerSecond, peakBusyVcpus, provisionedVcpus, cost, total };
}

// ── Companion code (not in the chapter) ──
export const BASELINE = {
  pageViews: 300e6, sessions: 100e6, peakToAverage: 3,
  mbPerView: 1.0, requestsPerView: 45, htmlHitRatio: 0.95,
  cpuMsPerRender: 40, headroom: 2, minVcpus: 4,
  rumEventsPerView: 6, replaySampleRate: 0.10, logGBPerMillionRenders: 2,
};

export const OPTIMIZED = {
  ...BASELINE,
  mbPerView: 0.65,              // modern image formats, right-sized images, fewer and smaller scripts
  requestsPerView: 30,
  htmlHitRatio: 0.99,           // tag-based invalidation instead of short TTLs
  rumEventsPerView: 2.5,        // Web Vitals for everyone; other events sampled
  replaySampleRate: 0.01,       // plus sessions with errors, captured on demand
};
```

### `test/cost-model.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, OPTIMIZED, model } from '../src/cost-model.mjs';

const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const show = (name, r) => console.log(`${name}: total ${usd(r.total)} | ${Object.entries(r.cost).map(([k, v]) => `${k} ${usd(v)}`).join(', ')} | peak renders/s ${r.peakRendersPerSecond.toFixed(1)}, busy vCPU ${r.peakBusyVcpus.toFixed(2)}, provisioned ${r.provisionedVcpus}`);

test('baseline versus optimized month', () => {
  const a = model(BASELINE), b = model(OPTIMIZED);
  show('baseline', a); show('optimized', b);
  console.log(`avg views/s ${a.avgViewsPerSecond.toFixed(1)}, peak views/s ${a.peakViewsPerSecond.toFixed(1)}; saving ${usd(a.total - b.total)} (${((1 - b.total / a.total) * 100).toFixed(0)}%)`);
  assert.ok(b.total < a.total);
});

test('cache hit ratio drives origin load: 95% vs 99% vs a full purge at peak', () => {
  for (const hit of [0.95, 0.99, 0]) {
    const r = model({ ...BASELINE, htmlHitRatio: hit });
    console.log(`hit ratio ${hit}: peak origin renders/s ${r.peakRendersPerSecond.toFixed(1)}, busy vCPUs ${r.peakBusyVcpus.toFixed(2)}`);
  }
  assert.ok(Math.abs(model({ ...BASELINE, htmlHitRatio: 0 }).peakBusyVcpus / model(BASELINE).peakBusyVcpus - 20) < 1e-9); // 1 / (1 - 0.95)
});

test('which lever matters most: each change on its own', () => {
  const base = model(BASELINE).total;
  for (const [k, v] of Object.entries(OPTIMIZED)) {
    if (BASELINE[k] === v) continue;
    const r = model({ ...BASELINE, [k]: v });
    console.log(`only ${k} = ${v}: saves ${usd(base - r.total)}`);
  }
});
```

### `bench/load.mjs`

```js
// The full version of the excerpt in section 4. Linux only: it reads server CPU time from /proc.
// Usage: start a production server (next start), then: node bench/load.mjs http://localhost:3000/some/route 16 10
// load.mjs: closed-loop load test; reports throughput, latency and server CPU time per request
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const [url, concurrency = '16', seconds = '10'] = process.argv.slice(2);
const pids = execSync(`pgrep -f "next-server|next start" || true`).toString().trim().split('\n').filter(Boolean);
const cpuTicks = () => pids.reduce((n, pid) => { try { const f = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return n + +f[11] + +f[12]; } catch { return n; } }, 0);
const latencies = []; let errors = 0; const end = Date.now() + +seconds * 1000;
const before = cpuTicks(), t0 = Date.now();
await Promise.all(Array.from({ length: +concurrency }, async () => {
  while (Date.now() < end) {
    const t = performance.now();
    try { const r = await fetch(url); await r.arrayBuffer(); if (!r.ok) errors++; } catch { errors++; }
    latencies.push(performance.now() - t);
  }
}));
const elapsed = (Date.now() - t0) / 1000, cpuSeconds = (cpuTicks() - before) / 100;   // 100 ticks per second on Linux
latencies.sort((a, b) => a - b);
const q = (p) => latencies[Math.floor(latencies.length * p)].toFixed(1);
console.log(JSON.stringify({ url: url.replace(/^https?:\/\/[^/]+/, ''), concurrency: +concurrency, rps: Math.round(latencies.length / elapsed), p50ms: q(0.5), p95ms: q(0.95), errors, serverCpuMsPerRequest: (cpuSeconds * 1000 / latencies.length).toFixed(2), pids: pids.length }));
```

### `bench/ssr-bench.mjs`

```js
// ssr-bench.mjs: server CPU time to render a realistic page with React 19.3 (renderToString), median of many runs
import React from 'react';
import { renderToString } from 'react-dom/server';
const h = React.createElement;

const rows = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `User ${i}`, email: `user${i}@acme.test`, role: ['admin', 'editor', 'viewer'][i % 3] }));
const Row = ({ u }) => h('tr', null, h('td', null, u.name), h('td', null, u.email), h('td', null, u.role));
const Page = () => h('html', null, h('body', null, h('main', null, h('h1', null, 'Users'),
  h('table', null, h('tbody', null, rows.map((u) => h(Row, { key: u.id, u })))))));

for (let i = 0; i < 50; i++) renderToString(h(Page));                  // warm up the JIT
const times = [];
for (let i = 0; i < 300; i++) { const t = process.hrtime.bigint(); const html = renderToString(h(Page)); times.push(Number(process.hrtime.bigint() - t) / 1e6); if (i === 0) console.log('html bytes', html.length); }
times.sort((a, b) => a - b);
console.log(`renderToString, 500-row page: median ${times[150].toFixed(2)} ms, p95 ${times[284].toFixed(2)} ms (React ${React.version}, Node ${process.version})`);
```

### `package.json`

```json
{
  "name": "handbook-76-frontend-cost-and-capacity-engineering",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.mjs\"",
    "bench:ssr": "node bench/ssr-bench.mjs"
  },
  "devDependencies": {
    "react": "19.3.1",
    "react-dom": "19.3.1"
  }
}
```

---

[← Previous: E75 — Experiment arithmetic: assignment, sample sizes, SRM and peeking](E75-experimentation-and-product-analytics.md) · [Chapter 76](76-frontend-cost-and-capacity-engineering.md) · [Index](README.md) · [Next: E78 — The Prism business case, as a model →](E78-business-cases-and-investment-arguments.md)
