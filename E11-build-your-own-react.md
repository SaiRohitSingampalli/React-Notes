# E11 — Build your own React: the runnable version

> Runnable code for [11 — Build Your Own React](11-build-your-own-react.md). 5 tests.

The chapter's mini React (fiber tree, work loop, keyed reconciliation, hooks, effects), its full test suite, and the Todos example from section 8.

`npm run dev` serves the Todos app at http://localhost:5173, rendered by mini-react rather than React. The tests run the same code in jsdom.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 11    # writes examples/11-build-your-own-react/
cd examples/11-build-your-own-react
npm ci
npm test
npm run typecheck
npm run dev    # the Todos example in a browser
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/mini-react.ts` | 11, "7. The complete source" |
| `src/Todos.tsx` | 11, "8. Using it" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/Todos.tsx`

```tsx
/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, render, useState, useEffect } from './mini-react';

function Todos() {
  const [items, setItems] = useState([{ id: 1, text: 'Write mini React' }]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    document.title = `${items.length} todos`;
  }, [items.length]);

  return (
    <div>
      <input value={draft} onInput={(e: Event) => setDraft((e.target as HTMLInputElement).value)} />
      <button onClick={() => { setItems((xs) => [{ id: Date.now(), text: draft }, ...xs]); setDraft(''); }}>
        Add
      </button>
      <ul>{items.map((t) => <li key={t.id}>{t.text}</li>)}</ul>
    </div>
  );
}

render(<Todos />, document.getElementById('root')!);
```

### `src/jsx.d.ts`

```ts

// Glue: just enough JSX typing to type-check the example. mini-react's props are plain DOM properties.
export {};
declare global {
  namespace JSX {
    type Element = import('./mini-react.ts').VNode;
    interface IntrinsicElements { [tag: string]: Record<string, unknown> }
  }
}
```

### `src/mini-react.ts`

