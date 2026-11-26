# A1 — React API Reference Tables

> A reference you can trust is one that was checked against the thing it describes. Every export listed here was read from the published npm packages, not from memory.

**Prerequisites:** none · **Related:** [09 React Fundamentals: Complete Reference](09-react-fundamentals-complete-reference.md) · [12 Hooks in Depth](12-hooks-in-depth.md) · [16 React 19 Features and the Compiler](16-react-19-features-and-the-compiler.md) · [A2 Version History](A2-react-version-history-and-governance.md) · [A4 Experimental and Canary APIs](A4-experimental-and-canary-apis.md)

> [!NOTE]
> *Verified* on 25 November 2026: I installed `react` and `react-dom` at 18.3.1, 19.0.0, 19.1.0, 19.2.0, 19.3.1, `canary` (19.3.0-canary-92bb0678-20261124) and `experimental` (0.0.0-experimental-92bb0678-20261124) side by side, and listed the exports of each entry point in production and development builds, and under the `react-server` condition. Internal exports (`__…_DO_NOT_USE…`) are left out of the tables.

---

## TL;DR

- **`react` 19.3.1 has 44 production exports** (42 public), plus `act` and `captureOwnerStack` in development builds. **`react-dom` has 15**, `react-dom/client` 3, `react-dom/server` 7 and `react-dom/static` 5.
- **The canary channel exported exactly what 19.3.1 does** on the day of the check. The experimental channel adds six exports to `react` and more under `react-server`; see [A4](A4-experimental-and-canary-apis.md).
- **Labels:** *Stable* means a stable release; *Deprecated* still works and warns or is scheduled for removal; *Unstable* (`unstable_` prefix) can change in any release; *Dev only* doesn't exist in production builds.
- **"Since" is the first stable version that exported the API** in its current form.

---

## 1. `react`: components

| Component | Since | What it does | Notes | Chapter |
|---|---|---|---|---|
| `<Fragment>` (`<>`) | 16.2 | Groups children without a DOM node | Accepts `key`; Fragment refs are stable since 19.3 | [09](09-react-fundamentals-complete-reference.md) |
| `<StrictMode>` | 16.3 | Development checks: double render, double effects, double ref callbacks | 19.3 also double-invokes effects during hydration | [13](13-effects-and-synchronization.md) |
| `<Profiler>` | 16.9 (earlier as `unstable_Profiler`) | Measures rendering cost of a subtree (`onRender`) | Needs a profiling build in production | [20](20-react-tooling-devtools-and-debugging.md) |
| `<Suspense>` | 16.6 | Shows a fallback while children aren't ready | Data with `use`, lazy code, streaming SSR boundaries | [15](15-concurrent-react-suspense-and-transitions.md) |
| `<Activity>` | 19.2 | Hides UI while keeping its state (`mode="hidden"`) | Effects are cleaned up while hidden; low-priority pre-rendering | [16](16-react-19-features-and-the-compiler.md) |
| `<ViewTransition>` | 19.3 | Animates changes with the View Transitions API | Animates transitions, Suspense reveals and deferred values; DOM only | [16](16-react-19-features-and-the-compiler.md), [24](24-animation-and-motion-systems.md) |

---

## 2. `react`: hooks

