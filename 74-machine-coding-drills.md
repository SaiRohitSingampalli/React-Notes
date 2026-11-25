# 74 — Machine-Coding Drills

> In a machine-coding round, the code is only half the answer. The other half is what you say about it: which edge cases you thought of, which you chose to skip, and what you'd change for production.

**Prerequisites:** [03 JavaScript Runtime](03-javascript-runtime-and-engine.md), [12 Hooks in Depth](12-hooks-in-depth.md), [36 Accessibility Engineering](36-accessibility-engineering.md) · **Related:** [42 Testing Architecture](42-testing-architecture.md) · [66 Frontend System Design](66-frontend-system-design.md) (the typeahead drill) · [73 Interview Question Bank](73-interview-question-bank.md)

> [!NOTE]
> Every solution in this chapter is tested: 22 Vitest tests pass against React 19.3.1, Vitest 5.1, jsdom and Testing Library, and the code type-checks under TypeScript 6.0 `strict`. The test excerpts are taken from that suite.

---

## TL;DR

- **Eleven drills,** the ones that come up most: debounce and throttle, `Promise.all` and `allSettled`, a concurrency limiter, retry with backoff and cancellation, an event emitter, signals, an LRU cache, a virtual list, three hooks, accessible tabs and a filterable file tree.
- **Each drill has a prompt, what it tests, a tested solution and the follow-up questions** interviewers ask once it works.
- **Talk before you type.** Restate the problem, agree the API, list the edge cases, then write the code and a few tests.
- **The follow-ups are where seniority shows:** cancellation, ordering, memory, accessibility, concurrency, and what you'd use from a library in production.
- **For UI drills, accessibility is part of "working".** A tabs component without keyboard support is not finished.

---

## How to run a machine-coding round

A typical 45–60 minute round, planned:

| Minutes | What to do |
|---|---|
| 0–5 | Restate the problem. Ask about inputs, outputs, scale and the environment (browser, Node, React version). |
| 5–8 | Agree the API: a signature, or a component's props. Write it down first. |
| 8–10 | List the edge cases out loud: empty input, errors, ordering, cancellation, repeated calls. |
| 10–35 | Implement the core, narrating decisions. Get something working before handling every case. |
| 35–45 | Write two or three tests, or walk through examples by hand. |
| 45–60 | Follow-ups: extensions, trade-offs, what you'd change for production. |

What interviewers grade:

| Signal | What it looks like |
|---|---|
| Problem framing | Questions that change the design, not ones that stall |
| Correctness | It works for the normal case and the edge cases you named |
| Code quality | Small functions, good names, types that document intent |
| Testing instinct | You check your own work without being asked |
| Communication | They can follow your reasoning without reading your mind |
| Depth | You know what a production version needs and why |

---

## Drill 1: debounce and throttle

**Prompt:** write `debounce(fn, wait, { leading, trailing })` with `cancel()` and `flush()`, then a `throttle(fn, wait)`.