```ts
// mini-react.ts: a teaching implementation of React's core ideas (~270 lines).
// Elements → fibers → time-sliced render phase → synchronous commit → passive effects.

type Key = string | null;
type Child = VNode | string | number | boolean | null | undefined | Child[];
type Component = (props: any) => Child;
type Props = { [key: string]: unknown; children: VNode[] };

export interface VNode {
  type: string | Component;
  key: Key;
  props: Props;
}

interface StateHook { kind: 'state'; state: unknown; queue: { pending: unknown[] }; setState: (a: unknown) => void }
interface EffectHook { kind: 'effect'; deps?: unknown[]; create: () => void | (() => void); cleanup?: void | (() => void) }
interface RefHook { kind: 'ref'; ref: { current: unknown } }
interface MemoHook { kind: 'memo'; deps: unknown[]; value: unknown }
type Hook = StateHook | EffectHook | RefHook | MemoHook;

interface Fiber {
  type: string | Component | null; // null marks the root
  key: Key;
  props: Props;
  dom: Node | null;                 // host node (null for function components)
  parent: Fiber | null;             // React calls this `return`
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;          // the fiber from the previous commit
  flags: number;
  hooks: Hook[];
}

const TEXT = 'TEXT_ELEMENT';
const UPDATE = 1;

// ---------------------------------------------------------------- elements
export function createElement(type: string | Component, config: Record<string, unknown> | null, ...children: Child[]): VNode {
  const { key, ...props } = config ?? {};
  return { type, key: key == null ? null : String(key), props: { ...props, children: normalize(children) } };
}

function normalize(children: Child[]): VNode[] {
  const out: VNode[] = [];
  const visit = (c: Child): void => {
    if (Array.isArray(c)) return c.forEach(visit);         // flatten nested arrays (e.g. from .map)
    if (c == null || typeof c === 'boolean') return;       // null/undefined/true/false render nothing
    out.push(typeof c === 'object' ? c : { type: TEXT, key: null, props: { nodeValue: String(c), children: [] } });
  };
  children.forEach(visit);
  return out;
}

// ---------------------------------------------------------------- global work state
let nextUnitOfWork: Fiber | null = null;
let wipRoot: Fiber | null = null;
let currentRoot: Fiber | null = null;
let deletions: Fiber[] = [];
let wipFiber: Fiber | null = null;
let hookIndex = 0;
let pendingEffects: EffectHook[] = [];   // collected during render
let scheduledEffects: EffectHook[] = []; // committed, waiting to run after paint
let updatePending = false;

export function render(element: VNode, container: Element) {
  beginRender(container, { children: [element] }, null);
  scheduleWork();
}

function beginRender(dom: Node, props: Props, alternate: Fiber | null) {
  flushPassiveEffects(); // like React: finish the previous commit's effects before rendering again
  wipRoot = { type: null, key: null, props, dom, parent: null, child: null, sibling: null, alternate, flags: 0, hooks: [] };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

function scheduleUpdate() {
  updatePending = true; // batched: many setState calls in one task → one render
  scheduleWork();
}

// ---------------------------------------------------------------- scheduler (time slicing)
const channel = new MessageChannel();
let workScheduled = false;
channel.port1.onmessage = () => { workScheduled = false; workLoop(); };
function scheduleWork() {
  if (!workScheduled) { workScheduled = true; channel.port2.postMessage(null); }
}

function workLoop() {
  if (!wipRoot && updatePending && currentRoot) {    // start a re-render from the committed tree
    updatePending = false;
    beginRender(currentRoot.dom!, currentRoot.props, currentRoot);
  }
  const deadline = performance.now() + 5;            // ~5 ms slices, like React's scheduler
  while (nextUnitOfWork && performance.now() < deadline) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  if (nextUnitOfWork) { scheduleWork(); return; }     // yield to the browser; continue next task
  if (wipRoot) commitRoot();
  if (updatePending) scheduleWork();                  // updates arrived mid-render: render again
}

// ---------------------------------------------------------------- render phase
function performUnitOfWork(fiber: Fiber): Fiber | null {
  if (typeof fiber.type === 'function') updateFunctionComponent(fiber);
  else updateHostComponent(fiber);
  if (fiber.child) return fiber.child;                // go down
  let next: Fiber | null = fiber;
  while (next) {                                      // then sideways, then up
    if (next.sibling) return next.sibling;
    next = next.parent;
  }
  return null;
}

function updateFunctionComponent(fiber: Fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  fiber.hooks = [];
  const output = (fiber.type as Component)(fiber.props);
  reconcileChildren(fiber, normalize([output]));
  wipFiber = null;
}

function updateHostComponent(fiber: Fiber) {
  if (!fiber.dom) fiber.dom = createDom(fiber);       // created detached; attached during commit
  reconcileChildren(fiber, fiber.props.children);
}

function createDom(fiber: Fiber): Node {
  const dom = fiber.type === TEXT ? document.createTextNode('') : document.createElement(fiber.type as string);
  updateDom(dom, { children: [] }, fiber.props);
  return dom;
}

const isEvent = (k: string) => k.startsWith('on');
const isProperty = (k: string) => k !== 'children' && !isEvent(k);

function updateDom(dom: Node, prev: Props, next: Props) {
  const el = dom as any;
  for (const k of Object.keys(prev)) {
    if (isEvent(k) && prev[k] !== next[k]) el.removeEventListener(k.slice(2).toLowerCase(), prev[k]);
    if (isProperty(k) && !(k in next)) el[k] = '';
  }
  for (const k of Object.keys(next)) {
    if (isProperty(k) && prev[k] !== next[k]) el[k] = next[k];
    if (isEvent(k) && prev[k] !== next[k]) el.addEventListener(k.slice(2).toLowerCase(), next[k]);
  }
}

// Keyed reconciliation: match new elements to old fibers by key (or position).
function reconcileChildren(parent: Fiber, elements: VNode[]) {
  const previous = new Map<string, Fiber>();
  let old = parent.alternate?.child ?? null;
  for (let i = 0; old; i++, old = old.sibling) previous.set(old.key ?? `#${i}`, old);

  let prevSibling: Fiber | null = null;
  elements.forEach((element, i) => {
    const id = element.key ?? `#${i}`;
    const match = previous.get(id);
    const reusable = match !== undefined && match.type === element.type; // same key + same type
    if (reusable) previous.delete(id);
    const fiber: Fiber = {
      type: element.type, key: element.key, props: element.props,
      dom: reusable ? match.dom : null,
      parent, child: null, sibling: null,
      alternate: reusable ? match : null,
      flags: reusable ? UPDATE : 0,
      hooks: [],
    };
    if (prevSibling) prevSibling.sibling = fiber; else parent.child = fiber;
    prevSibling = fiber;
  });
  previous.forEach((f) => deletions.push(f));         // unmatched old fibers are deleted
}

