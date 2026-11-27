# E40 — A client-side circuit breaker

> Runnable code for [40 — Resilience and Reliability Engineering](40-resilience-and-reliability.md). 7 tests.

The chapter's breaker: closed, open and half-open states, a single probe after the cooldown, and a classifier that decides which errors mean the dependency is unhealthy. Timeouts, network failures and 5xx responses count; aborts and 4xx responses don't.

The tests are black-box: they check whether the breaker lets a call through, not its private state. One of them reproduces the earlier bug, where three aborted requests (three quick navigations away) opened the breaker.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 40    # writes examples/40-resilience-and-reliability/
cd examples/40-resilience-and-reliability
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/shared/resilience/circuit-breaker.ts` | 40, "4.2 A client-side circuit breaker" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/shared/resilience/circuit-breaker.ts`

```ts
// shared/resilience/circuit-breaker.ts
type BreakerState = 'closed' | 'open' | 'half-open';
/** Does this error say the dependency is unhealthy? Aborts and client errors don't. */
export const isTransientFailure = (error: unknown): boolean => {
  if (error instanceof DOMException) return error.name === 'TimeoutError';           // AbortError: the caller gave up
  if (error instanceof TypeError) return true;                                       // fetch's network failure
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 500;
};

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly isFailure: (error: unknown) => boolean;

  constructor(threshold = 5, cooldownMs = 30_000, isFailure = isTransientFailure) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.isFailure = isFailure;
  }

  async run<T>(call: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.cooldownMs) return fallback(); // fail fast
      this.state = 'half-open';                                             // this call is the probe
    } else if (this.state === 'half-open') {
      return fallback();                                                    // a probe is already in flight
    }
    try {
      const result = await call();
      this.state = 'closed';
      this.failures = 0;
      return result;
    } catch (error) {
      if (this.isFailure(error)) {
        this.failures += 1;
        if (this.state === 'half-open' || this.failures >= this.threshold) {
          this.state = 'open';
          this.openedAt = Date.now();
        }
      } else if (this.state === 'half-open') {
        this.state = 'open';                                                // an aborted probe proves nothing: probe again next call
      }
      return fallback();
    }
  }
}
```

### `test/circuit-breaker.test.ts`

```ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, isTransientFailure } from '../src/shared/resilience/circuit-breaker.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const aborted = () => Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
const timedOut = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
const status = (code: number) => () => Promise.reject(Object.assign(new Error(`HTTP ${code}`), { status: code }));
const fallback = () => 'fallback';

// Wrap a call so we can see whether the breaker let it through
function spy<T>(fn: () => Promise<T>) {
  const s = { calls: 0, fn: () => { s.calls++; return fn(); } };
  return s;
}

test('classifies failures: timeouts, network errors and 5xx count; aborts and 4xx do not', () => {
  assert.equal(isTransientFailure(new DOMException('', 'TimeoutError')), true);
  assert.equal(isTransientFailure(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientFailure({ status: 503 }), true);
  assert.equal(isTransientFailure(new DOMException('', 'AbortError')), false);
  assert.equal(isTransientFailure({ status: 404 }), false);
  assert.equal(isTransientFailure(new Error('no status')), false);
});

test('opens after `threshold` real failures, then fails fast without calling', async () => {
  const breaker = new CircuitBreaker(3, 60_000);
  for (let i = 0; i < 3; i++) assert.equal(await breaker.run(status(502), fallback), 'fallback');
  const live = spy(async () => 'live');
  assert.equal(await breaker.run(live.fn, fallback), 'fallback');
  assert.equal(live.calls, 0);
});

test('navigating away (aborts) and client errors never open it', async () => {
  const breaker = new CircuitBreaker(3, 60_000);
  for (let i = 0; i < 5; i++) await breaker.run(aborted, fallback);
  await breaker.run(status(404), fallback);
  const live = spy(async () => 'live');
  assert.equal(await breaker.run(live.fn, fallback), 'live');
  assert.equal(live.calls, 1);
});

test('after the cooldown, one probe goes through while other calls get the fallback', async () => {
  const breaker = new CircuitBreaker(1, 20);
  await breaker.run(timedOut, fallback);                                     // open
  await sleep(30);
  let release!: (v: string) => void;
  const probe = spy(() => new Promise<string>((resolve) => { release = resolve; }));
  const other = spy(async () => 'other');
  const first = breaker.run(probe.fn, fallback);
  assert.equal(await breaker.run(other.fn, fallback), 'fallback');          // a probe is in flight
  release('recovered');
  assert.equal(await first, 'recovered');
  assert.equal(await breaker.run(other.fn, fallback), 'other');             // closed again
  assert.deepEqual([probe.calls, other.calls], [1, 1]);
});

test('an aborted probe proves nothing, so the next call probes again', async () => {
  const breaker = new CircuitBreaker(1, 20);
  await breaker.run(status(500), fallback);
  await sleep(30);
  await breaker.run(aborted, fallback);                                      // the probe is aborted
  const live = spy(async () => 'live');
  assert.equal(await breaker.run(live.fn, fallback), 'live');               // not stuck half-open
  assert.equal(live.calls, 1);
});

test('a failed probe re-opens it for another cooldown', async () => {
  const breaker = new CircuitBreaker(1, 20);
  await breaker.run(status(500), fallback);
  await sleep(30);
  await breaker.run(status(503), fallback);                                  // the probe fails
  const live = spy(async () => 'live');
  assert.equal(await breaker.run(live.fn, fallback), 'fallback');
  assert.equal(live.calls, 0);
});

test('a custom classifier can count any error', async () => {
  const breaker = new CircuitBreaker(2, 60_000, () => true);
  await breaker.run(() => Promise.reject(new Error('down')), fallback);
  await breaker.run(() => Promise.reject(new Error('down')), fallback);
  const live = spy(async () => 'live');
  assert.equal(await breaker.run(live.fn, fallback), 'fallback');
  assert.equal(live.calls, 0);
});
```

### `package.json`

```json
{
  "name": "handbook-40-resilience-and-reliability",
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

[← Previous: E37 — Cached Intl formatters and correct money](E37-internationalization-and-localization.md) · [Chapter 40](40-resilience-and-reliability.md) · [Index](README.md) · [Next: E43 — Safe URLs and safe inline state →](E43-frontend-security-architecture.md)