| Hook | Since | Purpose | Watch out for | Chapter |
|---|---|---|---|---|
| `useState` | 16.8 | Local state | Functional updates when the next state depends on the previous | [12](12-hooks-in-depth.md) |
| `useReducer` | 16.8 | State with explicit transitions | Keep reducers pure | [12](12-hooks-in-depth.md) |
| `useContext` | 16.8 | Read a context | Every consumer re-renders when the value changes; `use(Context)` also works | [29](29-client-state-management.md) |
| `useRef` | 16.8 | A mutable box that persists across renders | Don't read or write `.current` during render; the argument is required in `@types/react` 19 | [14](14-refs-dom-portals-and-imperative-apis.md) |
| `useEffect` | 16.8 | Synchronise with an external system after commit | Not for derived state or most data fetching | [13](13-effects-and-synchronization.md) |
| `useLayoutEffect` | 16.8 | Measure or mutate the DOM before paint | Blocks paint | [13](13-effects-and-synchronization.md) |
| `useInsertionEffect` | 18.0 | Inject styles before layout effects | For CSS-in-JS libraries | [13](13-effects-and-synchronization.md) |
| `useMemo` | 16.8 | Cache a computed value | Mostly automatic with the Compiler | [12](12-hooks-in-depth.md) |
| `useCallback` | 16.8 | Cache a function's identity | Mostly automatic with the Compiler | [12](12-hooks-in-depth.md) |
| `useImperativeHandle` | 16.8 | Customise what a ref exposes | With `ref` as a prop in 19, no `forwardRef` needed | [14](14-refs-dom-portals-and-imperative-apis.md) |
| `useDebugValue` | 16.8 | A label for custom hooks in DevTools | Development aid only | [20](20-react-tooling-devtools-and-debugging.md) |
| `useId` | 18.0 | Stable IDs that match between server and client | Format changed (`_r_` since 19.2); never parse it | [12](12-hooks-in-depth.md) |
| `useSyncExternalStore` | 18.0 | Subscribe to an external store without tearing | `getSnapshot` must return a cached value | [29](29-client-state-management.md) |
| `useTransition` | 18.0 | Mark updates as interruptible; `isPending` | Async functions become Actions in 19 | [15](15-concurrent-react-suspense-and-transitions.md) |
| `useDeferredValue` | 18.0 | A lagging copy of a value for expensive UI | An initial value argument since 19.0 | [15](15-concurrent-react-suspense-and-transitions.md) |
| `use` | 19.0 | Read a promise (suspends) or a context | May be called conditionally; promises must be cached | [16](16-react-19-features-and-the-compiler.md) |
| `useActionState` | 19.0 | State updated by an Action, with pending state | Replaces `ReactDOM.useFormState` | [16](16-react-19-features-and-the-compiler.md), [26](26-forms-and-validation.md) |
| `useOptimistic` | 19.0 | Optimistic state while an Action is pending | Reverts to real state when the Action ends | [16](16-react-19-features-and-the-compiler.md) |
| `useEffectEvent` | 19.2 | Read the latest props and state inside effects without re-running them | Call only from effects | [13](13-effects-and-synchronization.md) |
| `unstable_useCacheRefresh` | 19.0 (unstable) | Refresh a `cache()` scope | Unstable prefix | [A4](A4-experimental-and-canary-apis.md) |

---

## 3. `react`: other APIs

| API | Since | Purpose | Notes |
|---|---|---|---|
| `createElement`, `cloneElement`, `isValidElement` | 0.x | Create, copy and check elements | JSX compiles to `jsx()` from `react/jsx-runtime` instead of `createElement` |
| `Children` | 0.x | Utilities for `props.children` | Prefer explicit props or arrays; `Children` doesn't see into components |
| `Component`, `PureComponent` | 0.13 (ES classes); `PureComponent` 15.3 | Class components | Still needed for error boundaries ([19](19-class-components-lifecycles-and-legacy-apis.md)) |
| `createContext` | 16.3 | Create a context | Render `<Context value>` directly as a provider since 19.0 |
| `createRef` | 16.3 | A ref object for class components | `useRef` in function components |
| `forwardRef` | 16.3 | Pass a ref through a function component | Unnecessary in 19 (`ref` is a prop); still works |
| `memo` | 16.6 | Skip re-rendering when props are shallowly equal | Still useful for list rows with the Compiler ([71](71-case-study-legacy-react-modernization.md)) |
| `lazy` | 16.6 | Code-split a component | Inside a Suspense boundary |
| `startTransition` | 18.0 | Mark updates as transitions outside components | Accepts async functions (Actions) since 19 |
| `cache` | 19.0 | Deduplicate work within one server request | Server Components only; per request, not across requests |
| `cacheSignal` | 19.2 | An `AbortSignal` for the current `cache()` lifetime | Server Components |
| `addTransitionType` | 19.3 | Label a transition so CSS can choose its animation | Used with `<ViewTransition>` and `:active-view-transition-type()` |
| `captureOwnerStack` | 19.1 (dev only) | The stack of components that rendered the current one | Exported by development builds of `react` and by the `react-server` build; guard calls with a development check |
| `act` | 18.3 in `react` | Flush updates and effects in tests | The `react-dom/test-utils` version was removed in 19; absent from production builds since 19.1 |
| `version` | — | The React version string | |

Subpath entry points:

| Entry | Exports | Notes |
|---|---|---|
| `react/jsx-runtime`, `react/jsx-dev-runtime` | `jsx`, `jsxs`, `Fragment` (and `jsxDEV`) | The JSX transform's target; required since 19 |
| `react/compiler-runtime` | `c` (the memo cache) | What React Compiler output imports; older React needs `react-compiler-runtime` |

---

## 4. `react-dom`

