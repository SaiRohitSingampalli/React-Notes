# E74 — Machine-coding drills, with their tests

> Runnable code for [74 — Machine-Coding Drills](74-machine-coding-drills.md). 23 tests.

All eleven drills from the chapter, each with the tests the chapter's "what a strong answer includes" refers to. Tests sit next to the code (`lru.ts` and `lru.test.ts`). The chapter prints the implementations in full and abridged versions of the tests.

| File | Drill |
|---|---|
| `src/debounce.ts` | Drill 1: debounce and throttle |
| `src/promise.ts` | Drills 2 to 4: Promise.all and allSettled, a concurrency limiter, retry with backoff |
| `src/emitter.ts` | Drill 5: a typed event emitter |
| `src/signals.ts` | Drill 6: signals from scratch |
| `src/lru.ts` | Drill 7: an LRU cache |
| `src/VirtualList.tsx` | Drill 8: a virtual list |
| `src/hooks.ts` | Drill 9: useDebouncedValue, useInterval, useLocalStorageState |
| `src/Tabs.tsx` | Drill 10: accessible tabs |
| `src/FileTree.tsx` | Drill 11: a file tree with filtering |

Try each drill yourself first: delete the implementation, keep the test, and make it pass.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 74    # writes examples/74-machine-coding-drills/
cd examples/74-machine-coding-drills
npm ci
npm test
npm run typecheck
```

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/FileTree.tsx`

```tsx
// FileTree.tsx: nested disclosure buttons, plus a filter that keeps the path to every match
import { useState } from 'react';

export type TreeNode = { name: string; children?: TreeNode[] };

/** Keep nodes that match, and the folders on the way to them. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.flatMap((node) => {
    if (node.name.toLowerCase().includes(q)) return [node];
    const children = node.children ? filterTree(node.children, q) : [];
    return children.length ? [{ ...node, children }] : [];
  });
}

export function FileTree({ nodes, label }: { nodes: TreeNode[]; label: string }) {
  const [query, setQuery] = useState('');
  const visible = filterTree(nodes, query);
  return (
    <nav aria-label={label}>
      <input type="search" aria-label={`Filter ${label}`} value={query} onChange={(e) => setQuery(e.target.value)} />
      {/* key: a new query remounts the tree, so matches start expanded */}
      <Branch key={query} nodes={visible} expandAll={query.trim() !== ''} />
    </nav>
  );
}

function Branch({ nodes, expandAll }: { nodes: TreeNode[]; expandAll: boolean }) {
  return <ul>{nodes.map((node) => <Item key={node.name} node={node} expandAll={expandAll} />)}</ul>;
}

function Item({ node, expandAll }: { node: TreeNode; expandAll: boolean }) {
  const [open, setOpen] = useState(expandAll);
  if (!node.children) return <li>{node.name}</li>;
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{node.name}</button>
      {open && <Branch nodes={node.children} expandAll={expandAll} />}
    </li>
  );
}
```

### `src/Tabs.tsx`

```tsx
// Tabs.tsx: the ARIA tabs pattern with a roving tabindex and automatic activation
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'; // React's KeyboardEvent, not the DOM's

export interface Tab { id: string; title: string; content: ReactNode }

export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;               // wrap around at both ends
    setSelected(next);
    buttons.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const target = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    select(target);
  };

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button key={tab.id} ref={(el) => { buttons.current[i] = el; }} type="button" role="tab"
            id={`${base}-tab-${tab.id}`} aria-controls={`${base}-panel-${tab.id}`}
            aria-selected={i === selected} tabIndex={i === selected ? 0 : -1} onClick={() => setSelected(i)}>
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.id} role="tabpanel" id={`${base}-panel-${tab.id}`} aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={i !== selected} tabIndex={0}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

### `src/VirtualList.tsx`

```tsx
// VirtualList.tsx: fixed-height rows; only the visible window (plus overscan) is in the DOM
import { useState, type Key, type ReactNode } from 'react';

export function visibleRange(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan = 3) {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(count - 1, Math.ceil((scrollTop + viewport) / rowHeight) - 1 + overscan);
  return { first, last };
}

interface Props<T> {
  items: T[];
  rowHeight: number;
  height: number;
  label: string;
  renderRow: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => Key;
}