**What it tests:** closures, timers, the difference between the two, and attention to edge cases (a single call with `leading` mustn't fire twice).

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

```ts
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

it('throttle delivers at most one call per window while calls keep coming, then the latest', () => {
  const start = Date.now(), times: number[] = [], seen: number[] = [];
  const t = throttle((n: number) => { times.push(Date.now() - start); seen.push(n); }, 30);
  for (let ms = 0; ms <= 100; ms += 10) { t(ms); vi.advanceTimersByTime(10); }
  vi.advanceTimersByTime(100);
  expect(times).toEqual([0, 30, 60, 90, 120]);
  expect(seen.at(-1)).toBe(100);                                    // the last call is never lost
});
```

**Follow-ups:**

- *Why isn't throttle just a leading-and-trailing debounce?* Because under continuous calls a debounce keeps resetting its timer, so it fires at the start and the end and never in between. A throttle must fire every `wait` while calls continue. (Lodash expresses throttle as a debounce with `maxWait` for this reason.)
- *What about `this`?* Arrow functions and explicit arguments avoid the question; if you need method semantics, capture `this` in a regular function and call `fn.apply(this, args)`.
- *In React?* Create the debounced function once (`useMemo` or a ref), cancel it in an effect cleanup, and consider whether `useDeferredValue` is what the UI really needs.

---

## Drill 2: `Promise.all` and `allSettled` from scratch

**Prompt:** implement `all` and `allSettled` without using the built-ins of the same name.

**What it tests:** promise semantics: input order versus completion order, the first rejection, non-promise values, the empty case.

```ts
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
```

```ts
it('all keeps input order and rejects on the first failure', async () => {
  expect(await all([later('slow', 30), later('fast', 5), 'plain'])).toEqual(['slow', 'fast', 'plain']);
  await expect(all([later('a', 20), later('boom', 5, true)])).rejects.toBe('boom');
  expect(await all([])).toEqual([]);
});
```

**Follow-ups:**

- *Does a rejection cancel the other promises?* No. Promises aren't cancellable; the others keep running and their results are ignored. To actually stop work, pass an `AbortSignal` to the operations and abort it on the first failure.
- *How would you type a tuple like the built-in?* With a mapped type over the input tuple: `{ -readonly [K in keyof T]: Awaited<T[K]> }`. The simpler signature above needs an explicit type argument for mixed element types, which the test suite ran into.
- *`race` and `any`?* `race` settles with the first settled promise; `any` fulfils with the first fulfilment and rejects with an `AggregateError` only if all reject.

---

## Drill 3: a concurrency limiter

**Prompt:** upload 500 files, but never more than four at once. Write `mapLimit(items, limit, task)`.

**What it tests:** async control flow without libraries, and order of results.

```ts
/** Run at most `limit` tasks at once; results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
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
```

```ts
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
```

**Follow-ups:**

- *Why is `next++` safe without a lock?* JavaScript runs one piece of code at a time; there's no `await` between reading and incrementing `next`, so two workers can't take the same index.
- *What if a task fails?* As written, the first failure rejects the whole call and the other workers keep going. Alternatives: collect errors per item (`allSettled` style), or stop scheduling new work on the first failure.
- *Progress and cancellation?* Report a counter after each task, and check an `AbortSignal` at the top of the worker loop.

---

## Drill 4: retry with backoff and cancellation

**Prompt:** retry a flaky request with exponential backoff, don't retry errors that won't get better, and stop if the user navigates away.

**What it tests:** production instincts: jitter, error classification, cancellation.

```ts
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

```ts
const controller = new AbortController();
const pending = retry(async () => { throw new Error('down'); }, { retries: 10, baseMs: 1000, signal: controller.signal });
setTimeout(() => controller.abort(new Error('user left')), 10);
await expect(pending).rejects.toThrow('user left');
```

**Follow-ups:**

- *Why jitter?* Without it, every client that failed at the same moment retries at the same moments, and the recovering server gets hit by synchronized waves.
- *Which errors should you retry?* Network errors, 429 (honouring `Retry-After`) and 5xx on idempotent requests. Not 4xx like 400, 401 or 404, and not non-idempotent writes unless they carry an idempotency key.
- *What's missing for production?* A cap on the delay, a total time budget, and removing the abort listener after a successful wait (the `once` option only removes it when it fires).

---

## Drill 5: a typed event emitter

**Prompt:** an emitter with `on`, `once`, `off` and `emit`, typed so the payload matches the event.

**What it tests:** TypeScript generics, and a classic bug: modifying a listener collection while iterating it.

```ts
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

```ts
const bus = new Emitter<{ saved: { id: string }; closed: void }>();
const offA = bus.on('saved', a);
bus.once('saved', b);
bus.on('saved', () => offA());                                      // removes a listener mid-emit
bus.on('saved', c);
bus.emit('saved', { id: '1' });
bus.emit('saved', { id: '2' });
// a: once; b: once; c: twice
```

**Follow-ups:**

- *What happens if a listener throws?* Here, the remaining listeners don't run. Production emitters often catch per listener and report, so one bad subscriber doesn't break the others.
- *Memory leaks?* Returning an unsubscribe function makes cleanup easy (`useEffect(() => bus.on('saved', handler), [])`). Delete empty sets if events are dynamic.
- *Why not `EventTarget`?* It's a fine choice in browsers and Node, with `{ once: true }` and `AbortSignal` support built in; typing payloads is clumsier.

---

## Drill 6: signals from scratch

**Prompt:** implement `signal`, `computed` and `effect` with automatic dependency tracking, and a `batch`.

**What it tests:** understanding the reactivity model behind Angular, Solid, Preact Signals and the TC39 proposal.

```ts
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

```ts
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
```

**Follow-ups:**

- *Why clean up dependencies before every run?* So a branch that's no longer taken stops triggering updates: the first test's `name.set('Augusta')` causes no re-run.
- *What's wrong with an eager `computed`?* It recomputes even when nobody reads it, and in a "diamond" (two computeds depending on one signal, and an effect reading both) the effect can briefly see one updated and one stale value, a glitch. Production implementations make computeds lazy, mark dependents dirty and recompute in topological order, which is how Angular and Preact Signals avoid glitches.
- *How does this compare with React?* React re-renders a component and diffs its output; signals update exactly the bindings that read a changed value. [57](57-angular-signals-reactivity-and-rxjs.md) and [59](59-react-vs-angular-architecture-comparison.md) compare them properly.

---

## Drill 7: an LRU cache

**Prompt:** a least-recently-used cache with O(1) `get` and `set` and a fixed capacity.

**What it tests:** data structures, and knowing that a JavaScript `Map` preserves insertion order.

```ts
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

```ts
const cache = new LRUCache<string, number>(2);
cache.set('a', 1); cache.set('b', 2);
expect(cache.get('a')).toBe(1);                                     // a is now most recent
cache.set('c', 3);                                                  // evicts b
expect(cache.keys()).toEqual(['a', 'c']);
```

**Follow-ups:**

- *Without `Map` ordering?* A hash map from key to node plus a doubly linked list; move nodes to the head on access and evict from the tail. That's the textbook answer, and worth sketching even if you use `Map`.
- *Why `has` before `get`?* So a stored `undefined` value counts as a hit; the suite tests it.
- *Time-to-live?* Store `{ value, expires }` and treat expired entries as misses, evicting them lazily on access or with a periodic sweep.
- *Where does this show up in frontends?* Memoizing expensive selectors, image or tile caches, and server-state libraries' caches (TanStack Query uses time-based garbage collection rather than LRU).

---

## Drill 8: a virtual list

**Prompt:** render a scrollable list of 10,000 rows of fixed height smoothly.

**What it tests:** windowing arithmetic, React state from scroll events, and accessibility of partially rendered lists.

```tsx
export function visibleRange(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan = 3) {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(count - 1, Math.ceil((scrollTop + viewport) / rowHeight) - 1 + overscan);
  return { first, last };
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

```tsx
it('renders only the visible rows of 10,000, and follows the scroll position', () => {
  render(<VirtualList items={items} rowHeight={20} height={200} label="Items" getKey={(item) => item.id} renderRow={(item) => item.name} />);
  const list = screen.getByRole('list', { name: 'Items' });
  expect(screen.getAllByRole('listitem')).toHaveLength(13);         // 10 visible + 3 overscan
  list.scrollTop = 2000;
  fireEvent.scroll(list);
  expect(screen.getAllByRole('listitem')).toHaveLength(16);         // 3 overscan on each side
  expect(screen.queryByText('Item 0')).toBeNull();
  expect(screen.getByText('Item 100').getAttribute('aria-posinset')).toBe('101');
});
```

**Follow-ups:**

- *Variable row heights?* Measure rows after render (a `ResizeObserver`), keep an array of offsets, and binary-search it for the first visible row. Libraries like TanStack Virtual do this well; in production, use one.
- *Scroll performance?* Scroll events fire often. Rendering only when `first` or `last` changes (not on every pixel) and keeping rows cheap matter more than throttling the handler.
- *Accessibility?* `aria-setsize` and `aria-posinset` tell screen readers where they are. Find-in-page won't see unrendered rows, and keyboard users need focus to move into the list; a grid of interactive rows needs the grid pattern.
- *Why `getKey`?* Index keys are fine for a static list; if items are inserted or reordered, keys must follow the item.

---

## Drill 9: hooks

**Prompt:** write `useDebouncedValue`, `useInterval` and `useLocalStorageState`.

**What it tests:** effects and cleanup, stale closures, and external stores.

```ts
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

```ts
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
```

**Follow-ups:**

- *Why `useEffectEvent` in `useInterval`?* Putting `callback` in the dependencies would restart the interval on every render that passes a new function. Before React 19.2, the same pattern used a ref updated in an effect.
- *Why does `getSnapshot` return the raw string?* `useSyncExternalStore` compares snapshots with `Object.is`. Returning `JSON.parse(...)` would create a new object every call and loop forever; parse in `useMemo` instead.
- *What about server rendering?* The server snapshot returns `null`, so the server renders `initial`; the client then reads storage after hydration without a mismatch error.
- *Errors?* Wrap `JSON.parse` and `setItem` in `try` blocks in production: stored data can be corrupt, and storage can be full or blocked.

---

## Drill 10: accessible tabs

**Prompt:** a tabs component. Keyboard and screen-reader support are part of the requirement.

**What it tests:** the ARIA tabs pattern, focus management and roving `tabindex`.

```tsx
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

```tsx
it('is one tab stop; arrows, Home and End move selection and focus, wrapping at the ends', async () => {
  const user = userEvent.setup();
  render(<><Tabs tabs={tabs} label="Account" /><button>After</button></>);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Profile' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Security', selected: true })).toBe(document.activeElement);
  await user.keyboard('{End}');
  await user.keyboard('{ArrowRight}');                              // wraps to the first tab
  expect(screen.getByRole('tab', { name: 'Profile', selected: true })).toBe(document.activeElement);
  await user.tab();                                                 // into the panel, not the other tabs
  expect(document.activeElement).toBe(screen.getByRole('tabpanel', { name: 'Profile' }));
});
```

**Follow-ups:**

- *Automatic or manual activation?* This selects on arrow keys (automatic). If showing a panel is expensive (it fetches), use manual activation: arrows move focus, Enter or Space selects.
- *Right-to-left?* Arrow directions should flip in RTL layouts; read the direction from the element.
- *Why `tabIndex={0}` on the panel?* So keyboard users can reach a panel that has no focusable content; omit it when the panel starts with a focusable element.
- *Keep inactive panels mounted?* `hidden` keeps their state; to unmount them, render only the selected one. `<Activity>` is the React 19.2+ way to keep state while hidden.

---

## Drill 11: a file tree with filtering

**Prompt:** render a nested file tree that expands and collapses, with a filter box that shows matches and the folders leading to them.

**What it tests:** recursion in data and components, state per node, and resetting state deliberately.

```tsx
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