| API | Since | Purpose | Notes |
|---|---|---|---|
| `createPortal` | 16.0 | Render children into another DOM node | Events bubble through the React tree |
| `flushSync` | 16.x | Apply an update synchronously | For measuring the DOM right after an update; use sparingly |
| `unstable_batchedUpdates` | 15.x | Batch updates outside React events | Unnecessary since 18's automatic batching; kept for compatibility |
| `preconnect`, `prefetchDNS` | 19.0 | Hint connections to origins you'll use | Become `<link>` tags during SSR |
| `preload`, `preloadModule` | 19.0 | Fetch a resource (or ES module) early | |
| `preinit`, `preinitModule` | 19.0 | Fetch and evaluate a script or stylesheet (or module) | |
| `useFormStatus` | 19.0 | Pending state and data of the enclosing `<form>` | Call from a component inside the form |
| `requestFormReset` | 19.0 | Reset a form after an Action, as React does automatically | 19.3 fires `onReset` on automatic resets |
| `browser` | 19.3 | `use(browser())` suspends on the server only, so the fallback goes into the HTML | Server option `onBrowserBailout` reports it |
| `useFormState` | 19.0 | — | *Deprecated*: renamed `useActionState` in `react` |
| `version` | — | The version string | |

Built-in elements with React-specific behaviour:

| Element | Behaviour | Since |
|---|---|---|
| `<form action={fn}>`, `formAction` on buttons and inputs | The function runs as an Action; uncontrolled fields reset on success | 19.0 |
| `<title>`, `<meta>`, `<link>` anywhere in the tree | Hoisted into `<head>` | 19.0 |
| `<link rel="stylesheet" precedence>` | Ordered by precedence, deduplicated; Suspense waits for it | 19.0 |
| `<style href precedence>` | Inline styles hoisted and deduplicated | 19.0 |
| `<script async>` | Deduplicated, hoisted during SSR | 19.0 |
| Custom elements | Properties set as properties, not attributes, when the element defines them | 19.0 |

---

## 5. `react-dom/client`

| API | Since | Purpose | Options and notes |
|---|---|---|---|
| `createRoot(container, options?)` | 18.0 | A concurrent root for client rendering | `onCaughtError`, `onUncaughtError` (19.0), `onRecoverableError`, `identifierPrefix` |
| `hydrateRoot(container, element, options?)` | 18.0 | Attach to server-rendered HTML | Same options; hydration errors show a diff since 19.0 |
| `version` | 19.0 | The version string | |

---

## 6. `react-dom/server`

The Node entry point exports all of these; edge and browser builds export the web-stream APIs.

| API | Since | Output | Use for |
|---|---|---|---|
| `renderToPipeableStream` | 18.0 | Node stream with Suspense streaming | Node servers |
| `renderToReadableStream` | 18.0 (web), 19.2 (Node) | Web `ReadableStream` | Edge runtimes; Node since 19.2 |
| `renderToString` | 0.x | A string; no streaming, limited Suspense | Legacy and simple cases |
| `renderToStaticMarkup` | 0.x | A string without React's attributes | Emails, static fragments; not hydratable |
| `resume` / `resumeToPipeableStream` | 19.2 | Continue a prerendered shell (partial prerendering) | Frameworks implementing PPR |

Removed in 19: `renderToNodeStream` and `renderToStaticNodeStream`.

---

## 7. `react-dom/static`

| API | Since | Purpose |
|---|---|---|
| `prerenderToNodeStream` | 19.0 | Render to static HTML, waiting for all data (Node streams) |
| `prerender` | 19.2 (Node) | The web-streams version |
| `resumeAndPrerenderToNodeStream`, `resumeAndPrerender` | 19.0 and 19.2 in the Node entry | Prerender the rest of a postponed render |

---

## 8. Server Components (`react-server` condition)

Under the `react-server` export condition, `react` exposes a smaller surface: no state, effects or context creation.

| Available in Server Components (19.3.1) | Not available |
|---|---|
| `Activity`, `Children`, `Fragment`, `Profiler`, `StrictMode`, `Suspense`, `ViewTransition` | `useState`, `useReducer`, `useEffect` and other stateful hooks |
| `cache`, `cacheSignal`, `captureOwnerStack`, `use` | `createContext` (a Server Component can render a client-module `<Context>` since 19.3) |
| `cloneElement`, `createElement`, `createRef`, `forwardRef`, `isValidElement`, `lazy`, `memo` | `Component`, `PureComponent` |
| `useCallback`, `useDebugValue`, `useId`, `useMemo`, `version` | `startTransition` (experimental builds only) |

Directives:

| Directive | Where | Meaning |
|---|---|---|
| `'use client'` | Top of a module | A client boundary: this module and its imports are client code |
| `'use server'` | Top of a module or an async function | Server Functions callable from the client; each one is a public endpoint |
| `'use memo'` | First statement of a function | Opt in to the Compiler in annotation mode |
| `'use no memo'` | First statement of a function | Opt out of the Compiler |

---

## 9. Removed and deprecated APIs