export function VirtualList<T>({ items, rowHeight, height, label, renderRow, getKey = (_, i) => i }: Props<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const { first, last } = visibleRange(scrollTop, height, rowHeight, items.length);
  const rows: ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    rows.push(
      <div key={getKey(items[i], i)} role="listitem" aria-setsize={items.length} aria-posinset={i + 1}
        style={{ position: 'absolute', top: i * rowHeight, height: rowHeight, insetInline: 0 }}>
        {renderRow(items[i], i)}
      </div>,
    );
  }
  return (
    <div role="list" aria-label={label} tabIndex={0} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ height, overflowY: 'auto', position: 'relative' }}>
      <div style={{ height: items.length * rowHeight, position: 'relative' }}>{rows}</div>
    </div>
  );
}
```

### `src/debounce.ts`

```ts
// debounce.ts: trailing by default, optional leading edge, with cancel and flush
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number, { leading = false, trailing = true } = {}): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;                                       // arguments of a call not yet delivered

  const fire = () => { const args = pending!; pending = undefined; fn(...args); };
  const debounced = (...args: A) => {
    const callNow = leading && timer === undefined;
    pending = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (trailing && pending) fire();
      pending = undefined;
    }, wait);
    if (callNow) fire();
  };
  debounced.cancel = () => { clearTimeout(timer); timer = undefined; pending = undefined; };
  debounced.flush = () => { if (timer !== undefined && pending) { clearTimeout(timer); timer = undefined; fire(); } };
  return debounced;
}

/** At most one call per `wait` while calls keep coming, plus a final call with the latest arguments. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let last = -Infinity;                                             // when a call was last delivered
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;
  return (...args: A) => {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      clearTimeout(timer); timer = undefined;
      last = Date.now();
      fn(...args);
    } else {
      pending = args;                                               // keep only the latest arguments
      timer ??= setTimeout(() => { timer = undefined; last = Date.now(); const a = pending!; pending = undefined; fn(...a); }, remaining);
    }
  };
}
```

### `src/emitter.ts`

```ts
// emitter.ts: a typed event emitter with on, once and an unsubscribe function
type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  #listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const set = this.#listeners.get(event) ?? new Set();
    set.add(listener as Listener<never>);
    this.#listeners.set(event, set);
    return () => this.off(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => { off(); listener(payload); });
    return off;
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    this.#listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    for (const listener of [...(this.#listeners.get(event) ?? [])]) {   // copy: listeners may unsubscribe while we iterate
      (listener as Listener<Events[K]>)(payload);
    }
  }
}
```

### `src/hooks.ts`

```ts
// hooks.ts: three hooks interviewers ask for, written for React 19.3
import { useCallback, useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react';

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);                               // a newer value cancels the older one
  }, [value, ms]);
  return debounced;
}

export function useInterval(callback: () => void, ms: number | null) {
  const onTick = useEffectEvent(callback);                          // always the latest callback; doesn't restart the timer
  useEffect(() => {
    if (ms === null) return;                                        // null pauses
    const id = setInterval(() => onTick(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const SAME_TAB = 'local-storage';                                   // the storage event only fires in *other* tabs
export function useLocalStorageState<T>(key: string, initial: T) {
  const subscribe = useCallback((notify: () => void) => {
    const onStorage = (e: StorageEvent) => { if (e.key === key) notify(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SAME_TAB, notify);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(SAME_TAB, notify); };
  }, [key]);
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null); // a string: stable between changes
  const value = useMemo(() => (raw === null ? initial : (JSON.parse(raw) as T)), [raw, initial]);
  const setValue = useCallback((next: T) => {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(SAME_TAB));
  }, [key]);
  return [value, setValue] as const;
}
```

### `src/lru.ts`

```ts
// lru.ts: O(1) get and set using Map's insertion order
export class LRUCache<K, V> {
  #map = new Map<K, V>();
  constructor(readonly capacity: number) { if (capacity < 1) throw new RangeError('capacity must be at least 1'); }

  get(key: K): V | undefined {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key)!;
    this.#map.delete(key);                                          // move to the most-recently-used end
    this.#map.set(key, value);
    return value;
  }

  set(key: K, value: V) {
    this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.capacity) this.#map.delete(this.#map.keys().next().value!); // evict the oldest
  }

  get size() { return this.#map.size; }
  keys() { return [...this.#map.keys()]; }                          // least to most recently used
}
```

### `src/promise.ts`

```ts
// promise.ts: Promise.all and allSettled from scratch, a concurrency limiter, and retry with backoff
export function all<T>(items: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]> {
  return new Promise((resolve, reject) => {
    const list = [...items];
    const results = new Array(list.length);
    let remaining = list.length;
    if (remaining === 0) return resolve([]);
    list.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;                                         // keep input order, not completion order
        if (--remaining === 0) resolve(results);
      }, reject);                                                   // the first rejection wins
    });
  });
}

export type Settled<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };
export function allSettled<T>(items: Iterable<T | PromiseLike<T>>): Promise<Settled<Awaited<T>>[]> {
  return all([...items].map((item) => Promise.resolve(item).then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (reason) => ({ status: 'rejected' as const, reason }),
  )));
}

/** Run at most `limit` tasks at once; results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit must be a positive integer, got ${limit}`);
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;                                             // safe: no await between read and increment
      results[i] = await task(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface RetryOptions { retries: number; baseMs: number; signal?: AbortSignal; shouldRetry?: (error: unknown) => boolean }
/** Exponential backoff with full jitter; stops on abort or on errors that aren't worth retrying. */
export async function retry<T>(fn: (attempt: number) => Promise<T>, { retries, baseMs, signal, shouldRetry = () => true }: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      const delay = Math.random() * baseMs * 2 ** attempt;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
      });
    }
  }
}
```

### `src/signals.ts`

```ts
// signals.ts: signal, computed and effect with automatic dependency tracking
type Node = { run(): void; deps: Set<Set<Node>> };
let current: Node | null = null;                                    // the computation currently reading signals
let batchDepth = 0;
const queued = new Set<Node>();

