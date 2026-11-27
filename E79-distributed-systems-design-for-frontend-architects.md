# E79 — Token buckets and consistent hashing

> Runnable code for [79 — Distributed Systems Design for Frontend Architects](79-distributed-systems-design-for-frontend-architects.md). 3 tests.

The chapter's token bucket (with the retry hint a 429 response should carry) and consistent hashing ring with virtual nodes. The tests show the burst-then-refill behaviour, that adding a fifth server moves about a fifth of keys with a ring but most keys with modulo hashing, and that virtual nodes even out the load.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 79    # writes examples/79-distributed-systems-design-for-frontend-architects/
cd examples/79-distributed-systems-design-for-frontend-architects
npm test
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/dist.mjs` | 79, "7. Rate limiting" |
| `src/dist.mjs` | 79, "5. Partitioning and consistent hashing" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The project has no dependencies, so there is no lockfile and nothing to install.

### `src/dist.mjs`

```js
// ── Companion code (not in the chapter) ──
// dist.mjs: two building blocks that come up in every general system-design round

// ── From chapter 79, "7. Rate limiting" ──
/** Token bucket: bursts up to `capacity`, refilled at `ratePerSecond`. `now` is injectable for tests. */
export class TokenBucket {
  constructor(capacity, ratePerSecond, now = () => performance.now()) {
    Object.assign(this, { capacity, ratePerSecond, now, tokens: capacity, last: now() });
  }
  tryTake(cost = 1) {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.ratePerSecond);
    this.last = t;
    if (this.tokens < cost) return { allowed: false, retryAfterMs: Math.ceil(((cost - this.tokens) / this.ratePerSecond) * 1000) };
    this.tokens -= cost;
    return { allowed: true, retryAfterMs: 0 };
  }
}

// ── Companion code (not in the chapter) ──
/** FNV-1a with murmur3's finalizer (see chapter 75 for why the finalizer matters). */
export function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

// ── From chapter 79, "5. Partitioning and consistent hashing" ──
/** Consistent hashing ring with virtual nodes. */
export class Ring {
  constructor(nodes, vnodes = 100) { this.vnodes = vnodes; this.points = []; nodes.forEach((n) => this.add(n)); }
  add(node) {
    for (let v = 0; v < this.vnodes; v++) this.points.push({ at: hash32(`${node}#${v}`), node });
    this.points.sort((a, b) => a.at - b.at);
  }
  nodeFor(key) {
    const h = hash32(key);
    let lo = 0, hi = this.points.length;                              // first point at or after the key's hash
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.points[mid].at < h) lo = mid + 1; else hi = mid; }
    return this.points[lo % this.points.length].node;
  }
}

// ── Companion code (not in the chapter) ──
/** The naive alternative: hash modulo the number of nodes. */
export const moduloNode = (key, nodes) => nodes[hash32(key) % nodes.length];
```

### `test/dist.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ring, TokenBucket, moduloNode } from '../src/dist.mjs';

test('token bucket: a burst up to capacity, then the refill rate, with a retry hint', () => {
  let t = 0;
  const bucket = new TokenBucket(10, 5, () => t);                     // 10-request burst, 5 requests per second
  const burst = Array.from({ length: 12 }, () => bucket.tryTake().allowed);
  assert.deepEqual(burst.filter(Boolean).length, 10);
  const denied = bucket.tryTake();
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 200);                             // one token every 200 ms
  t = 1000;                                                           // one second later: 5 tokens back
  assert.equal(Array.from({ length: 6 }, () => bucket.tryTake().allowed).filter(Boolean).length, 5);
  t = 60_000;                                                         // a long idle period never exceeds capacity
  assert.equal(Array.from({ length: 20 }, () => bucket.tryTake().allowed).filter(Boolean).length, 10);
});

test('adding a fifth server: consistent hashing moves about a fifth of keys; modulo moves most', () => {
  const keys = Array.from({ length: 100_000 }, (_, i) => `session:${i}`);
  const four = ['a', 'b', 'c', 'd'], five = [...four, 'e'];
  const ring4 = new Ring(four), ring5 = new Ring(five);
  const movedRing = keys.filter((k) => ring4.nodeFor(k) !== ring5.nodeFor(k)).length / keys.length;
  const movedModulo = keys.filter((k) => moduloNode(k, four) !== moduloNode(k, five)).length / keys.length;
  const load = {}; for (const k of keys) load[ring5.nodeFor(k)] = (load[ring5.nodeFor(k)] ?? 0) + 1;
  const shares = Object.values(load).map((n) => n / keys.length);
  console.log(`moved: ring ${(movedRing * 100).toFixed(1)}%, modulo ${(movedModulo * 100).toFixed(1)}%; ring load per node ${shares.map((s) => (s * 100).toFixed(1) + '%').join(' ')}`);
  assert.ok(movedRing < 0.25 && movedModulo > 0.7);
  for (const s of shares) assert.ok(Math.abs(s - 0.2) < 0.04);
});

test('virtual nodes even out the load', () => {
  const keys = Array.from({ length: 100_000 }, (_, i) => `k${i}`);
  for (const v of [1, 10, 100]) {
    const ring = new Ring(['a', 'b', 'c', 'd', 'e'], v), load = {};
    for (const k of keys) load[ring.nodeFor(k)] = (load[ring.nodeFor(k)] ?? 0) + 1;
    const max = Math.max(...Object.values(load)) / keys.length, min = Math.min(...Object.values(load)) / keys.length;
    console.log(`vnodes ${v}: busiest node ${(max * 100).toFixed(1)}%, quietest ${(min * 100).toFixed(1)}%`);
  }
});
```

### `package.json`

```json
{
  "name": "handbook-79-distributed-systems-design-for-frontend-architects",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.mjs\""
  }
}
```

---

[← Previous: E78 — The Prism business case, as a model](E78-business-cases-and-investment-arguments.md) · [Chapter 79](79-distributed-systems-design-for-frontend-architects.md) · [Index](README.md) · [Back to the start: E00 — Running the Examples →](E00-running-the-examples.md)
