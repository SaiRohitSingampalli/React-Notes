# E03 — mapLimit: bounded concurrency

> Runnable code for [03 — The JavaScript Runtime and Engine](03-javascript-runtime-and-engine.md). 5 tests.

`mapLimit` runs async tasks with at most `limit` in flight and returns results in input order. The tests pin down the order guarantee, the concurrency cap, the edge cases, and the guard that rejects a limit of 0 (which used to resolve at once with empty slots).

After a failure, the other workers keep going until they run out of items; the call rejects with the first error. Pass an `AbortSignal` into your tasks if they should stop early.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 03    # writes examples/03-javascript-runtime-and-engine/
cd examples/03-javascript-runtime-and-engine
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/map-limit.ts` | 03, "6.3 Concurrency control" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/map-limit.ts`

```ts
// Run at most `limit` tasks concurrently, preserving result order
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit must be a positive integer, got ${limit}`); // 0 would run nothing
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

### `test/map-limit.test.ts`

```ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapLimit } from '../src/map-limit.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('results keep the input order, whatever order the tasks finish in', async () => {
  const out = await mapLimit([30, 5, 20, 1], 2, async (ms) => { await sleep(ms); return ms * 10; });
  assert.deepEqual(out, [300, 50, 200, 10]);
});

test('never runs more than `limit` tasks at once', async () => {
  let active = 0;
  let peak = 0;
  await mapLimit(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
    active++;
    peak = Math.max(peak, active);
    await sleep(2);
    active--;
  });
  assert.equal(peak, 3);
});

test('a limit above the number of items, and an empty list, both work', async () => {
  assert.deepEqual(await mapLimit([1, 2], 10, async (n) => n + 1), [2, 3]);
  assert.deepEqual(await mapLimit([] as number[], 4, async (n) => n), []);
});

test('limits that would run nothing, or make no sense, reject with RangeError', async () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(mapLimit([1, 2, 3], bad, async (n) => n), RangeError);
  }
});

test('the first failure rejects the whole call', async () => {
  await assert.rejects(
    mapLimit([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error('boom'); return n; }),
    /boom/,
  );
});
```

### `package.json`

```json
{
  "name": "handbook-03-javascript-runtime-and-engine",
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

[← Previous: E00 — Running the Examples](E00-running-the-examples.md) · [Chapter 03](03-javascript-runtime-and-engine.md) · [Index](README.md) · [Next: E11 — Build your own React: the runnable version →](E11-build-your-own-react.md)