function track(subscribers: Set<Node>) {
  if (current) { subscribers.add(current); current.deps.add(subscribers); }
}
function trigger(subscribers: Set<Node>) {
  for (const node of [...subscribers]) batchDepth ? queued.add(node) : node.run();
}
function cleanup(node: Node) {                                      // forget old dependencies before re-running
  for (const subscribers of node.deps) subscribers.delete(node);
  node.deps.clear();
}

export function signal<T>(initial: T) {
  let value = initial;
  const subscribers = new Set<Node>();
  return {
    get: () => { track(subscribers); return value; },
    set: (next: T) => { if (!Object.is(next, value)) { value = next; trigger(subscribers); } },
  };
}

export function effect(fn: () => void): () => void {
  const node: Node = {
    deps: new Set(),
    run() { cleanup(node); const prev = current; current = node; try { fn(); } finally { current = prev; } },
  };
  node.run();
  return () => cleanup(node);
}

export function computed<T>(fn: () => T) {
  const out = signal<T>(undefined as T);
  effect(() => out.set(fn()));                                      // eager and simple; see the follow-ups
  return { get: out.get };
}

export function batch(fn: () => void) {
  batchDepth++;
  try { fn(); } finally {
    if (--batchDepth === 0) { const nodes = [...queued]; queued.clear(); nodes.forEach((n) => n.run()); }
  }
}
```

### `src/FileTree.test.tsx`

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { FileTree, filterTree, type TreeNode } from './FileTree';

afterEach(cleanup);
const tree: TreeNode[] = [
  { name: 'src', children: [{ name: 'app.tsx' }, { name: 'features', children: [{ name: 'users.tsx' }, { name: 'billing.tsx' }] }] },
  { name: 'README.md' },
];

it('filterTree keeps matches and the folders leading to them', () => {
  expect(filterTree(tree, 'bill')).toEqual([{ name: 'src', children: [{ name: 'features', children: [{ name: 'billing.tsx' }] }] }]);
  expect(filterTree(tree, '')).toBe(tree);
});

it('folders are disclosure buttons; filtering expands the path to each match', async () => {
  const user = userEvent.setup();
  render(<FileTree nodes={tree} label="Files" />);
  const src = screen.getByRole('button', { name: 'src' });
  expect(src.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('app.tsx')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'src' }));
  expect(screen.getByText('app.tsx')).toBeTruthy();
  await user.type(screen.getByRole('searchbox', { name: 'Filter Files' }), 'users');
  expect(screen.getByText('users.tsx')).toBeTruthy();               // two levels down, already expanded
  expect(screen.queryByText('billing.tsx')).toBeNull();
  expect(screen.queryByText('README.md')).toBeNull();
});
```