```tsx
await user.click(screen.getByRole('button', { name: 'src' }));
expect(screen.getByText('app.tsx')).toBeTruthy();
await user.type(screen.getByRole('searchbox', { name: 'Filter Files' }), 'users');
expect(screen.getByText('users.tsx')).toBeTruthy();                 // two levels down, already expanded
expect(screen.queryByText('billing.tsx')).toBeNull();
```

**Follow-ups:**

- *Why disclosure buttons instead of `role="tree"`?* Nested lists of buttons with `aria-expanded` are simple and fully accessible. The ARIA tree pattern adds arrow-key navigation across all visible items, which is worth it for large trees but is a lot more code to get right.
- *Why `key={query}`?* It resets every node's open state when the query changes, so matches start expanded. The cost is losing the user's manual expansions while filtering; lifting open state into a `Set` of paths keeps them, at the price of more code.
- *Keys by name?* Fine within one folder, where names are unique. Across the tree, use the full path.
- *A huge tree?* Flatten the visible nodes into a list and virtualize it (drill 8).

---

## More drills to practise

These come up often too. Their answers are elsewhere in the handbook, or are good exercises to write and test yourself:

| Drill | Where to look |
|---|---|
| Typeahead with cancellation and caching | [66](66-frontend-system-design.md) (tested implementation) |
| Optimistic "add to bag" | [68](68-case-study-ecommerce-storefront.md) (`useOptimistic`) |
| Infinite scroll with `IntersectionObserver` | [25](25-complex-ui-engineering.md) |
| Modal dialog with the native `<dialog>` and focus return | [36](36-accessibility-engineering.md) |
| Form with validation and server errors | [26](26-forms-and-validation.md) |
| A tiny React (`createElement`, render, reconciliation, hooks) | [11](11-build-your-own-react.md) |
| Drag-and-drop list with a keyboard alternative | [25](25-complex-ui-engineering.md), [36](36-accessibility-engineering.md) |
| Data table with sorting, filtering and pagination in the URL | [25](25-complex-ui-engineering.md), [31](31-routing-architecture.md) |
| Undo and redo with a command stack | [29](29-client-state-management.md) |
| `deepEqual`, `curry`, `flatten`, `get(obj, path)` | Write and test them; mind cycles and `NaN` |

