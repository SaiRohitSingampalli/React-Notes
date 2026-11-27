# E66 — The typeahead core

> Runnable code for [66 — Frontend System Design: Method and Classic Prompts](66-frontend-system-design.md). 4 tests.

The framework-free core of the chapter's autocomplete design: debouncing, cancellation of stale requests, a small result cache, and ordering guarantees, so a slow response for "re" can never overwrite the results for "react". The tests drive it with fake timers and controllable responses.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 66    # writes examples/66-frontend-system-design/
cd examples/66-frontend-system-design
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/typeahead.ts` | 66, "3.2 Typeahead or autocomplete" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/typeahead.ts`

```ts
// typeahead.ts: the core of an autocomplete, framework-agnostic: debounce, cancel stale requests, cache recent answers
export interface Suggestion { id: string; label: string }
type Fetcher = (query: string, signal: AbortSignal) => Promise<Suggestion[]>;
type Listener = { onResult: (items: Suggestion[], query: string) => void; onError?: (error: unknown) => void };

export function createTypeahead(fetcher: Fetcher, { debounceMs = 150, minLength = 2, cacheSize = 50 } = {}) {
  const cache = new Map<string, Suggestion[]>();          // Map keeps insertion order: oldest entry first (LRU)
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | undefined;

  return {
    query(text: string, { onResult, onError }: Listener) {
      const key = text.trim().toLowerCase();
      clearTimeout(timer);
      inFlight?.abort();                                   // an older request's answer is no longer wanted
      if (key.length < minLength) return onResult([], text);
      const hit = cache.get(key);
      if (hit) {
        cache.delete(key);
        cache.set(key, hit);                               // refresh recency
        return onResult(hit, text);
      }
      timer = setTimeout(async () => {
        const controller = (inFlight = new AbortController());
        try {
          const items = await fetcher(key, controller.signal);
          if (controller.signal.aborted) return;          // a newer keystroke won the race
          cache.set(key, items);
          if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
          onResult(items, text);
        } catch (error) {
          if (!controller.signal.aborted) onError?.(error);
        }
      }, debounceMs);
    },
    dispose() {
      clearTimeout(timer);
      inFlight?.abort();
    },
  };
}
```

### `src/typeahead.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypeahead, type Suggestion } from './typeahead';

const s = (label: string): Suggestion[] => [{ id: label, label }];

describe('createTypeahead', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces keystrokes into one request for the final text', async () => {
    const fetcher = vi.fn(async (q: string) => s(q));
    const results: string[] = [];
    const t = createTypeahead(fetcher);
    for (const text of ['re', 'rea', 'reac', 'react']) t.query(text, { onResult: (_i, q) => results.push(q) });
    await vi.advanceTimersByTimeAsync(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('react');
    expect(results).toEqual(['react']);
  });

  it('ignores a slow answer that arrives after a newer one (no flicker of stale results)', async () => {
    const delays: Record<string, number> = { rea: 500, react: 50 };
    const fetcher = vi.fn((q: string, signal: AbortSignal) => new Promise<Suggestion[]>((resolve) => {
      const id = setTimeout(() => resolve(s(q)), delays[q]);
      signal.addEventListener('abort', () => clearTimeout(id));
    }));
    const shown: string[] = [];
    const t = createTypeahead(fetcher, { debounceMs: 10 });
    t.query('rea', { onResult: (items) => shown.push(items[0]?.label) });
    await vi.advanceTimersByTimeAsync(20);                 // 'rea' request is in flight
    t.query('react', { onResult: (items) => shown.push(items[0]?.label) });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['rea', 'react']);
    expect(fetcher.mock.calls[0][1].aborted).toBe(true);   // the stale request was cancelled, not just ignored
    expect(shown).toEqual(['react']);
  });

  it('answers repeated queries from the cache, and skips very short input', async () => {
    const fetcher = vi.fn(async (q: string) => s(q));
    const shown: string[][] = [];
    const t = createTypeahead(fetcher);
    t.query('React', { onResult: (items) => shown.push(items.map((i) => i.label)) });
    await vi.advanceTimersByTimeAsync(200);
    t.query('react ', { onResult: (items) => shown.push(items.map((i) => i.label)) });   // same key after normalising
    t.query('r', { onResult: (items) => shown.push(items.map((i) => i.label)) });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(shown).toEqual([['react'], ['react'], []]);
  });

  it('reports errors for the current query only', async () => {
    const onError = vi.fn();
    const t = createTypeahead(async () => { throw new Error('503'); });
    t.query('react', { onResult: () => {}, onError });
    await vi.advanceTimersByTimeAsync(200);
    expect(onError).toHaveBeenCalledWith(new Error('503'));
  });
});
```

### `package.json`

```json
{
  "name": "handbook-66-frontend-system-design",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "5.1.2"
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
    "noUncheckedIndexedAccess": false,
    "lib": [
      "es2024",
      "dom",
      "dom.iterable"
    ],
    "types": [],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src"
  ]
}
```

---

[← Previous: E65 — A chat UI with tools and human approval](E65-ai-powered-react-interfaces.md) · [Chapter 66](66-frontend-system-design.md) · [Index](README.md) · [Next: E67 — Tenant-scoped server state →](E67-case-study-enterprise-saas-dashboard.md)
