# E12 — useLocalStorageState: an external store done right

> Runnable code for [12 — Hooks in Depth](12-hooks-in-depth.md). 5 tests.

A `useSyncExternalStore` hook over `localStorage`: in sync across components and tabs, safe during server rendering, and tolerant of corrupt values. The tests cover each of those, including the server render, which shows the fallback rather than failing.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 12    # writes examples/12-hooks-in-depth/
cd examples/12-hooks-in-depth
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/use-local-storage-state.ts` | 12, "11.2 Worked examples" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/use-local-storage-state.ts`

```ts
import { useCallback, useMemo, useSyncExternalStore } from 'react'; // glue: the chapter's block omits imports

// useLocalStorageState: cross-tab synced, SSR-safe, tolerant of corrupt values
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; } // stable: no resubscribe per render
if (typeof window !== 'undefined') window.addEventListener('storage', emit);

export function useLocalStorageState<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null); // strings compare by value
  const value = useMemo(() => {
    if (raw === null) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; } // corrupt or hand-edited storage
  }, [raw, fallback]);
  const setValue = useCallback((next: T) => { localStorage.setItem(key, JSON.stringify(next)); emit(); }, [key]);
  return [value, setValue] as const;
}
```

### `test/use-local-storage-state.test.tsx`

```tsx

import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it } from 'vitest';
import { useLocalStorageState } from '../src/use-local-storage-state.ts';

afterEach(() => { cleanup(); localStorage.clear(); });

it('returns the fallback until something is stored, then the stored value', () => {
  const { result } = renderHook(() => useLocalStorageState('theme', 'light'));
  expect(result.current[0]).toBe('light');
  act(() => result.current[1]('dark'));
  expect(result.current[0]).toBe('dark');
  expect(localStorage.getItem('theme')).toBe('"dark"');
});

it('updates every component that uses the key', () => {
  function Label({ id }: { id: string }) {
    const [density] = useLocalStorageState('density', 'comfortable');
    return <p data-testid={id}>{density}</p>;
  }
  function Toggle() {
    const [, setDensity] = useLocalStorageState('density', 'comfortable');
    return <button onClick={() => setDensity('compact')}>Compact</button>;
  }
  render(<><Label id="a" /><Label id="b" /><Toggle /></>);
  act(() => screen.getByRole('button').click());
  expect(screen.getByTestId('a').textContent).toBe('compact');
  expect(screen.getByTestId('b').textContent).toBe('compact');
});

it('picks up a change another tab made (the storage event)', () => {
  const { result } = renderHook(() => useLocalStorageState('locale', 'en'));
  act(() => {
    localStorage.setItem('locale', '"de"');                         // what the other tab wrote
    window.dispatchEvent(new StorageEvent('storage', { key: 'locale' }));
  });
  expect(result.current[0]).toBe('de');
});

it('falls back instead of crashing when the stored JSON is corrupt', () => {
  localStorage.setItem('prefs', '{not json');
  const { result } = renderHook(() => useLocalStorageState('prefs', { compact: false }));
  expect(result.current[0]).toEqual({ compact: false });
});

it('renders the fallback on the server, where there is no storage', () => {
  function Theme() {
    const [theme] = useLocalStorageState('theme', 'light');
    return <span>{theme}</span>;
  }
  localStorage.setItem('theme', '"dark"');
  expect(renderToString(<Theme />)).toBe('<span>light</span>');
});
```

### `package.json`

```json
{
  "name": "handbook-12-hooks-in-depth",
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

[← Previous: E11 — Build your own React: the runnable version](E11-build-your-own-react.md) · [Chapter 12](12-hooks-in-depth.md) · [Index](README.md) · [Next: E25 — A virtualised grid on TanStack Table 9 →](E25-complex-ui-engineering.md)