### `src/Tabs.test.tsx`

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { Tabs } from './Tabs';

afterEach(cleanup);
const tabs = [
  { id: 'profile', title: 'Profile', content: 'Profile settings' },
  { id: 'security', title: 'Security', content: 'Security settings' },
  { id: 'billing', title: 'Billing', content: 'Billing settings' },
];

it('is one tab stop; arrows, Home and End move selection and focus, wrapping at the ends', async () => {
  const user = userEvent.setup();
  render(<><Tabs tabs={tabs} label="Account" /><button>After</button></>);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Profile' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Security', selected: true })).toBe(document.activeElement);
  expect(screen.getByRole('tabpanel', { name: 'Security' }).textContent).toBe('Security settings');
  await user.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Billing' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Profile', selected: true })).toBe(document.activeElement);
  await user.tab();                                                 // into the panel, not the other tabs
  expect(document.activeElement).toBe(screen.getByRole('tabpanel', { name: 'Profile' }));
});
```

### `src/VirtualList.test.tsx`

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { VirtualList, visibleRange } from './VirtualList';

afterEach(cleanup);
const items = Array.from({ length: 10_000 }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}` }));

it('computes the window with overscan, clamped to the list', () => {
  expect(visibleRange(0, 200, 20, 10_000)).toEqual({ first: 0, last: 12 });
  expect(visibleRange(2000, 200, 20, 10_000)).toEqual({ first: 97, last: 112 });
  expect(visibleRange(199_900, 200, 20, 10_000)).toEqual({ first: 9992, last: 9999 });
});

it('renders only the visible rows of 10,000, and follows the scroll position', () => {
  render(<VirtualList items={items} rowHeight={20} height={200} label="Items" getKey={(item) => item.id} renderRow={(item) => item.name} />);
  const list = screen.getByRole('list', { name: 'Items' });
  expect(screen.getAllByRole('listitem')).toHaveLength(13);
  list.scrollTop = 2000;
  fireEvent.scroll(list);
  expect(screen.getAllByRole('listitem')).toHaveLength(16);
  expect(screen.queryByText('Item 0')).toBeNull();
  expect(screen.getByText('Item 100').getAttribute('aria-posinset')).toBe('101');      // position for screen readers
});
```

### `src/debounce.test.ts`

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { debounce, throttle } from './debounce';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('calls once, with the last arguments, after the burst settles', () => {
  const fn = vi.fn();
  const d = debounce(fn, 100);
  d('a'); vi.advanceTimersByTime(50); d('b'); vi.advanceTimersByTime(50); d('c');
  expect(fn).not.toHaveBeenCalled();
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('c');
});

it('leading: fires immediately, then once more at the end only if called again', () => {
  const fn = vi.fn();
  const d = debounce(fn, 100, { leading: true });
  d(1);
  expect(fn).toHaveBeenCalledWith(1);
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);                              // a single call doesn't fire twice
  d(2); d(3); vi.advanceTimersByTime(100);
  expect(fn.mock.calls).toEqual([[1], [2], [3]]);
});

it('cancel drops the pending call; flush delivers it now', () => {
  const fn = vi.fn();
  const d = debounce(fn, 100);
  d('x'); d.cancel(); vi.advanceTimersByTime(200);
  expect(fn).not.toHaveBeenCalled();
  d('y'); d.flush();
  expect(fn).toHaveBeenCalledWith('y');
  vi.advanceTimersByTime(200);
  expect(fn).toHaveBeenCalledTimes(1);
});

it('throttle delivers at most one call per window while calls keep coming, then the latest', () => {
  const start = Date.now(), times: number[] = [], seen: number[] = [];
  const t = throttle((n: number) => { times.push(Date.now() - start); seen.push(n); }, 30);
  for (let ms = 0; ms <= 100; ms += 10) { t(ms); vi.advanceTimersByTime(10); }
  vi.advanceTimersByTime(100);
  expect(times).toEqual([0, 30, 60, 90, 120]);
  expect(seen.at(-1)).toBe(100);                                    // the last call is never lost
});
```