---

## Decision framework

**Problem:** deciding how much to build in a fixed-length round.

**Constraints:** the time left, what the interviewer emphasised, and which edge cases carry the most risk.

| Situation | Do | Don't |
|---|---|---|
| The core isn't working yet | Make the main path work, then add cases | Polish styling or types |
| Core works, 15+ minutes left | Add the riskiest edge case and a test | Gold-plate rarely used options |
| UI drill | Keyboard and screen-reader basics first | Leave accessibility "for later" |
| The interviewer asks for production quality | Name what you'd add: errors, cancellation, tests, a library | Pretend the drill is production code |
| You're stuck | Say so, simplify the problem, solve that, then generalise | Go silent |

**Criteria:** working beats complete; named trade-offs beat silent ones; a test beats a claim.

**Failure modes:** starting to type before agreeing the API; no tests; ignoring accessibility; long silences; arguing with the interviewer's constraints.

---

## Pitfalls and anti-patterns

- **Leading debounce that fires twice for one call.** Track whether the trailing call has new arguments.
- **`Promise.all` that returns results in completion order.** Write by index.
- **Retry without jitter, or retrying 4xx errors.** Synchronized retries and pointless load.
- **Iterating a listener set while listeners unsubscribe.** Copy before iterating.
- **`useSyncExternalStore` with a `getSnapshot` that returns a new object.** An infinite render loop.
- **A callback in an interval's dependencies.** The timer restarts every render; use `useEffectEvent`.
- **Index keys in reorderable lists.** State attaches to the wrong row.
- **Tabs where every tab is a tab stop.** The pattern is one stop with arrow keys inside.

