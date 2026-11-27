# E29 — A small store on useSyncExternalStore

> Runnable code for [29 — Client State Management: Context, Redux Toolkit, Zustand, Jotai, XState and Signals](29-client-state-management.md). 3 tests.

The chapter's twenty-odd-line store: the core idea behind Zustand. The tests show why `useStore` caches its selection (a derived selector would otherwise loop), that a component re-renders only when its own slice changes, and that unmounting unsubscribes.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 29    # writes examples/29-client-state-management/
cd examples/29-client-state-management
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/store.ts` | 29, "2. How external stores plug into React" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/store.ts`

```ts
// A small store: the core of what Zustand does
import { useRef, useSyncExternalStore } from 'react';

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (updater: (s: T) => T) => { state = updater(state); listeners.forEach((l) => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

export function useStore<T, S>(store: ReturnType<typeof createStore<T>>, selector: (s: T) => S): S {
  // useSyncExternalStore needs the same value back until the store changes, so cache the selection per state and
  // selector. Without this, a derived selector such as (s) => s.todos.filter(...) returns a new array on every call
  // and React stops with "Maximum update depth exceeded".
  const cache = useRef<{ state: T; selector: (s: T) => S; selected: S } | null>(null);
  const getSnapshot = () => {
    const state = store.get();
    if (!cache.current || cache.current.state !== state || cache.current.selector !== selector) {
      cache.current = { state, selector, selected: selector(state) };
    }
    return cache.current.selected;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
```

### `test/store.test.tsx`

```tsx

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createStore, useStore } from '../src/store.ts';

afterEach(cleanup);
type Todo = { id: number; done: boolean };
const todos = (): Todo[] => [{ id: 1, done: true }, { id: 2, done: false }];

it('a derived selector (a new array each call) renders without looping', () => {
  const store = createStore({ todos: todos() });
  let renders = 0;
  const Done = () => { renders++; return <p>{useStore(store, (s) => s.todos.filter((t) => t.done)).length}</p>; };
  const { container } = render(<Done />);
  expect(container.textContent).toBe('1');
  act(() => store.set((s) => ({ todos: s.todos.map((t) => ({ ...t, done: true })) })));
  expect(container.textContent).toBe('2');
  expect(renders).toBeLessThanOrEqual(4);                                // React may render twice in development
});

it('re-renders a component only when its own selection changes', () => {
  const store = createStore({ count: 0, theme: 'light' });
  let countRenders = 0;
  const Count = () => { countRenders++; return <p>{useStore(store, (s) => s.count)}</p>; };
  render(<Count />);
  const before = countRenders;
  act(() => store.set((s) => ({ ...s, theme: 'dark' })));               // a slice Count doesn't read
  expect(countRenders).toBe(before);
  act(() => store.set((s) => ({ ...s, count: 1 })));
  expect(countRenders).toBe(before + 1);
});

it('unsubscribes on unmount', () => {
  const store = createStore({ count: 0 });
  const seen: number[] = [];
  const Count = () => { const c = useStore(store, (s) => s.count); seen.push(c); return null; };
  const { unmount } = render(<Count />);
  unmount();
  const calls = seen.length;
  act(() => store.set((s) => ({ count: s.count + 1 })));
  expect(seen.length).toBe(calls);
});
```

### `package.json`

```json
{
  "name": "handbook-29-client-state-management",
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
    "react-dom": "19.3.1"
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

[← Previous: E26 — useAutosave: debounced saves with optimistic concurrency](E26-forms-and-validation.md) · [Chapter 29](29-client-state-management.md) · [Index](README.md) · [Next: E33 — A production HTTP client →](E33-api-integration-bff-and-contracts.md)
