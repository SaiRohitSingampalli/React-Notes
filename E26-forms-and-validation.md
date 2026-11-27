# E26 — useAutosave: debounced saves with optimistic concurrency

> Runnable code for [26 — Forms and Validation Architecture](26-forms-and-validation.md). 6 tests.

The chapter's autosave hook. Saves are debounced, run one at a time, and send `If-Match` with the ETag the previous save returned. A 412 goes to `onConflict`, other failures to `onError`, and a pending edit is sent when the page is hidden or the editor unmounts.

Each test pins down one of those behaviours. The first reproduces the bug the earlier version had: two overlapping saves sent the same ETag, so the server rejected the second.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 26    # writes examples/26-forms-and-validation/
cd examples/26-forms-and-validation
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/features/drafts/use-autosave.ts` | 26, "10. Autosave and drafts" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/features/drafts/types.ts`

```ts

// Glue: the chapter's Draft type lives elsewhere in the app
export type Draft = { id: string; [field: string]: unknown };
```

### `src/features/drafts/use-autosave.ts`

```ts
// features/drafts/use-autosave.ts
import { useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Draft } from './types';

// Debounced autosave with conflict detection. Saves run one at a time, each sending the ETag the previous
// one returned: overlapping saves would send the same stale If-Match and conflict with each other.
export function useAutosave(initialEtag: string, onConflict: (server: unknown) => void, onError: (reason: unknown) => void) {
  const etag = useRef(initialEtag);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const save = useDebouncedCallback((draft: Draft) => {
    queue.current = queue.current
      .then(async () => {
        const res = await fetch(`/api/drafts/${draft.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'If-Match': etag.current },
          body: JSON.stringify(draft),
        });
        if (res.status === 412) onConflict(await res.json());          // someone else saved: resolve explicitly
        else if (res.ok) etag.current = res.headers.get('ETag') ?? etag.current;
        else onError(res.status);                                        // keep the draft dirty; the next change retries
      })
      .catch(onError);                                                   // network failure: same
  }, 800);

  // Flush pending saves when the page is hidden (tab switch, close)
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') save.flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [save]);
  useEffect(() => () => { save.flush(); }, [save]);                     // and when the editor unmounts (in-app navigation)
  return save;
}
```

### `test/use-autosave.test.tsx`

```tsx

import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAutosave } from '../src/features/drafts/use-autosave.ts';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const ifMatchOf = (init: RequestInit) => (init.headers as Record<string, string>)['If-Match'];

it('queues saves, and each one sends the ETag the previous one returned', async () => {
  vi.useFakeTimers();
  const sent: string[] = [];
  let version = 1;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(ifMatchOf(init));
    await new Promise((resolve) => setTimeout(resolve, 1000));          // a slow network
    version++;
    return new Response('{}', { status: 200, headers: { ETag: `"v${version}"` } });
  }));
  const { result } = renderHook(() => useAutosave('"v1"', vi.fn(), vi.fn()));
  act(() => result.current({ id: 'd1', body: 'a' }));
  await act(() => vi.advanceTimersByTimeAsync(900));                    // first save in flight
  act(() => result.current({ id: 'd1', body: 'ab' }));
  await act(() => vi.advanceTimersByTimeAsync(850));                    // second save due, but queued
  expect(sent).toEqual(['"v1"']);
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(sent).toEqual(['"v1"', '"v2"']);                               // not "v1" twice: no conflict with yourself
});

it('reports a failed response and keeps the last good ETag', async () => {
  vi.useFakeTimers();
  const sent: string[] = [];
  const statuses = [503, 200];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(ifMatchOf(init));
    const status = statuses.shift()!;
    return new Response('{}', { status, headers: status === 200 ? { ETag: '"v2"' } : {} });
  }));
  const onError = vi.fn();
  const { result } = renderHook(() => useAutosave('"v1"', vi.fn(), onError));
  act(() => result.current({ id: 'd1', body: 'a' }));
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(onError).toHaveBeenCalledWith(503);
  act(() => result.current({ id: 'd1', body: 'ab' }));
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(sent).toEqual(['"v1"', '"v1"']);                               // the 503 didn't replace the ETag
});

it('hands a 412 to onConflict with the server version', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'd1', body: 'theirs' }), { status: 412 })));
  const onConflict = vi.fn();
  const { result } = renderHook(() => useAutosave('"v1"', onConflict, vi.fn()));
  act(() => result.current({ id: 'd1', body: 'mine' }));
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(onConflict).toHaveBeenCalledWith({ id: 'd1', body: 'theirs' });
});

it('survives a network failure: the error is reported and the next save still runs', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { ETag: '"v2"' } }));
  vi.stubGlobal('fetch', fetchMock);
  const onError = vi.fn();
  const { result } = renderHook(() => useAutosave('"v1"', vi.fn(), onError));
  act(() => result.current({ id: 'd1', body: 'a' }));
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(onError).toHaveBeenCalledWith(expect.any(TypeError));
  act(() => result.current({ id: 'd1', body: 'ab' }));
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('sends an edit that is still debouncing when the editor unmounts', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200, headers: { ETag: '"v2"' } }));
  vi.stubGlobal('fetch', fetchMock);
  const { result, unmount } = renderHook(() => useAutosave('"v1"', vi.fn(), vi.fn()));
  act(() => result.current({ id: 'd1', body: 'last words' }));
  await act(() => vi.advanceTimersByTimeAsync(300));                    // inside the 800 ms debounce
  unmount();                                                            // in-app navigation
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ id: 'd1', body: 'last words' });
});

it('flushes when the page is hidden', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { ETag: '"v2"' } }));
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useAutosave('"v1"', vi.fn(), vi.fn()));
  act(() => result.current({ id: 'd1', body: 'a' }));
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);                           // sent without waiting 800 ms
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
```

### `package.json`

```json
{
  "name": "handbook-26-forms-and-validation",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "dependencies": {
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "use-debounce": "10.1.1"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "jsdom": "31.0.1",
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
    },
    "jsx": "react-jsx"
  },
  "include": [
    "src",
    "test"
  ]
}
```

### `vitest.config.ts`

```ts

import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom' } });
```

---

[← Previous: E25 — A virtualised grid on TanStack Table 9](E25-complex-ui-engineering.md) · [Chapter 26](26-forms-and-validation.md) · [Index](README.md) · [Next: E29 — A small store on useSyncExternalStore →](E29-client-state-management.md)