### `src/emitter.test.ts`

```ts
import { expect, it, vi } from 'vitest';
import { Emitter } from './emitter';

it('delivers typed payloads, supports once, and survives unsubscribing during emit', () => {
  const bus = new Emitter<{ saved: { id: string }; closed: void }>();
  const a = vi.fn(), b = vi.fn(), c = vi.fn();
  const offA = bus.on('saved', a);
  bus.once('saved', b);
  bus.on('saved', () => offA());                                    // removes a listener mid-emit
  bus.on('saved', c);
  bus.emit('saved', { id: '1' });
  bus.emit('saved', { id: '2' });
  expect(a.mock.calls).toEqual([[{ id: '1' }]]);
  expect(b).toHaveBeenCalledTimes(1);
  expect(c).toHaveBeenCalledTimes(2);
});
```

### `src/hooks.test.tsx`

```tsx
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDebouncedValue, useInterval, useLocalStorageState } from './hooks';

afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

it('useDebouncedValue settles on the last value', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), { initialProps: { v: 'a' } });
  rerender({ v: 'ab' }); act(() => { vi.advanceTimersByTime(100); });
  rerender({ v: 'abc' }); act(() => { vi.advanceTimersByTime(199); });
  expect(result.current).toBe('a');
  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current).toBe('abc');
});

it('useInterval calls the latest callback without restarting the timer', () => {
  vi.useFakeTimers();
  const spy = vi.spyOn(globalThis, 'setInterval');
  const first = vi.fn(), second = vi.fn();
  const { rerender } = renderHook(({ cb }) => useInterval(cb, 100), { initialProps: { cb: first } });
  act(() => { vi.advanceTimersByTime(100); });
  rerender({ cb: second });
  act(() => { vi.advanceTimersByTime(100); });
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledTimes(1);                             // one interval for the whole lifetime
});

it('useLocalStorageState syncs hooks in this tab and updates from other tabs', () => {
  const a = renderHook(() => useLocalStorageState('theme', 'light'));
  const b = renderHook(() => useLocalStorageState('theme', 'light'));
  expect(a.result.current[0]).toBe('light');
  act(() => { a.result.current[1]('dark'); });
  expect(b.result.current[0]).toBe('dark');
  act(() => {                                                        // another tab writes
    localStorage.setItem('theme', JSON.stringify('high-contrast'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
  });
  expect(a.result.current[0]).toBe('high-contrast');
});
```

### `src/lru.test.ts`

```ts
import { expect, it } from 'vitest';
import { LRUCache } from './lru';

it('evicts the least recently used entry, and reads count as use', () => {
  const cache = new LRUCache<string, number>(2);
  cache.set('a', 1); cache.set('b', 2);
  expect(cache.get('a')).toBe(1);                                   // a is now most recent
  cache.set('c', 3);                                                // evicts b
  expect(cache.keys()).toEqual(['a', 'c']);
  expect(cache.get('b')).toBeUndefined();
  cache.set('a', 10);                                               // updating also refreshes
  cache.set('d', 4);                                                // evicts c
  expect(cache.keys()).toEqual(['a', 'd']);
  expect(cache.get('a')).toBe(10);
});

it('stores undefined values correctly', () => {
  const cache = new LRUCache<string, undefined>(1);
  cache.set('x', undefined);
  expect(cache.size).toBe(1);
});
```

### `src/promise.test.ts`