---

## Architect's checklist

- [ ] I can write each of the eleven drills from memory in under 20 minutes.
- [ ] I can explain the follow-ups for each without notes.
- [ ] For every UI drill, I include keyboard support and roles without being asked.
- [ ] I write at least two tests during the round, or walk through examples aloud.
- [ ] I can say which library I'd use in production for each drill, and why.

---

## Interview angles

**Q: Debounce or throttle for a search box? For scroll handling?**
A: Debounce for search: you want one request after the user pauses. Throttle for scroll or resize work that must keep happening while the user scrolls, at a bounded rate. For React rendering cost, `useDeferredValue` or a transition is often better than either, because it lets urgent updates go first without a fixed delay.

**Q: Your `Promise.all` rejected. Did the other requests stop?**
A: No. Promises can't be cancelled; the other operations keep running and their results are ignored. To stop them, pass an `AbortSignal` into each request and abort it when the first one fails.

**Q: How do signals avoid re-rendering whole components?**
A: Each signal knows which computations read it, through tracking during execution. When it changes, only those re-run, so a framework can update a single text binding instead of re-rendering and diffing a component. The hard part in production is avoiding glitches, which needs lazy computeds and ordered updates.

**Q: How would you make your virtual list work with rows of unknown height?**
A: Render, measure with a `ResizeObserver`, store each row's height and keep cumulative offsets, and binary-search those offsets for the first visible row. Estimate unmeasured rows, and correct the scroll position when measurements change above the viewport. In production I'd use a library such as TanStack Virtual.

**Q: What makes a tabs component accessible?**
A: The tablist, tab and tabpanel roles with `aria-selected`, `aria-controls` and `aria-labelledby`; one tab stop for the whole tablist with a roving `tabindex`; arrow keys, Home and End to move between tabs; and the panel reachable with Tab. Then test it with a keyboard and a screen reader, not just with axe.

---

## Further reading

- [WAI-ARIA Authoring Practices: Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) and [Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- [React: `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) and [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent).
- [TC39 Signals proposal](https://github.com/tc39/proposal-signals).
- [MDN: `AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
- [TanStack Virtual](https://tanstack.com/virtual).

---

[← Previous: 73 — Interview Question Bank](73-interview-question-bank.md) · [Index](README.md) · [Next: A1 — React API Reference Tables →](A1-react-api-reference.md)