// ---------------------------------------------------------------- commit phase (synchronous)
function commitRoot() {
  const root = wipRoot!;
  deletions.forEach(commitDeletion);
  commitFiber(root);
  currentRoot = root;
  wipRoot = null;
  scheduledEffects = pendingEffects;
  pendingEffects = [];
  setTimeout(flushPassiveEffects);                    // passive effects run after the browser paints
}

function commitFiber(fiber: Fiber) {
  if (fiber.dom && fiber.alternate && fiber.flags & UPDATE) updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  fiber.alternate = null;                             // drop the previous generation
  for (let c = fiber.child; c; c = c.sibling) commitFiber(c);
  if (fiber.dom && fiber.type !== TEXT) placeChildren(fiber.dom, hostChildren(fiber));
}

function hostChildren(fiber: Fiber): Node[] {
  const out: Node[] = [];
  for (let c = fiber.child; c; c = c.sibling) {
    if (c.dom) out.push(c.dom); else out.push(...hostChildren(c)); // look through components
  }
  return out;
}

// Make the parent's DOM children match the fiber order: inserts new nodes, moves existing ones.
function placeChildren(parentDom: Node, nodes: Node[]) {
  let cursor = parentDom.firstChild;
  for (const node of nodes) {
    if (node === cursor) { cursor = cursor.nextSibling; continue; }
    parentDom.insertBefore(node, cursor);
  }
}

function commitDeletion(fiber: Fiber) {
  runEffectCleanups(fiber);
  for (const node of fiber.dom ? [fiber.dom] : hostChildren(fiber)) node.parentNode?.removeChild(node);
}

function runEffectCleanups(fiber: Fiber) {
  for (const hook of fiber.hooks) if (hook.kind === 'effect' && typeof hook.cleanup === 'function') hook.cleanup();
  for (let c = fiber.child; c; c = c.sibling) runEffectCleanups(c);
}

function flushPassiveEffects() {
  const effects = scheduledEffects;
  scheduledEffects = [];
  for (const e of effects) if (typeof e.cleanup === 'function') e.cleanup(); // all cleanups first
  for (const e of effects) e.cleanup = e.create();                            // then all setups
}

// ---------------------------------------------------------------- hooks
function nextHook<T extends Hook>(): T | undefined {
  return wipFiber!.alternate?.hooks[hookIndex] as T | undefined; // same call order every render
}

function pushHook(hook: Hook) {
  wipFiber!.hooks.push(hook);
  hookIndex++;
}

export function useState<S>(initial: S | (() => S)): [S, (action: S | ((prev: S) => S)) => void] {
  const old = nextHook<StateHook>();
  const queue = old ? old.queue : { pending: [] as unknown[] };
  let state = old ? old.state : typeof initial === 'function' ? (initial as () => S)() : initial;
  for (const action of queue.pending.splice(0)) {
    state = typeof action === 'function' ? (action as (prev: unknown) => unknown)(state) : action;
  }
  const setState = old ? old.setState : (action: unknown) => { queue.pending.push(action); scheduleUpdate(); };
  pushHook({ kind: 'state', state, queue, setState });
  return [state as S, setState as (action: S | ((prev: S) => S)) => void];
}

export function useEffect(create: () => void | (() => void), deps?: unknown[]) {
  const old = nextHook<EffectHook>();
  const changed = !old || !deps || !old.deps || deps.length !== old.deps.length
    || deps.some((d, i) => !Object.is(d, old.deps![i]));
  const hook: EffectHook = { kind: 'effect', deps, create, cleanup: old?.cleanup };
  if (changed) pendingEffects.push(hook);
  pushHook(hook);
}

export function useRef<T>(initial: T): { current: T } {
  const old = nextHook<RefHook>();
  const hook: RefHook = old ?? { kind: 'ref', ref: { current: initial } };
  pushHook(hook);
  return hook.ref as { current: T };
}

export function useMemo<T>(compute: () => T, deps: unknown[]): T {
  const old = nextHook<MemoHook>();
  const same = old !== undefined && deps.length === old.deps.length && deps.every((d, i) => Object.is(d, old.deps[i]));
  const hook: MemoHook = same ? old : { kind: 'memo', deps, value: compute() };
  pushHook(hook);
  return hook.value as T;
}
```

### `test/mini-react.test.ts`

```ts