| API | Status | Replacement | Chapter |
|---|---|---|---|
| `ReactDOM.render`, `hydrate`, `unmountComponentAtNode` | Removed in 19.0 | `createRoot`, `hydrateRoot`, `root.unmount()` | [64](64-migration-playbooks.md) |
| `findDOMNode` | Removed in 19.0 | A ref on the element | [19](19-class-components-lifecycles-and-legacy-apis.md) |
| `unstable_renderSubtreeIntoContainer` | Removed in 19.0 | Portals | |
| String refs | Removed in 19.0 | `useRef`, `createRef`, ref callbacks | [71](71-case-study-legacy-react-modernization.md) |
| Legacy context (`contextTypes`, `childContextTypes`, `getChildContext`) | Removed in 19.0 | `createContext` | [71](71-case-study-legacy-react-modernization.md) |
| `createFactory`, module pattern factories | Removed in 19.0 | JSX | |
| PropTypes checks, `defaultProps` on function components | Removed in 19.0 | TypeScript; default parameters | |
| `react-dom/test-utils` | Removed in 19.0 | `act` from `react`; Testing Library | [42](42-testing-architecture.md) |
| `react-test-renderer/shallow` | Removed in 19.0 | Testing Library | |
| UMD builds | Removed in 19.0 | ES modules from a CDN | |
| `ReactDOM.useFormState` | Deprecated (still exported in 19.3.1) | `useActionState` | |
| `element.ref` | Deprecated | `element.props.ref` | |
| `react-test-renderer` | Deprecated | Testing Library | |
| `forwardRef` | Still exported; unnecessary for function components | `ref` as a prop | |

---

## 10. What changed between versions (*verified*)

Production builds, compared release to release:

| Step | `react` | `react-dom` | Server and static |
|---|---|---|---|
| 18.3.1 → 19.0.0 | + `cache`, `use`, `useActionState`, `useOptimistic`, `unstable_useCacheRefresh`; − `createFactory`, `unstable_act` | + `preconnect`, `prefetchDNS`, `preinit`, `preinitModule`, `preload`, `preloadModule`, `requestFormReset`, `useFormStatus`, `useFormState`; − `render`, `hydrate`, `unmountComponentAtNode`, `findDOMNode`, `unstable_renderSubtreeIntoContainer`, and `createRoot`/`hydrateRoot` from the main entry | − `renderToNodeStream`, `renderToStaticNodeStream`; new `react-dom/static` entry |
| 19.0 → 19.1 | `act` no longer in production builds (still in development) | — | — |
| 19.1 → 19.2 | + `Activity`, `cacheSignal`, `useEffectEvent` | — | + `renderToReadableStream` on Node, `resume`, `resumeToPipeableStream`, `prerender`, `resumeAndPrerender` |
| 19.2 → 19.3.1 | + `ViewTransition`, `addTransitionType` | + `browser` | — |
| 19.3.1 → canary | No difference | No difference | No difference |
| 19.3.1 → experimental | + `optimisticKey`, `unstable_SuspenseList`, `unstable_startGestureTransition`, `unstable_getCacheForType`, and the aliases `unstable_Activity`, `experimental_useOptimistic` | No difference | See [A4](A4-experimental-and-canary-apis.md) |

To repeat the check for a new release:

```js
// exports.cjs: list the exports of each entry point for an installed React version
const { createRequire } = require('module');
const req = createRequire(require('path').join(process.cwd(), 'index.js'));
for (const entry of ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'react-dom/static']) {
  try { console.log(entry, Object.keys(req(entry)).sort().join(', ')); } catch { console.log(entry, '(not present)'); }
}
// NODE_ENV=production node exports.cjs        (and NODE_ENV=development for dev-only exports)
// NODE_ENV=production node --conditions=react-server exports.cjs   (the Server Components surface)
```

---

## Pitfalls

- **Trusting autocomplete over the version you ship.** Types can lag or lead the runtime; check the installed package.
- **Using `act` in production code.** It isn't in production builds.
- **Importing from `react-dom` what lives in `react-dom/client`.** `createRoot` moved out of the main entry in 19.
- **`unstable_` and `experimental_` APIs in libraries.** They can change in any release, including patches.
- **Assuming canary is "the next stable".** Usually close, but frameworks pin specific canaries; check what yours ships.

---

## Further reading

- [react.dev API reference](https://react.dev/reference/react): every hook, component and API.
- [react-dom reference](https://react.dev/reference/react-dom) and [server APIs](https://react.dev/reference/react-dom/server).
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide): the removals in section 9.
- [Rules of React](https://react.dev/reference/rules).

---

[← Previous: 79 — Distributed Systems Design for Frontend Architects](79-distributed-systems-design-for-frontend-architects.md) · [Index](README.md) · [Next: A2 — React Version History, Release Channels and Governance →](A2-react-version-history-and-governance.md)