```ts
import { expect, it, vi } from 'vitest';
import { all, allSettled, mapLimit, retry } from './promise';

const later = <T,>(value: T, ms: number, fail = false) =>
  new Promise<T>((resolve, reject) => setTimeout(() => (fail ? reject(value) : resolve(value)), ms));

it('all keeps input order and rejects on the first failure', async () => {
  expect(await all([later('slow', 30), later('fast', 5), 'plain'])).toEqual(['slow', 'fast', 'plain']);
  await expect(all([later('a', 20), later('boom', 5, true)])).rejects.toBe('boom');
  expect(await all([])).toEqual([]);
});

it('allSettled reports every outcome', async () => {
  expect(await allSettled<number | string>([later(1, 5), later('no', 1, true)])).toEqual([
    { status: 'fulfilled', value: 1 }, { status: 'rejected', reason: 'no' },
  ]);
});

it('mapLimit never runs more than the limit at once, and keeps order', async () => {
  let running = 0, peak = 0;
  const out = await mapLimit([30, 10, 20, 5, 15], 2, async (ms, i) => {
    peak = Math.max(peak, ++running);
    await later(null, ms);
    running--;
    return i;
  });
  expect(out).toEqual([0, 1, 2, 3, 4]);
  expect(peak).toBe(2);
});

it('retry backs off, stops on non-retryable errors, and honours abort', async () => {
  let calls = 0;
  expect(await retry(async () => { if (++calls < 3) throw new Error('flaky'); return 'ok'; }, { retries: 5, baseMs: 1 })).toBe('ok');
  expect(calls).toBe(3);

  const fatal = vi.fn(async () => { throw new Error('401'); });
  await expect(retry(fatal, { retries: 5, baseMs: 1, shouldRetry: (e) => (e as Error).message !== '401' })).rejects.toThrow('401');
  expect(fatal).toHaveBeenCalledTimes(1);

  const controller = new AbortController();
  const pending = retry(async () => { throw new Error('down'); }, { retries: 10, baseMs: 1000, signal: controller.signal });
  setTimeout(() => controller.abort(new Error('user left')), 10);
  await expect(pending).rejects.toThrow('user left');
});

it('mapLimit rejects limits that would run nothing or make no sense', async () => {
  const task = vi.fn(async (n: number) => n * 2);
  for (const bad of [0, -1, 1.5, Number.NaN]) await expect(mapLimit([1, 2, 3], bad, task)).rejects.toThrow(RangeError);
  expect(task).not.toHaveBeenCalled();
  expect(await mapLimit([], 4, task)).toEqual([]);                  // an empty input is fine
});
```

### `src/signals.test.ts`

```ts
import { expect, it } from 'vitest';
import { batch, computed, effect, signal } from './signals';

it('tracks dependencies automatically, including switching branches', () => {
  const useNickname = signal(false), name = signal('Ada Lovelace'), nickname = signal('Ada');
  const label = computed(() => (useNickname.get() ? nickname.get() : name.get()));
  const seen: string[] = [];
  effect(() => { seen.push(label.get()); });
  name.set('Ada King');                                             // tracked: re-runs
  useNickname.set(true);                                            // switches branch
  name.set('Augusta');                                              // no longer read: no re-run
  nickname.set('A.');
  expect(seen).toEqual(['Ada Lovelace', 'Ada King', 'Ada', 'A.']);
});

it('batch runs each dependent effect once, after all the writes', () => {
  const first = signal('Ada'), last = signal('Lovelace');
  const runs: string[] = [];
  effect(() => { runs.push(`${first.get()} ${last.get()}`); });
  batch(() => { first.set('Grace'); last.set('Hopper'); });
  expect(runs).toEqual(['Ada Lovelace', 'Grace Hopper']);           // never 'Grace Lovelace'
});

it('disposing an effect stops it', () => {
  const count = signal(0); let runs = 0;
  const dispose = effect(() => { count.get(); runs++; });
  dispose(); count.set(1);
  expect(runs).toBe(1);
});
```

### `package.json`

```json
{
  "name": "handbook-74-machine-coding-drills",
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
    "@testing-library/user-event": "14.6.13",
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
    "allowImportingTsExtensions": false,
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
    "src"
  ]
}
```

### `vitest.config.ts`

```ts

import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom' } });
```

---

[← Previous: E70 — Prism: tokens, a contrast gate, an accessible component, usage telemetry](E70-case-study-enterprise-design-system.md) · [Chapter 74](74-machine-coding-drills.md) · [Index](README.md) · [Next: E75 — Experiment arithmetic: assignment, sample sizes, SRM and peeking →](E75-experimentation-and-product-analytics.md)