// The chapter's test suite, in full: batching, effects and cleanup, keyed reconciliation, unmounting
import { describe, expect, it } from 'vitest';
import { createElement as h, render, useEffect, useMemo, useRef, useState } from '../src/mini-react.ts';

const settle = () => new Promise((resolve) => setTimeout(resolve, 80)); // let the work loop finish and effects run
const log: string[] = [];
let counterRenders = 0;
let setItems: (next: string[]) => void = () => {};
let setShow: (next: boolean) => void = () => {};

function Counter() {
  const [count, setCount] = useState(0);
  const renders = useRef(0);
  renders.current++;
  counterRenders = renders.current;
  const doubled = useMemo(() => count * 2, [count]);
  useEffect(() => {
    log.push(`effect ${count}`);
    return () => log.push(`cleanup ${count}`);
  }, [count]);
  return h('button', { id: 'btn', onClick: () => { setCount((c: number) => c + 1); setCount((c: number) => c + 1); } },
    `count ${count} doubled ${doubled}`);
}

function Row({ label }: { label: string }) {
  return h('li', null, h('input', { value: label }));
}

function List() {
  const [items, set] = useState(['a', 'b', 'c', 'd']);
  setItems = set;
  return h('ul', { id: 'list' }, items.map((id: string) => h(Row, { key: id, label: id })));
}

function App() {
  const [show, set] = useState(true);
  setShow = set;
  return h('div', null, show ? h(Counter, null) : null, h(List, null));
}

const btn = () => document.getElementById('btn')!;
const lis = () => [...document.querySelectorAll('#list > li')] as HTMLElement[];
const values = () => lis().map((li) => (li.firstChild as HTMLInputElement).value);

describe('mini-react', () => {
  it('renders, and runs the first effect after commit', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    render(h(App, null), document.getElementById('root')!);
    await settle();
    expect(btn().textContent).toBe('count 0 doubled 0');
    expect(log).toEqual(['effect 0']);
  });

  it('batches two updater calls into one render, applied in order', async () => {
    const before = counterRenders;
    btn().dispatchEvent(new Event('click'));
    await settle();
    expect(btn().textContent).toBe('count 2 doubled 4');
    expect(counterRenders).toBe(before + 1);
    expect(log).toEqual(['effect 0', 'cleanup 0', 'effect 2']);
  });

  it('moves DOM nodes with their keys instead of recreating them', async () => {
    const [liA, , , liD] = lis();
    (liA.firstChild as HTMLInputElement).dataset.marker = 'A';
    setItems(['d', 'a', 'b', 'c']);
    await settle();
    expect(lis()[0]).toBe(liD);
    expect(lis()[1]).toBe(liA);
    expect((lis()[1].firstChild as HTMLInputElement).dataset.marker).toBe('A');
    expect(values()).toEqual(['d', 'a', 'b', 'c']);
  });

  it('inserts and deletes keyed children', async () => {
    setItems(['d', 'x', 'b']);
    await settle();
    expect(values()).toEqual(['d', 'x', 'b']);
  });

  it('runs the latest cleanup on unmount', async () => {
    setShow(false);
    await settle();
    expect(document.getElementById('btn')).toBeNull();
    expect(log).toEqual(['effect 0', 'cleanup 0', 'effect 2', 'cleanup 2']);
  });
});
```

### `package.json`

```json
{
  "name": "handbook-11-build-your-own-react",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "devDependencies": {
    "jsdom": "31.0.1",
    "typescript": "6.0.3",
    "vite": "8.3.8",
    "vitest": "5.1.2"
  }
}
```

### `index.html`

```html

<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>mini-react</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/Todos.tsx"></script>
  </body>
</html>
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
    "jsx": "react",
    "jsxFactory": "createElement"
  },
  "include": [
    "src",
    "test"
  ]
}
```

### `vite.config.ts`

```ts

import { defineConfig } from 'vite';

// The example uses the classic JSX runtime with mini-react's createElement (see the pragmas in Todos.tsx)
export default defineConfig({
  oxc: { jsx: { runtime: 'classic', pragma: 'createElement' } },
});
```

### `vitest.config.ts`

```ts

import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom' } });
```

---

[← Previous: E03 — mapLimit: bounded concurrency](E03-javascript-runtime-and-engine.md) · [Chapter 11](11-build-your-own-react.md) · [Index](README.md) · [Next: E12 — useLocalStorageState: an external store done right →](E12-hooks-in-depth.md)
