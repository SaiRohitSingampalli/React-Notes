# 73 — Interview Question Bank

> A good answer to an interview question has three parts: what's true, why it's true, and when it stops being true. Most candidates stop after the first.

**Prerequisites:** none; each answer links to the chapter that covers it in depth · **Related:** [66 Frontend System Design](66-frontend-system-design.md) · [72 The Principal Frontend Engineer](72-the-principal-frontend-engineer.md) · [74 Machine-Coding Drills](74-machine-coding-drills.md)

---

## TL;DR

- **233 questions with model answers,** grouped by topic, from browser fundamentals to architecture leadership. Each answer ends with a link to the chapter that goes deeper.
- **Answers are short on purpose.** They're what a strong candidate says in the first minute. The linked chapter is what they'd say if the interviewer kept asking "why?".
- **Versions are as of November 2026:** React 19.3, Next.js 16.4, Angular 22.3, Vite 8, TypeScript 6.0 and 7.0.
- **Practise out loud.** Cover the answer, say yours, then compare. If yours has no "it depends on…", add one.
- **Staff-plus interviews care about the "when it stops being true" part.** Many answers here end with a caveat for that reason.

## How to use this chapter

| If you have | Do this |
|---|---|
| One evening | Sections 2, 6, 8 and 15: the questions most loops ask |
| A week | One section a day, out loud, then the linked chapters for any answer you couldn't give |
| A specific loop | Match the sections to the rounds in [72](72-the-principal-frontend-engineer.md) §12 |

---

## 1. JavaScript, TypeScript and the browser

**1. What happens between typing a URL and seeing pixels?**
DNS lookup, a connection (TCP and TLS, or QUIC for HTTP/3), the request, and a streamed response. The browser parses HTML into the DOM as bytes arrive, while the preload scanner fetches resources it spots ahead. CSS becomes the CSSOM; together they form the render tree, then layout, paint and compositing. Classic scripts block parsing unless they're `async`, `defer` or modules. → [02](02-browser-rendering-pipeline.md), [05](05-networking-caching-and-delivery.md)

**2. Explain the event loop.**
Run one task (a script, an event handler, a timer callback), then drain the microtask queue (promise reactions, `queueMicrotask`), then, if it's time for a frame, run `requestAnimationFrame` callbacks, style, layout and paint. Repeat. Anything that keeps a task running blocks input and rendering. → [03](03-javascript-runtime-and-engine.md)

**3. Why does a resolved promise's callback run before `setTimeout(fn, 0)`?**
Promise reactions are microtasks, drained right after the current task. A timer callback is a new task, so it waits for the next loop iteration, and browsers clamp deeply nested timers to at least 4 ms. → [03](03-javascript-runtime-and-engine.md)

**4. What is a long task, and how do you break one up?**
A task over 50 ms. During one, input waits, which is what makes INP bad. Break work into chunks that yield back to the event loop: `scheduler.yield()` where it's supported (it resumes ahead of other queued tasks), `setTimeout` otherwise, or move the work to a Web Worker. In React, transitions do this for rendering. → [03](03-javascript-runtime-and-engine.md), [39](39-web-performance-and-core-web-vitals.md)

**5. What is layout thrashing?**
Interleaving DOM writes and layout reads (`offsetHeight`, `getBoundingClientRect`) in a loop, which forces a synchronous layout on every read. Batch all reads, then all writes, or move the reads into `requestAnimationFrame`. → [02](02-browser-rendering-pipeline.md)

**6. Which CSS properties animate cheaply, and why?**
`transform` and `opacity`, because the compositor can animate them on its own layer without layout or paint. Animating `width`, `top` or `box-shadow` triggers layout or paint every frame. `will-change` promotes a layer in advance; use it sparingly, since every layer costs memory. → [02](02-browser-rendering-pipeline.md), [24](24-animation-and-motion-systems.md)

**7. What is a stale closure, and how does it show up in React?**
A function keeps the variables from the scope it was created in. A callback created in one render sees that render's props and state forever, so a timer or subscription set up once keeps reading old values. Fix it with the right effect dependencies, a functional state update, a ref, or `useEffectEvent`. → [03](03-javascript-runtime-and-engine.md), [13](13-effects-and-synchronization.md)

**8. How do memory leaks happen in long-lived single-page apps?**
Listeners and subscriptions that are never removed, timers that keep closures alive, unbounded caches, and detached DOM nodes still referenced from JavaScript. Find them with heap snapshots compared over time. Effect cleanups, `AbortController` and `WeakMap` for metadata prevent most of them. → [03](03-javascript-runtime-and-engine.md), [41](41-observability-and-diagnostics.md)

**9. ES modules versus CommonJS: why does it matter for frontend builds?**
ES module imports are static, so bundlers can tree-shake unused exports, and bindings are live. CommonJS `require` is dynamic and evaluated at run time, which defeats most tree-shaking. Packages that ship both formats can load twice (the dual-package hazard). Modern packages should ship ESM with an `exports` map. → [60](60-monorepos-build-tooling-and-bundlers.md)

**10. What does "structural typing" mean in TypeScript?**
Compatibility is decided by shape, not by declared name: any object with the right properties fits. It makes adapters and mocks easy, but two unrelated IDs that are both `string` are interchangeable. Branded types (`string & { __brand: 'UserId' }`) restore the distinction where it matters. → [04](04-typescript-at-scale.md)

**11. `any`, `unknown` and `never`?**
`any` turns type checking off. `unknown` means "could be anything; prove it before use", which is the right type for parsed JSON and caught errors. `never` is the type with no values, used for exhaustiveness checks in `switch` statements over unions. → [04](04-typescript-at-scale.md)

**12. How do discriminated unions help UI code?**
Model state as `{ status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T }`, and impossible combinations (data and an error at once) can't be represented. TypeScript narrows on `status`, and an exhaustive `switch` catches new states at compile time. → [04](04-typescript-at-scale.md), [28](28-state-and-data-ownership-architecture.md)

**13. What does `satisfies` add over a type annotation?**
It checks a value against a type without widening the value's inferred type. A config object `satisfies Record<Route, Config>` is checked for completeness but keeps its literal keys for autocompletion and narrowing. → [04](04-typescript-at-scale.md)

**14. What's the state of TypeScript 7?**
TypeScript 7.0 is the native (Go) port of the compiler, with much faster type checking. Many tools that use the compiler's JavaScript API still depend on TypeScript 6.0, so in November 2026 projects often run both: TS 7 for checking speed, TS 6 for tooling compatibility. → [04](04-typescript-at-scale.md), [60](60-monorepos-build-tooling-and-bundlers.md)

**15. How should a frontend set HTTP caching headers?**
Hashed static assets: `Cache-Control: public, max-age=31536000, immutable`. HTML: `no-cache` (revalidate every time) or a short `s-maxage` with `stale-while-revalidate` at the CDN. API responses: decide per endpoint, and never cache personalised responses in a shared cache without `private` or a correct `Vary`. → [05](05-networking-caching-and-delivery.md)

**16. What does HTTP/3 change?**
It runs over QUIC on UDP, so one lost packet no longer stalls every stream on the connection (TCP head-of-line blocking), and connection setup takes fewer round trips. Multiplexing already existed in HTTP/2. 103 Early Hints lets a server start preloads before the main response is ready. → [05](05-networking-caching-and-delivery.md)

**17. What does CORS protect, and what doesn't it?**
It stops a page from *reading* cross-origin responses unless the server allows it. It doesn't stop the request from being sent, so it is not CSRF protection. Preflights (`OPTIONS`) happen for non-simple requests. Credentialed requests need `Access-Control-Allow-Credentials` and an explicit origin, never `*`. → [43](43-frontend-security-architecture.md)

**18. What goes wrong with service workers?**
The update lifecycle: a new worker waits until every tab using the old one closes, so users can run an old app shell for days. Cache-first HTML is the classic outage. Version the caches, use network-first for HTML, show an "update available" prompt, and keep a kill switch that unregisters the worker. → [06](06-modern-web-platform-apis.md)

**19. When should work move to a Web Worker?**
When it's CPU-heavy and doesn't need the DOM: parsing large files, search indexing, diffing, image processing, cryptography. Transfer `ArrayBuffer`s instead of copying them. Workers don't help with rendering cost; that's React's job (transitions, memoization, virtualization). → [06](06-modern-web-platform-apis.md)

**20. What are View Transitions, and how does React use them?**
The browser snapshots the old and new UI and animates between them, both within a document (`document.startViewTransition`) and across navigations. React 19.3 made `<ViewTransition>` stable: it animates UI that changes inside transitions, Suspense reveals and `useDeferredValue` updates, and `addTransitionType` lets CSS pick an animation per kind of change. → [06](06-modern-web-platform-apis.md), [24](24-animation-and-motion-systems.md), [16](16-react-19-features-and-the-compiler.md)

---

## 2. The React mental model

**21. What is a render?**
React calling your components to find out what the UI should look like. Rendering produces elements; the commit phase applies the differences to the DOM. A render can happen without any DOM change, and in concurrent rendering it can be thrown away without ever committing. → [08](08-react-mental-model-and-rules.md)

**22. What causes a component to re-render?**
Its own state changing, its parent re-rendering, or a context it reads changing. Props "changing" isn't a separate trigger: new props arrive because the parent rendered. `memo` lets a component skip a parent-caused render when its props are shallowly equal. → [08](08-react-mental-model-and-rules.md), [38](38-react-performance-engineering.md)

**23. How does reconciliation use keys?**
React matches children by type and key. With stable keys, it moves, keeps or removes existing instances and their state. With index keys, state follows the *position*, so reordering or inserting at the top attaches state to the wrong item. → [10](10-react-internals-fiber-and-reconciliation.md)

**24. Why must components be pure?**
React may call them more than once, in any order, and discard the result: concurrent rendering, Strict Mode's double render and the Compiler's memoization all assume purity. A component that mutates shared data or causes side effects during render behaves differently each time. → [08](08-react-mental-model-and-rules.md)

**25. Controlled or uncontrolled inputs?**
Controlled: React state holds the value and every keystroke re-renders. Uncontrolled: the DOM holds it and you read it on submit (`FormData`, refs). React 19's form actions work naturally with uncontrolled inputs and reset them after a successful action. Use controlled inputs when the UI must react to every change. → [09](09-react-fundamentals-complete-reference.md), [26](26-forms-and-validation.md)

**26. Where should state live?**
As close as possible to where it's used, and lifted only to the lowest common ancestor that needs it. Server data belongs in a server cache, not in component state. URL-worthy state (filters, tabs, pagination) belongs in the URL. → [28](28-state-and-data-ownership-architecture.md)

**27. What's wrong with copying props into state?**
Two sources of truth that drift apart. Compute derived values during render instead; to reset state when an identity changes, change the component's `key`; and keep an "initial value" prop explicitly named as such. → [13](13-effects-and-synchronization.md), [28](28-state-and-data-ownership-architecture.md)

**28. What is Fiber?**
React's internal unit of work: one fiber per component instance, linked into a tree. React keeps the current tree and a work-in-progress tree and swaps them on commit. Fibers make rendering interruptible and prioritisable. → [10](10-react-internals-fiber-and-reconciliation.md), [11](11-build-your-own-react.md)

**29. What are lanes?**
A bitmask of priorities attached to updates: synchronous lanes for discrete input like clicks and typing, a default lane, transition lanes, idle. React renders the highest-priority pending lanes first, and can interrupt a transition render to handle input. → [10](10-react-internals-fiber-and-reconciliation.md), [15](15-concurrent-react-suspense-and-transitions.md)

**30. Render phase and commit phase: which can be interrupted?**
Rendering can be interrupted and restarted in concurrent mode. Committing can't: DOM mutations, then layout effects, run synchronously together. Passive effects (`useEffect`) usually run after the browser paints. → [10](10-react-internals-fiber-and-reconciliation.md), [13](13-effects-and-synchronization.md)

**31. How does batching work since React 18?**
Updates are batched automatically everywhere: event handlers, promises, timeouts and native listeners. One render handles all of them. `flushSync` forces an immediate render when you must measure the DOM right after an update. → [15](15-concurrent-react-suspense-and-transitions.md)

**32. What are portals for?**
Rendering into a DOM node outside the parent's hierarchy (modals, tooltips, toasts) while staying in the React tree. Context still flows, and events bubble through the *React* tree, not the DOM tree, which surprises people with click-outside handlers. → [14](14-refs-dom-portals-and-imperative-apis.md)

**33. What do error boundaries catch, and what don't they?**
Errors thrown while rendering, in lifecycle methods and in constructors below them. Not errors in event handlers, in async code, or in the boundary itself. They're still class components. React 19 adds the root options `onCaughtError` and `onUncaughtError` for reporting. → [09](09-react-fundamentals-complete-reference.md), [40](40-resilience-and-reliability.md)

**34. Why can context cause performance problems?**
Every component that reads a context re-renders when its value changes, and a new object value on each provider render changes it every time. Split contexts by how often they change, memoize the value, or move fast-changing state into an external store with selectors. → [29](29-client-state-management.md)

**35. What are refs for?**
Values that persist across renders without causing re-renders (timers, previous values, imperative handles) and access to DOM nodes. Don't read or write `ref.current` during render. React 19 passes `ref` as a normal prop to function components and lets ref callbacks return a cleanup function. → [14](14-refs-dom-portals-and-imperative-apis.md), [16](16-react-19-features-and-the-compiler.md)

**36. Do you still need `forwardRef`?**
Not for function components in React 19: `ref` is a prop. `forwardRef` still works, and libraries that support React 18 keep it for now. → [16](16-react-19-features-and-the-compiler.md)

**37. What does `<Activity>` do?**
It hides part of the UI without unmounting it (`mode="hidden"`). State and DOM are kept, effects are cleaned up while hidden and re-created when visible, and hidden content can pre-render at low priority. It's for tabs, back navigation and pre-rendering the likely next screen. Added in React 19.2. → [16](16-react-19-features-and-the-compiler.md)

**38. What does Strict Mode do in development?**
Renders components twice, runs effects mount → cleanup → mount, and double-invokes ref callbacks, to expose impure renders and effects without proper cleanup. Since 19.3 it also double-invokes effects during hydration. None of this happens in production. → [13](13-effects-and-synchronization.md)

**39. Why isn't `useEffect` the right place to fetch data in most apps?**
Effects run after render, so fetches start late and nested components create waterfalls. You must handle race conditions, caching, deduplication and retries yourself. Fetch in a router loader, a Server Component or a server-state library like TanStack Query. → [13](13-effects-and-synchronization.md), [30](30-server-state-and-data-fetching.md)

**40. How does React's event system work?**
React attaches listeners at the root container (since React 17, not `document`) and dispatches synthetic events through the React tree. Discrete events (clicks, key presses) are processed at the highest priority, so their updates render synchronously. → [09](09-react-fundamentals-complete-reference.md), [10](10-react-internals-fiber-and-reconciliation.md)

**41. Element, component, instance: what's the difference?**
A component is the function (or class). An element is a plain object describing what to render (`{ type, props, key }`), produced by JSX. An instance (a fiber, plus an object for classes) is React's live record of a mounted element, holding its state. → [08](08-react-mental-model-and-rules.md)

**42. What is hydration, and what causes mismatches?**
Attaching React to server-rendered HTML instead of recreating it. Mismatches come from rendering different output on the server and the client: dates, random IDs, `window` checks, locale differences. Use `useId` for IDs and render client-only values in an effect or with `suppressHydrationWarning` for small, intentional differences. → [17](17-ssr-streaming-and-hydration.md)

**43. What is tearing, and how does `useSyncExternalStore` prevent it?**
Tearing is different parts of the UI showing different versions of an external store during one concurrent render. `useSyncExternalStore` detects that the store changed mid-render and re-renders synchronously. `getSnapshot` must return the same value until the store changes, or React re-renders forever. → [15](15-concurrent-react-suspense-and-transitions.md), [29](29-client-state-management.md)

**44. When would you still write a class component?**
For an error boundary, which has no hook equivalent, and when maintaining legacy code. Everything else is better as a function component. → [19](19-class-components-lifecycles-and-legacy-apis.md)

**45. What can the `key` prop do outside lists?**
Reset a subtree. `<Profile key={userId} />` throws away all of the profile's state when the user changes, which is usually what you want and is far simpler than resetting state in an effect. → [09](09-react-fundamentals-complete-reference.md)

---

## 3. Hooks and effects

**46. Why do the Rules of Hooks exist?**
React identifies each hook by its call order within a component; the hooks are stored as a list on the fiber. Calling hooks conditionally or in loops would shift the order between renders and mix up their state. → [12](12-hooks-in-depth.md)

**47. When do you pass a function to `useState`?**
As a lazy initializer (`useState(() => expensive())`), so the computation runs only on the first render. And to the setter (`setCount((c) => c + 1)`) when the next state depends on the previous one, which is safe with batching and stale closures. → [12](12-hooks-in-depth.md)

**48. `useReducer` or `useState`?**
`useReducer` when the next state depends on several values or many event types update the same state, because transitions become testable pure functions. `useState` for independent, simple values. → [12](12-hooks-in-depth.md)

**49. How does the dependency array work?**
After each render, React compares every dependency with its previous value using `Object.is`. If any changed, the effect's cleanup runs and the effect runs again. Objects and functions created during render are new each time, so they re-trigger the effect every render. → [13](13-effects-and-synchronization.md)

**50. When does an effect's cleanup run?**
Before the effect runs again with new dependencies, and when the component unmounts. In Strict Mode development, also once right after the first mount. → [13](13-effects-and-synchronization.md)

**51. `useEffect`, `useLayoutEffect` or `useInsertionEffect`?**
`useEffect` for most synchronisation; it runs after paint. `useLayoutEffect` when you must measure or change the DOM before the user sees it (tooltip positioning); it blocks paint. `useInsertionEffect` is for CSS-in-JS libraries injecting styles before layout effects read them. → [13](13-effects-and-synchronization.md)

**52. When do `useMemo` and `useCallback` matter?**
When a value's identity matters (it's passed to a memoized child or used as an effect dependency) or when a computation is genuinely expensive. With the React Compiler, most manual uses become unnecessary, but measure: [71](71-case-study-legacy-react-modernization.md) shows a screen where the compiler alone didn't stop 500 rows re-rendering. → [12](12-hooks-in-depth.md), [16](16-react-19-features-and-the-compiler.md)

**53. When is a ref better than state?**
When a value must persist but shouldn't trigger a render: a timer ID, the previous value, a flag for "already sent this analytics event", an `AbortController`. If the UI shows it, it's state. → [12](12-hooks-in-depth.md)

**54. What makes a good custom hook?**
It shares *logic*, not state: every call has its own state. It has a clear name starting with `use`, a small API, and it hides an effect or a subscription behind a declarative interface (`useOnlineStatus()`). → [12](12-hooks-in-depth.md)

**55. What is `useId` for?**
Stable IDs that match between server and client, for linking labels, descriptions and ARIA attributes. Not for list keys. The format changed between versions (`_r_` since 19.2), so never parse it. → [12](12-hooks-in-depth.md), [36](36-accessibility-engineering.md)

**56. `useTransition` or `useDeferredValue`?**
`useTransition` when you own the update: wrap `setState` in `startTransition` to mark it interruptible, and use `isPending` for feedback. `useDeferredValue` when you receive a value (a prop, a search query) and want a lagging copy for the expensive part of the UI. → [15](15-concurrent-react-suspense-and-transitions.md)

**57. What problem does `useEffectEvent` solve?**
Reading the latest props or state inside an effect without making them dependencies. A "connected" handler that logs the current theme shouldn't reconnect the chat room when the theme changes. Stable since React 19.2. Call effect events only from effects. → [13](13-effects-and-synchronization.md)

**58. How does `useOptimistic` work?**
It returns a value that shows an optimistic version while an Action is pending, and falls back to the real state when the Action finishes, whether it succeeded or not. You don't write rollback code; the server's result simply replaces the guess. → [16](16-react-19-features-and-the-compiler.md), [68](68-case-study-ecommerce-storefront.md)

**59. What is `useActionState`?**
It wraps an action function and returns `[state, dispatch, isPending]`, where `state` is the last result. It's built for forms: pass `dispatch` as a form's `action`, and it works with Server Functions and progressive enhancement. It replaced `ReactDOM.useFormState`. → [16](16-react-19-features-and-the-compiler.md), [26](26-forms-and-validation.md)

**60. What does `use` do, and how is it different from other hooks?**
It reads a promise (suspending until it resolves) or a context. Unlike other hooks, it can be called conditionally. Promises passed to it must be stable: create them in a Server Component, a loader or a cache, not during render, or every render starts a new request. → [16](16-react-19-features-and-the-compiler.md)

**61. `useFormStatus`?**
It gives a component the pending state and data of the `<form>` it's rendered inside, so a submit button can disable itself without prop drilling. It must be called from a component *inside* the form. → [16](16-react-19-features-and-the-compiler.md), [26](26-forms-and-validation.md)

**62. How do you avoid race conditions when fetching in an effect?**
Abort the previous request in the cleanup (`AbortController`), or ignore late responses with a flag set in the cleanup. Otherwise a slow response for an old query can overwrite the result for the new one. Better still, use a library that handles it. → [13](13-effects-and-synchronization.md)

**63. Why does my effect run twice in development?**
Strict Mode mounts, cleans up and mounts again to check that your cleanup undoes the effect. If running twice breaks something, the effect is missing a cleanup, and users would hit the same bug on fast navigations. → [13](13-effects-and-synchronization.md)

**64. How should you subscribe to something like window size?**
With `useSyncExternalStore`: a `subscribe` function that adds and removes the `resize` listener, a `getSnapshot` that returns the current width, and a `getServerSnapshot` for server rendering. → [29](29-client-state-management.md)

**65. How would you write `useDebouncedValue`?**
State for the debounced value, and an effect that sets a timeout when the input changes and clears it in the cleanup. Consider whether `useDeferredValue` is what you actually need: it doesn't wait a fixed time, it just lets urgent updates go first. → [74](74-machine-coding-drills.md)

---

## 4. React 19 and the Compiler

**66. What were React 19's headline features?**
Actions (async transitions with pending state, errors and optimistic updates), `useActionState`, `useOptimistic`, `use`, form actions, `ref` as a prop with cleanup functions, `<Context>` as a provider, document metadata and stylesheets rendered from components, resource preloading APIs, and stable Server Components and Server Functions. → [16](16-react-19-features-and-the-compiler.md)

**67. What did 19.1, 19.2 and 19.3 add?**
19.1: Owner Stacks for debugging. 19.2: `<Activity>`, `useEffectEvent`, `cacheSignal`, Performance Tracks in browser devtools and partial pre-rendering APIs. 19.3: stable `<ViewTransition>` and `addTransitionType`, Fragment refs, `browser()`, Trusted Types support and RSC rendering of `<Context>`. 19.3.1 was a security release. → [16](16-react-19-features-and-the-compiler.md), [A2](A2-react-version-history-and-governance.md)

**68. What does the React Compiler do?**
At build time, it analyses components and hooks and inserts fine-grained memoization: cached values and JSX keyed on what they actually depend on. It assumes the Rules of React and skips any function it can't prove follows them. Version 1.0 shipped in October 2025. → [16](16-react-19-features-and-the-compiler.md)

**69. With the compiler, are `useMemo`, `useCallback` and `memo` obsolete?**
Mostly, but not entirely. The compiler memoizes within a component; component boundaries are still yours. In a measured case, typing in an unrelated field re-rendered 500 rows until the table became its own component, and selecting a row re-rendered all 500 without `memo` on the row. → [71](71-case-study-legacy-react-modernization.md)

**70. How do you adopt the compiler safely?**
Turn on eslint-plugin-react-hooks' compiler-based rules first and fix what they report. Then opt in per feature with `compilationMode: 'annotation'` and `'use memo'`, measuring hot screens, and finally switch to the default inference mode. `'use no memo'` is the escape hatch. → [16](16-react-19-features-and-the-compiler.md), [71](71-case-study-legacy-react-modernization.md)

**71. What is an Action?**
A function, usually async, run inside a transition. React tracks its pending state, keeps showing the current UI until it finishes, surfaces errors to the nearest error boundary and works with `useOptimistic`. Passing a function to `<form action>` makes it an Action automatically. → [16](16-react-19-features-and-the-compiler.md)

**72. How does React 19 handle `<title>` and `<meta>`?**
You render them anywhere in the tree and React hoists them into `<head>`, on the client and in server rendering. Stylesheets with a `precedence` are ordered and deduplicated, and async scripts are deduplicated. → [16](16-react-19-features-and-the-compiler.md)

**73. What are `preload`, `preinit` and `preconnect` in `react-dom`?**
Functions that tell the browser about resources early. During server rendering they become `<link>` tags in the head; on the client they insert them. They let a component declare the font, script or stylesheet it needs without a framework-specific API. → [16](16-react-19-features-and-the-compiler.md)

**74. What changed about ref callbacks in React 19?**
They can return a cleanup function, called when the element is removed, like an effect. Before, React called the callback with `null` instead. → [16](16-react-19-features-and-the-compiler.md)

**75. What changed in error reporting?**
Errors are no longer re-thrown and logged twice. Root options `onCaughtError`, `onUncaughtError` and `onRecoverableError` let you send each kind to your error tracker, and hydration errors show a diff of what didn't match. → [16](16-react-19-features-and-the-compiler.md), [40](40-resilience-and-reliability.md)

**76. Which APIs did React 19 remove?**
`ReactDOM.render`, `hydrate`, `unmountComponentAtNode` and `findDOMNode`; string refs; legacy context; PropTypes checks; `defaultProps` on function components; `react-dom/test-utils` (`act` moved to `react`); UMD builds. The legacy-API removals make old code fail outright: in [71](71-case-study-legacy-react-modernization.md), a 2019 screen threw on its string ref. → [64](64-migration-playbooks.md), [71](71-case-study-legacy-react-modernization.md)

**77. What are Owner Stacks?**
A development-time stack of the *components that rendered* the current one, available through `captureOwnerStack()` since 19.1. They answer "who rendered this?", which a JavaScript stack trace can't. → [20](20-react-tooling-devtools-and-debugging.md)

**78. What are React's Performance Tracks?**
Since 19.2, React adds Scheduler and Components tracks to the browser's Performance panel, showing what rendered, at which priority, and why. React DevTools 8 removed its own Timeline tab in favour of them. → [20](20-react-tooling-devtools-and-debugging.md)

**79. What is `cacheSignal`?**
In Server Components, an `AbortSignal` that fires when the current `cache()` lifetime ends (the render finished or was aborted), so in-flight fetches started for it can be cancelled. Added in 19.2. → [18](18-react-server-components-and-server-functions.md)

**80. What does `browser()` in React 19.3 do?**
`use(browser())` suspends only on the server, so the nearest Suspense fallback goes into the HTML and the real content renders on the client. It's a principled replacement for `typeof window` checks in components that can't render on a server. → [16](16-react-19-features-and-the-compiler.md)

---

## 5. Concurrency, Suspense and transitions

**81. What does "concurrent rendering" mean?**
React can prepare several versions of the UI, interrupt a render to handle something more urgent, and abandon work that's no longer needed. It's not parallelism: rendering is still on the main thread, just interruptible. → [15](15-concurrent-react-suspense-and-transitions.md)

**82. What does Suspense do?**
It shows a fallback while something inside it isn't ready: lazy code, data read with `use`, or a framework's data source. On the server, it lets HTML stream: the shell goes first, and each boundary's content follows when ready. → [15](15-concurrent-react-suspense-and-transitions.md), [17](17-ssr-streaming-and-hydration.md)

**83. Why doesn't Suspense show the fallback again during a transition?**
Inside a transition, React keeps showing the current content instead of replacing already-visible UI with a spinner, and reports `isPending` instead. New boundaries that weren't visible before still show their fallbacks. → [15](15-concurrent-react-suspense-and-transitions.md)

**84. How do you design Suspense boundaries?**
Around units the user perceives as one thing: a page shell, a panel, a list. Too few, and one slow query blocks the page; too many, and the page pops in piece by piece. Pair each boundary with an error boundary. → [15](15-concurrent-react-suspense-and-transitions.md)

**85. What is a transition, technically?**
An update in a transition lane: lower priority than input, interruptible, and allowed to keep showing old UI while it renders. `startTransition` marks updates; Actions run inside transitions automatically. → [15](15-concurrent-react-suspense-and-transitions.md)

**86. How do you keep typing fast while a big list filters?**
Keep the input's state urgent and render the list from a deferred copy (`useDeferredValue`), or update the list's state in a transition. Then virtualize the list and check that rows don't re-render needlessly. → [15](15-concurrent-react-suspense-and-transitions.md), [38](38-react-performance-engineering.md)

**87. What changed about transitions in 19.3?**
Transitions now render independently of each other, so one slow transition doesn't hold back an unrelated one, and `<ViewTransition>` can animate what they change. → [16](16-react-19-features-and-the-compiler.md)

**88. Can you use Suspense for data without a framework?**
Yes, with `use(promise)`, as long as the promise is cached outside render: created by a loader, a cache or a library. Creating it during render starts a new request on every render and suspends forever. → [15](15-concurrent-react-suspense-and-transitions.md), [30](30-server-state-and-data-fetching.md)

**89. What is selective hydration?**
With streaming SSR, React hydrates Suspense boundaries independently and prioritises the one the user is interacting with. A click on an unhydrated part is replayed after that part hydrates. → [17](17-ssr-streaming-and-hydration.md)

**90. How do `<Suspense>` and `lazy` interact with routing?**
Route-level code splitting: `lazy(() => import('./Settings'))` inside a boundary. Routers and frameworks preload route code on hover or intent, which removes most of the delay. Prefer the router's own lazy-route API, which can load code and data in parallel. → [31](31-routing-architecture.md)

**91. How do you test concurrent behaviour?**
Use `act` (from `react`) around updates, `findBy` queries for async UI, and assert on what users see during pending states. Avoid asserting on render counts, except in performance tests where that's the point. → [42](42-testing-architecture.md)

**92. What are `startGestureTransition` and `SuspenseList`?**
Unstable APIs: `unstable_startGestureTransition` (for gesture-driven transitions, replacing the earlier `useSwipeTransition`) and `unstable_SuspenseList` (coordinating reveal order). Don't build production features on them; check [A4](A4-experimental-and-canary-apis.md) for their status. → [A4](A4-experimental-and-canary-apis.md)

---

## 6. Server rendering, streaming and Server Components

**93. CSR, SSR, SSG, ISR and streaming: when do you use each?**
CSR for authenticated, highly interactive apps where SEO doesn't matter. SSG for content that changes rarely. ISR or tag-based revalidation for content that changes sometimes. SSR for personalised or fast-changing pages. Streaming SSR when parts of a page are slow: the shell goes first and the slow parts follow. Most real products mix them per route, or per component with partial prerendering. → [32](32-rendering-strategy-architecture.md)

**94. What does streaming SSR actually stream?**
HTML in order: the shell and the content of every Suspense boundary that's ready, then, as other boundaries resolve, their HTML plus a small inline script that swaps it in place of the fallback. The user sees content before the slowest query finishes. → [17](17-ssr-streaming-and-hydration.md)

**95. What are React Server Components?**
Components that run only on the server (at build time or per request). They can read data directly, their code never ships to the browser, and they render to a serialized tree that Client Components slot into. Client Components still render on the server for HTML, then hydrate. → [18](18-react-server-components-and-server-functions.md)

**96. What can't a Server Component do?**
Use state, effects, browser APIs or event handlers, or create context. Since React 19.3 it can render a `<Context value>` provider imported from a `'use client'` module, but it still can't create one. → [18](18-react-server-components-and-server-functions.md)

**97. What does `'use client'` mean?**
It marks a module as a boundary: it and everything it imports become client code, shipped to the browser. It doesn't mean "client-only": Client Components still render on the server. Put the boundary as low as possible, around the interactive leaves. → [18](18-react-server-components-and-server-functions.md)

**98. How do you pass a Server Component into a Client Component?**
As `children` or another prop. A Client Component can't *import* a Server Component, but it can render one it receives, so a client `<Tabs>` can wrap server-rendered panels. → [18](18-react-server-components-and-server-functions.md)

**99. What can cross the server-client boundary as props?**
Serializable values: primitives, plain objects and arrays, `Date`, `Map`, `Set`, typed arrays, promises (unwrapped with `use`), JSX, and Server Functions. Not class instances, ordinary functions or symbols you created. Everything you pass is visible in the page's payload, so pass only what the client needs. → [18](18-react-server-components-and-server-functions.md), [44](44-rsc-security-threat-model.md)

**100. What is a Server Function, and what's the biggest mistake people make with them?**
A server function (marked `'use server'`) that the client can call; React turns the call into an HTTP request. The mistake is treating it as private. Every Server Function is a public endpoint: authenticate, authorize and validate inside every one, as you would for an API route. → [18](18-react-server-components-and-server-functions.md), [44](44-rsc-security-threat-model.md)

**101. What was React2Shell?**
CVE-2025-55182 (December 2025), an unauthenticated remote code execution in React's Server Components packages (`react-server-dom-*`), rated CVSS 10 and exploited in the wild. It was the first of nine RSC advisories in a year. Client-only React apps weren't affected. → [44](44-rsc-security-threat-model.md), [A3](A3-security-advisories-timeline.md)

**102. What are the safe React versions for Server Components apps today?**
19.0.9, 19.1.10, 19.2.9 or 19.3.1 and later, after the October 2026 RCE fix (GHSA-xqc2-xf4c-x3h3). That advisory went 27 days without a CVE ID, so scanners that only match CVEs missed it. Track GitHub advisories as well as CVEs. → [A3](A3-security-advisories-timeline.md)

**103. How does RSC change bundle size?**
Server-only components and the libraries they use (markdown parsers, date libraries, SDKs) never reach the browser. The client bundle contains only Client Components and React's runtime. The win is largest on content-heavy pages and smallest on highly interactive ones. → [18](18-react-server-components-and-server-functions.md)

**104. How do you avoid waterfalls in Server Components?**
Start independent requests together (`Promise.all`, or create promises early and `await` them late), pass promises to children instead of awaiting at the top, and push slow data down into Suspense boundaries so it streams. → [18](18-react-server-components-and-server-functions.md)

**105. What is `cache()` for?**
Deduplicating a function's work within one server request: two components calling `getUser(id)` share one call. It's per request, not a cross-request cache; that's the framework's job (`'use cache'` in Next.js). → [18](18-react-server-components-and-server-functions.md)

**106. How do you keep secrets out of Client Components?**
Import `server-only` in modules that hold secrets, so importing them from client code fails the build. Pass derived data, not whole records. React's taint APIs (`experimental_taintObjectReference`, `experimental_taintUniqueValue`) add a runtime check, but they're still experimental. → [44](44-rsc-security-threat-model.md)

**107. What is partial prerendering?**
A page whose static shell is prerendered at build time, with dynamic holes rendered per request and streamed in. React 19.2 added the underlying `prerender`/`resume` APIs; Next.js builds on them with Cache Components. → [17](17-ssr-streaming-and-hydration.md), [48](48-nextjs-rendering-and-caching.md)

**108. What causes hydration to be slow, and what helps?**
Too much JavaScript and too large a tree to hydrate at once. Server Components (less to hydrate), streaming with Suspense boundaries (selective hydration), and moving non-interactive UI out of Client Components all help. → [17](17-ssr-streaming-and-hydration.md)

**109. What's the RSC payload?**
The serialized result of rendering Server Components: a stream of rows describing elements, client-component references and data. On navigation, the client fetches it instead of HTML and reconciles it into the current tree, preserving client state. → [18](18-react-server-components-and-server-functions.md)

**110. When would you not use Server Components?**
For an authenticated, highly interactive app with no SEO needs, served from a CDN, where a Vite SPA with a good data layer is simpler to build and operate. Or when your hosting can't run a server you're willing to patch quickly: RSC apps had nine security advisories in a year. → [54](54-choosing-a-react-framework.md)

**111. Which frameworks support RSC in 2026?**
Next.js (App Router), React Router 8 (RSC APIs), TanStack Start (optional RSC), Waku, Parcel and the Vite RSC plugin. Expo Router has experimental support for React Native. → [54](54-choosing-a-react-framework.md), [55](55-react-ecosystem-atlas-2026.md)

**112. How do you handle errors in a streamed page?**
Error boundaries around each Suspense boundary, so one failing panel shows its own error UI while the rest of the page streams. An error before the shell is sent becomes a normal error response. Log server errors with the request ID and show users a digest, never the stack. → [17](17-ssr-streaming-and-hydration.md), [40](40-resilience-and-reliability.md)

---

## 7. State and data

**113. What kinds of state does a frontend have?**
Server state (a cache of data owned elsewhere), URL state, form state, UI state (open, selected, hovered), session state, and shared client state. Most "state management" problems come from treating server state as client state. → [28](28-state-and-data-ownership-architecture.md)

**114. Why use a server-state library like TanStack Query?**
It handles caching, deduplication, background refetching, stale-while-revalidate, retries, pagination, optimistic updates and cache invalidation. Writing that with `useEffect` and `useState` is a lot of subtle code. → [30](30-server-state-and-data-fetching.md)

**115. What should a query key contain?**
Everything the result depends on: the resource, its parameters, and the scope, such as the tenant or user. In [67](67-case-study-enterprise-saas-dashboard.md), leaving the tenant out of the key, combined with `keepPreviousData`, briefly showed one tenant's invoices to another after a switch. → [30](30-server-state-and-data-fetching.md), [67](67-case-study-enterprise-saas-dashboard.md)

**116. `staleTime` versus `gcTime`?**
`staleTime` is how long data counts as fresh, so no refetch is triggered. `gcTime` is how long unused data stays in memory after the last subscriber leaves. A common setup is a staleTime of seconds or minutes, and the default gcTime of five minutes. → [30](30-server-state-and-data-fetching.md)

**117. How do you implement an optimistic update safely?**
Cancel in-flight queries for the data, snapshot it, apply the change, roll back on error and invalidate when the mutation settles. In React 19, `useOptimistic` does the display part for Actions; the server's answer always wins. → [30](30-server-state-and-data-fetching.md), [68](68-case-study-ecommerce-storefront.md)

**118. When do you need a client-state library?**
When shared client state is updated from many places and read by many components: an editor's document, a canvas, complex multi-step flows. Zustand, Jotai or Redux Toolkit then. For most apps, server state plus URL state plus local state leaves very little. → [29](29-client-state-management.md)

**119. Redux Toolkit, Zustand or Jotai?**
Redux Toolkit for large teams that want strict conventions, devtools and middleware. Zustand for a small, unopinionated store with selectors. Jotai for atom-level state that composes bottom-up. All work with `useSyncExternalStore` and concurrent rendering. → [29](29-client-state-management.md)

**120. Why put state in the URL?**
It survives reloads, can be shared and bookmarked, works with the back button, and gives you deep links for free. Filters, sort order, pagination, selected tabs and search queries usually belong there. → [31](31-routing-architecture.md)

**121. How do you avoid request waterfalls in a client-rendered app?**
Load data in route loaders, in parallel with the route's code, instead of in effects in nested components. Prefetch on hover or intent, and hoist queries to the route. → [30](30-server-state-and-data-fetching.md), [31](31-routing-architecture.md)

**122. What is a BFF, and when is one worth it?**
A backend-for-frontend: a thin server layer owned by the frontend team that aggregates and shapes data for one client. Worth it when the UI needs data from many services, when you need to hide tokens from the browser, or when web and mobile need different shapes. → [33](33-api-integration-bff-and-contracts.md)

**123. How do you keep frontend and backend contracts in sync?**
Generate types from a schema (OpenAPI, GraphQL, protobuf) or share them through end-to-end typed RPC, validate responses at the boundary in development, and run contract tests in CI so a breaking change fails before deploy. → [33](33-api-integration-bff-and-contracts.md)

**124. REST, GraphQL or RPC?**
REST for public, cacheable, resource-shaped APIs. GraphQL when many clients need different shapes of a large graph, and you're ready to run it (persisted queries, cost limits). Typed RPC (tRPC, framework server functions) when frontend and backend live in one TypeScript codebase. → [33](33-api-integration-bff-and-contracts.md)

**125. How do you handle real-time updates?**
For notifications and live counters, server-sent events or WebSockets feeding the server-state cache (invalidate or patch queries). For collaborative editing, a CRDT document synced over WebSockets. Polling is fine for slow-changing data. → [34](34-realtime-offline-and-collaboration.md)

**126. What's a CRDT, and when do you need one?**
A data structure whose replicas merge to the same state regardless of the order of updates, without a central server deciding. You need one for collaborative or offline editing. The data model still matters: per-column arrays duplicated a concurrently moved card in every one of 100 test runs in [69](69-case-study-collaborative-project-management.md). → [34](34-realtime-offline-and-collaboration.md), [69](69-case-study-collaborative-project-management.md)

**127. How do you design for offline?**
Cache the app shell with a service worker, persist the data the user needs (IndexedDB), queue writes with idempotency keys, and make conflicts explicit. Decide per feature whether offline means read-only or editable; editable usually means a CRDT. → [34](34-realtime-offline-and-collaboration.md)

---

## 8. Performance

**128. What are the Core Web Vitals and their thresholds?**
LCP (loading) ≤ 2.5 s, INP (responsiveness) ≤ 200 ms and CLS (visual stability) ≤ 0.1, each at the 75th percentile of real users. INP replaced FID in March 2024. → [39](39-web-performance-and-core-web-vitals.md)

**129. What makes up INP?**
For the worst interaction (roughly): input delay (the main thread was busy), processing time (your event handlers and the renders they cause) and presentation delay (layout, paint and the next frame). Each needs a different fix. → [39](39-web-performance-and-core-web-vitals.md)

**130. How do you improve LCP?**
Find the LCP element, then: make the server respond faster (caching, streaming), discover the resource early (in the HTML, `fetchpriority="high"`, no lazy loading for it), make it smaller (modern image formats, the right size), and don't hide it behind client-side rendering. → [39](39-web-performance-and-core-web-vitals.md)

**131. What causes CLS, and how do you prevent it?**
Content that moves after it's shown: images without dimensions, ads and embeds without reserved space, web fonts swapping, banners inserted at the top. Reserve space (`width`, `height`, `aspect-ratio`), use `font-display` and metric-compatible fallbacks, and insert dynamic content below the fold. → [39](39-web-performance-and-core-web-vitals.md)

**132. Lab data or field data?**
Both, for different jobs. Field data (RUM, CrUX) tells you what users experience. Lab data (Lighthouse, scripted benchmarks) tells you which change moved what, in a setting where nothing else changes. Budget against the field and debug in the lab. → [39](39-web-performance-and-core-web-vitals.md)

**133. How do you find what's slow in a React app?**
The browser's Performance panel with React's Performance Tracks, and the React DevTools Profiler for why components rendered. Reproduce the slow interaction with CPU throttling, find the long task, then decide whether the cost is rendering, effects or something else. → [20](20-react-tooling-devtools-and-debugging.md), [38](38-react-performance-engineering.md)

**134. What are the main techniques for faster React rendering?**
Render less (state colocation, component boundaries, `memo` where props are stable, the Compiler), render less often (transitions, deferred values), render fewer elements (virtualization), and do less per render (move work out of render and into memoized or precomputed data). → [38](38-react-performance-engineering.md)

**135. When do you virtualize a list?**
When it renders hundreds of rows or more and they're not all visible: only the visible window plus a buffer is in the DOM. Handle accessibility (`aria-rowcount`, `aria-rowindex`), find-in-page (which won't see unrendered rows), and dynamic row heights. → [25](25-complex-ui-engineering.md), [38](38-react-performance-engineering.md)

**136. How do you set and enforce a JavaScript budget?**
Per route, in gzip or brotli kilobytes, checked in CI against the build manifest so a pull request that exceeds it fails. [60](60-monorepos-build-tooling-and-bundlers.md) has a working budget checker. Track the budget alongside field metrics, since bytes are a proxy, not the goal. → [60](60-monorepos-build-tooling-and-bundlers.md)

**137. Does upgrading React make your bundle smaller?**
Not necessarily. React 19.3's runtime measured about 27 kB gzip larger than React 16.14's. Savings come from what you remove (old date and utility libraries, unused code) and from Server Components keeping code on the server. → [71](71-case-study-legacy-react-modernization.md)

**138. How should images be served?**
In modern formats (AVIF, WebP), at the size they're displayed (`srcset` and `sizes`), lazy-loaded below the fold, eagerly loaded with high priority for the LCP image, with dimensions set to prevent layout shift, and from a CDN. → [39](39-web-performance-and-core-web-vitals.md)

**139. How do fonts affect performance?**
They delay text rendering or cause layout shifts. Self-host, subset, preload the one or two critical files, use `font-display: swap` or `optional`, and adjust fallback metrics (`size-adjust`) so the swap doesn't move content. → [39](39-web-performance-and-core-web-vitals.md)

**140. What's the cost of third-party scripts?**
Main-thread time, network contention and privacy risk. Load them after the page is interactive, behind consent, or in a worker (Partytown-style). Measure their share of long tasks in RUM. → [39](39-web-performance-and-core-web-vitals.md)

**141. Code splitting: what's the right granularity?**
Split by route first, then by heavy, rarely used features (editors, charts, maps). Too many tiny chunks add request overhead and waterfalls. Preload the chunks the next interaction will need. → [38](38-react-performance-engineering.md)

**142. What's a design system's performance cost?**
Its headless layer is mostly a shared core paid once per app. In [70](70-case-study-enterprise-design-system.md), the first React Aria component cost 17 kB gzip and the second about 2.5 kB more. Budget per app and per component beyond the core. → [70](70-case-study-enterprise-design-system.md)

**143. How do you keep performance from regressing?**
Budgets in CI (bytes, and benchmarks for hot interactions), RUM dashboards per route with alerts, releases annotated in the dashboards, and an owner for each budget. Without an owner, budgets get raised instead of met. → [39](39-web-performance-and-core-web-vitals.md), [41](41-observability-and-diagnostics.md)

**144. What does the bfcache need from you?**
Avoid `unload` handlers and `Cache-Control: no-store` on pages that could be restored, close long-lived connections on `pagehide`, and refresh stale data on `pageshow` when `persisted` is true. Back and forward navigations then become instant. → [39](39-web-performance-and-core-web-vitals.md)

**145. How do you speed up client-side navigations?**
Prefetch route code and data on intent, keep previous content visible during transitions, cache route data, and use the View Transitions API for perceived continuity. Next.js 16.3 added partial prefetching and instant navigation tooling around this. → [31](31-routing-architecture.md), [50](50-nextjs-in-production.md)

---

## 9. Accessibility and design systems

**146. What does WCAG 2.2 AA require, in short?**
Perceivable (text alternatives, captions, 4.5:1 text contrast), operable (keyboard access, visible focus, enough time, no seizure risks, 24 × 24 px minimum targets), understandable (labels, error identification, predictable behaviour) and robust (valid names, roles and values). 2.2 added focus-not-obscured, dragging alternatives, target size and accessible authentication. → [36](36-accessibility-engineering.md)

**147. What's the first rule of ARIA?**
Don't use ARIA if a native element does the job. A `<button>` gives you focus, keyboard activation and the role for free; `<div role="button">` needs all of it rebuilt by hand. No ARIA is better than wrong ARIA. → [36](36-accessibility-engineering.md)

**148. How do you manage focus in a single-page app?**
On route changes, move focus to the new page's heading or main region, and announce the change. Dialogs trap focus while open and return it to the trigger on close. Never remove focus outlines without replacing them. → [36](36-accessibility-engineering.md)

**149. What are live regions for?**
Announcing changes that happen away from focus: "Saved", "3 results", form errors. `aria-live="polite"` for most messages, `assertive` only for urgent ones. The region must exist in the DOM before its content changes. → [36](36-accessibility-engineering.md)

**150. How do you test accessibility?**
Automated checks (axe) in unit and end-to-end tests catch the mechanical problems. Keyboard-only walkthroughs, screen-reader testing on a fixed matrix, and audits by people catch the rest. Include a deliberately broken case so you know the automated test can fail. → [36](36-accessibility-engineering.md), [70](70-case-study-enterprise-design-system.md)

**151. Why build a design system on a headless library?**
Behaviour and accessibility (focus management, keyboard interaction, screen-reader semantics, internationalization) are the hardest parts and the least differentiating. A headless library provides them; the design system owns the API and the look. → [35](35-enterprise-design-system-architecture.md)

**152. What are design tokens, and how should they be layered?**
Named design decisions (colours, spacing, typography) stored as data. Three tiers: primitives (the palette), semantic tokens (`color.text.danger`) and, if needed, component tokens. Products use semantic tokens only. The DTCG 2025.10 format is the first stable standard for them. → [35](35-enterprise-design-system-architecture.md), [70](70-case-study-enterprise-design-system.md)

**153. How do you guarantee contrast across themes?**
Declare which foreground tokens are used on which backgrounds, and check every pair in every theme in CI. In [70](70-case-study-enterprise-design-system.md), the check's first run failed two pairs that had shipped for months. → [70](70-case-study-enterprise-design-system.md)

**154. How do you version a design system?**
Semantic versioning with a written definition of breaking, changesets per pull request, canary releases that consumers build against nightly, a codemod for every breaking change, and deprecations measured by scanning consumers' code. → [35](35-enterprise-design-system-architecture.md), [70](70-case-study-enterprise-design-system.md)

**155. Should design system components accept `className`?**
It's a trade-off. Escape hatches keep teams unblocked but let the system drift. Many systems allow them on layout primitives only and make contribution fast for everything else. Whichever you choose, measure overrides, because they tell you what the system is missing. → [70](70-case-study-enterprise-design-system.md)

**156. How do you support right-to-left languages?**
Use logical CSS properties (`margin-inline-start`, `inset-inline-end`), set `dir` on the root, mirror directional icons, and test layouts in an RTL locale. Logical properties make most of it automatic. → [37](37-internationalization-and-localization.md)

**157. What belongs in internationalization beyond translation?**
Plurals, dates, numbers, currencies and lists formatted per locale (`Intl`), text expansion in layouts, RTL, sorting and search, time zones, and locale negotiation. Keep messages in ICU format with context for translators. → [37](37-internationalization-and-localization.md)

---

## 10. Testing

**158. What's your testing strategy for a React app?**
Mostly integration tests of components and features through what users see (Testing Library), unit tests for pure logic, a thin layer of end-to-end tests for critical journeys (Playwright), plus static checks (TypeScript, lint). Add visual and accessibility checks for the design system. → [42](42-testing-architecture.md)

**159. Which Testing Library queries should you prefer?**
By role and accessible name (`getByRole('button', { name: 'Save' })`), then label, then text. Test IDs last. Querying by role tests accessibility at the same time. → [42](42-testing-architecture.md)

**160. How do you mock the network in tests?**
At the network boundary, with Mock Service Worker handlers shared between tests, Storybook and local development, rather than mocking fetch functions module by module. → [42](42-testing-architecture.md)

**161. How do you deal with flaky tests?**
Measure flakiness per test, quarantine flaky tests with an owner and a deadline, and fix the causes: real timers and fixed waits, shared state between tests, order dependencies, and unawaited async work. A test that fails randomly trains people to ignore failures. → [42](42-testing-architecture.md)

**162. What should end-to-end tests cover?**
A small number of critical journeys (sign in, check out, the core workflow) against a production-like environment, including deploy-time concerns such as version skew. Not every edge case: those belong in faster tests. → [42](42-testing-architecture.md), [62](62-cicd-release-engineering-and-feature-flags.md)

**163. How do you test a Server Component?**
Async Server Components can be awaited and rendered in tests in some setups, but framework integration tests or end-to-end tests are often more reliable. Test the data functions and Server Functions directly as server code, including authorization. → [42](42-testing-architecture.md)

**164. What's visual regression testing good for?**
Catching unintended visual changes in shared components and themes: spacing, colours, dark mode, RTL, forced colours. It's most valuable for a design system and least for fast-changing product screens. → [42](42-testing-architecture.md), [70](70-case-study-enterprise-design-system.md)

**165. Vitest's browser mode or jsdom?**
jsdom is fast and fine for most component tests. A real browser (Vitest browser mode, often via the Storybook Vitest addon) when you need layout, real events, CSS or APIs jsdom lacks. jsdom can't compute colours, for example. → [42](42-testing-architecture.md)

**166. How do you test performance?**
Benchmarks for hot interactions in CI (a real browser with CPU throttling, comparing against the last accepted run), bundle budgets, and render-count tests for components where re-rendering is the known risk. [71](71-case-study-legacy-react-modernization.md) uses all three. → [71](71-case-study-legacy-react-modernization.md)

**167. How would you test a collaborative feature?**
Model-level tests for each conflict, then a seeded fuzz test: several replicas, random operations, random partial syncs, a final full sync, and assertions that every replica is identical and every invariant holds. Then a two-browser end-to-end test with one client offline. → [69](69-case-study-collaborative-project-management.md)

---

## 11. Security

**168. How do XSS vulnerabilities still happen in React apps?**
React escapes text, but not everything: `dangerouslySetInnerHTML` with unsanitized HTML, `href` or `src` values with `javascript:` URLs from user input, inline scripts built from data (JSON-LD), and third-party scripts. Sanitize HTML (DOMPurify), allow only safe URL schemes, and add a strict CSP. → [43](43-frontend-security-architecture.md)

**169. How do you render JSON-LD safely?**
Serialize the data with `<`, `>` and `&` escaped as Unicode escapes before putting it in a `<script type="application/ld+json">`. React 19 also escapes closing script tags in script text, as [68](68-case-study-ecommerce-storefront.md) verified, but an explicit serializer doesn't depend on that. → [68](68-case-study-ecommerce-storefront.md)

**170. What does a strict CSP look like for a React app?**
`script-src 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`, a per-request nonce stamped on every script (and style, if you restrict styles), and reporting enabled. Add Trusted Types to make DOM-injection sinks safe by construction; React 19.3 passes Trusted Types values through. → [43](43-frontend-security-architecture.md)

**171. Where should tokens live in the browser?**
Preferably not in JavaScript at all: an `HttpOnly`, `Secure`, `SameSite` session cookie set by a BFF that holds the access tokens server-side. Tokens in `localStorage` are readable by any XSS. If tokens must be in the browser, keep them in memory, short-lived. → [45](45-authentication-and-authorization.md)

**172. How do you protect against CSRF?**
`SameSite=Lax` or `Strict` cookies, checking `Origin` on state-changing requests, and tokens for anything older browsers or cross-site flows reach. Next.js compares `Origin` and `Host` for Server Actions; your own route handlers need their own checks. → [43](43-frontend-security-architecture.md), [49](49-nextjs-data-mutations-and-auth.md)

**173. What did CVE-2025-29927 teach about middleware?**
A crafted `x-middleware-subrequest` header let requests skip Next.js middleware entirely, which bypassed apps that did authorization only there. Authorize where the data is read and changed (pages, Server Functions, route handlers), and treat middleware (now `proxy.ts`) as an optimization. → [49](49-nextjs-data-mutations-and-auth.md)

**174. How do you defend against npm supply-chain attacks?**
Commit lockfiles, delay new versions (pnpm's `minimumReleaseAge`), don't run install scripts by default, publish with provenance through trusted publishing, pin and review GitHub Actions, and alert on new maintainers or install scripts in dependencies. The 2025 Shai-Hulud worm and the May 2026 compromise via a CI pipeline both spread through ordinary installs. → [60](60-monorepos-build-tooling-and-bundlers.md), [62](62-cicd-release-engineering-and-feature-flags.md)

**175. What's the threat model for Server Components?**
Server Functions are public endpoints; props sent to Client Components are visible; the RSC protocol itself had nine advisories in a year (deserialization leading to code execution and denial of service). Authorize in every Server Function, minimise what crosses the boundary, and patch fast. → [44](44-rsc-security-threat-model.md)

**176. What security headers should every frontend send?**
A CSP, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors` in the CSP (or `X-Frame-Options`) against clickjacking, and a `Permissions-Policy` that turns off what you don't use. → [43](43-frontend-security-architecture.md)

**177. What are the risks of AI features in a frontend?**
Prompt injection from content the model reads, tools that act with the user's authority, leaking data into prompts, and approvals that can be forged. In [65](65-ai-powered-react-interfaces.md), an unsigned tool approval could be tampered with; signing approvals on the server fixed it. Tools that change data need explicit approval and server-side authorization. → [65](65-ai-powered-react-interfaces.md)

**178. What does Angular's XSRF advisory history teach?**
That framework protections have edges: CVE-2025-66035 leaked the XSRF token to protocol-relative URLs, and a later fix was incomplete. Know what your framework's protection covers, keep it patched, and don't rely on one layer. → [58](58-angular-at-scale.md), [A3](A3-security-advisories-timeline.md)

**179. How do you handle a critical framework advisory?**
Have the plan before you need it: an inventory of which apps use which framework versions, a patch SLA (hours for critical, exploited issues), the ability to deploy any app the same day, and a WAF rule as a stopgap where one exists. Track GitHub advisories, not just CVEs. → [62](62-cicd-release-engineering-and-feature-flags.md), [A3](A3-security-advisories-timeline.md)

---

## 12. Next.js

**180. What changed in Next.js 16?**
Cache Components (`'use cache'`, `cacheLife`, `cacheTag`) as the caching model, Turbopack as the default bundler, `middleware.ts` renamed to `proxy.ts`, stable React Compiler support and the Build Adapters API (alpha in 16.0). 16.4 recommends Cache Components for all apps and makes them the default in `create-next-app`. → [47](47-nextjs-app-router-architecture.md), [48](48-nextjs-rendering-and-caching.md)

**181. How does `'use cache'` work?**
It marks a function or component as cacheable; its arguments become part of the cache key. `cacheLife` sets how long it lives, `cacheTag` labels it for invalidation. Anything dynamic it needs (cookies, headers) must be read outside and passed in. → [48](48-nextjs-rendering-and-caching.md)

**182. `revalidateTag`, `updateTag` or `refresh`?**
`revalidateTag(tag, profile)` marks tagged entries stale, so the next request refreshes them in the background. `updateTag(tag)`, from a Server Action, expires them immediately so the user who made the change sees it (read-your-writes). `refresh()` re-renders the current page's uncached data. → [48](48-nextjs-rendering-and-caching.md)

**183. How would you build a product page with Cache Components?**
Product content cached for hours with a product tag, invalidated by catalogue events; price and stock as short-lived cached components streamed into the page; the bag fully dynamic. [68](68-case-study-ecommerce-storefront.md) builds exactly this with Next.js 16.4. → [68](68-case-study-ecommerce-storefront.md)

**184. What does partial prerendering need from hosting?**
Support for serving a prerendered shell and resuming the dynamic parts in the same response. When self-hosted, [68](68-case-study-ecommerce-storefront.md) found PPR pages served with `Cache-Control: no-store`, so a plain CDN won't cache the shell. Check your platform's support. → [50](50-nextjs-in-production.md), [68](68-case-study-ecommerce-storefront.md)

**185. Server Actions or route handlers?**
Server Actions for mutations from your own UI, especially forms: progressive enhancement, typed calls and integration with transitions and caching. Route handlers for webhooks, public APIs, other clients and anything that needs a stable URL or custom HTTP behaviour. → [49](49-nextjs-data-mutations-and-auth.md)

**186. What do `loading.tsx`, `error.tsx` and `not-found.tsx` do?**
They create, per route segment, a Suspense boundary with that fallback, an error boundary with that UI (a Client Component with a retry), and the UI for `notFound()`. They make streaming and error isolation the default. → [47](47-nextjs-app-router-architecture.md)

**187. What are parallel and intercepting routes for?**
Parallel routes render several independent segments in one layout (a dashboard's panels, each with its own loading and error states). Intercepting routes show a route in a different context, such as a photo opening in a modal over a feed while keeping a shareable URL. → [47](47-nextjs-app-router-architecture.md)

**188. How do you self-host Next.js well?**
`output: 'standalone'`, a shared cache handler when you run more than one instance, a CDN in front for static assets, skew protection (deployment IDs, keeping old assets available), health checks and graceful shutdown, and monitoring of server render time. → [50](50-nextjs-in-production.md)

**189. Why are `cookies()` and `headers()` async?**
Since Next.js 15 they return promises, so the framework can prerender as much as possible and only wait for request data where it's actually used. Reading them makes that part of the page dynamic. → [48](48-nextjs-rendering-and-caching.md)

**190. What's `after()` for?**
Running work after the response is sent (logging, analytics, cache warming) without delaying the user. It runs in the same request context, so it can read the request. → [49](49-nextjs-data-mutations-and-auth.md)

**191. How do you handle authentication in the App Router?**
Verify the session in a data-access layer that every page, Server Action and route handler calls, close to the data. `proxy.ts` can redirect early for convenience, but must never be the only check (CVE-2025-29927). → [49](49-nextjs-data-mutations-and-auth.md)

**192. Which Next.js versions are safe in November 2026?**
16.4.5 or later on 16, and 15.5.29 or later on 15. 13.x and 14.x are end of life and received no fixes for the 2026 advisories. Next.js moved to scheduled security releases in July 2026, with out-of-band releases for critical issues. → [A3](A3-security-advisories-timeline.md)

**193. When would you choose React Router 8 or TanStack Start over Next.js?**
React Router 8 when you want a Vite-based, web-standards framework with loaders and actions, and RSC optional. TanStack Start when you want end-to-end type safety around routing and server functions with Vite and Nitro. Next.js when you want its caching model, the largest ecosystem and managed hosting. → [51](51-react-router-v8-framework-mode.md), [52](52-tanstack-start-and-router.md), [54](54-choosing-a-react-framework.md)

**194. What's version skew, and how does Next.js handle it?**
Clients running an old build talking to a new server: missing chunks, changed Server Action IDs, different data shapes. Next.js uses deployment IDs to detect skew and hard-navigate; platforms can keep old deployments reachable for a while. Test it with fresh browser contexts, as [62](62-cicd-release-engineering-and-feature-flags.md) found that the browser cache can mask it. → [62](62-cicd-release-engineering-and-feature-flags.md)

---

## 13. Angular

**195. What are Angular signals, and how do they compare with React state?**
Reactive values (`signal`, `computed`, `effect`) that track their readers, so Angular updates exactly the views that read a changed signal. React re-renders components and diffs; Angular with signals updates bindings directly. → [57](57-angular-signals-reactivity-and-rxjs.md), [59](59-react-vs-angular-architecture-comparison.md)

**196. What does "zoneless" mean?**
Change detection triggered by signals and explicit notifications instead of zone.js patching every async API. Stable in Angular 20.2, the default for new apps since 21. It removes zone.js from the bundle and makes change detection predictable. → [57](57-angular-signals-reactivity-and-rxjs.md)

**197. What changed in Angular 22?**
`OnPush` became the default change-detection strategy (the old default is now called `Eager`), Signal Forms and `resource`/`httpResource` became stable, incremental hydration became the default, the HttpClient uses fetch by default, `strictTemplates` is on by default, Angular Aria reached general availability, and TypeScript 6 is required. → [56](56-angular-architecture-and-dependency-injection.md), [58](58-angular-at-scale.md)

**198. When do you still use RxJS in Angular?**
For streams of events over time: WebSockets, complex async orchestration (`switchMap`, debouncing, retries), and existing HttpClient-based code. Signals hold state; observables model events. `toSignal` and `toObservable` bridge them. → [57](57-angular-signals-reactivity-and-rxjs.md)

**199. How does Angular's dependency injection work?**
Hierarchical injectors: environment injectors for the app and lazy routes, element injectors for components. `providedIn: 'root'` creates a tree-shakable singleton; providing in a component gives each instance its own. `inject()` works in constructors, field initializers and factory functions. → [56](56-angular-architecture-and-dependency-injection.md)

**200. What is `resource()`?**
An async signal: give it `params` and a `loader`, and it exposes `value`, `status`, `error` and `isLoading` as signals, aborting the previous load when the params change. `httpResource` does the same for HTTP. Both are stable since Angular 22. → [57](57-angular-signals-reactivity-and-rxjs.md)

**201. What does `@defer` do?**
Lazily loads a template block and its dependencies on a trigger (`on viewport`, `on interaction`, `on idle`, `on timer`), with `@placeholder`, `@loading` and `@error` blocks. With incremental hydration, blocks with `hydrate` triggers are server-rendered and stay dehydrated until the trigger fires. → [58](58-angular-at-scale.md)

**202. Why must `@for` have `track`?**
To identify items across changes, like React's `key`. Without stable tracking, Angular recreates DOM for moved items and loses their state. `track item.id` for entities; `track $index` only for static lists. → [56](56-angular-architecture-and-dependency-injection.md)

**203. How do interceptors work, and what's a subtle trap with retries?**
Functional interceptors form a chain around every request. A `retry()` placed in one interceptor re-subscribes to the downstream chain, but the downstream interceptors' setup code doesn't run again, so per-attempt logic must live inside the observable, for example with `defer`. [58](58-angular-at-scale.md) verified this with tests. → [58](58-angular-at-scale.md)

**204. Does `canMatch` stop a lazy route from being preloaded?**
No. Angular's preloader ignores `canMatch`, so a user who can't access a route may still download its code. Write a permission-aware preloading strategy if that matters. [58](58-angular-at-scale.md) verified this. → [58](58-angular-at-scale.md)

**205. What security settings matter for Angular SSR?**
`allowedHosts`, introduced with the fix for an SSRF and header-injection advisory (CVE-2026-27739), so the server refuses requests for hosts it doesn't serve. Keep `@angular/ssr` and `@angular/platform-server` patched: there were several SSR advisories in 2026. → [58](58-angular-at-scale.md), [A3](A3-security-advisories-timeline.md)

**206. Angular or React for a new enterprise product?**
Angular when you want one integrated, opinionated platform (routing, forms, HTTP, DI, testing) and consistency across many teams. React when you want ecosystem breadth, framework choice (including Server Components) and React Native. Both are good choices; the team's experience and the hiring market usually decide. → [59](59-react-vs-angular-architecture-comparison.md)

---

## 14. Tooling, builds and delivery

**207. What changed in Vite 8?**
Rolldown, a Rust bundler, replaced both esbuild and Rollup, so development and production use the same bundler, with Oxc for transforms. Plugins mostly carry over; options moved to `rolldownOptions`. → [60](60-monorepos-build-tooling-and-bundlers.md)

**208. Vite, Rspack or Turbopack?**
Vite for most new React apps and libraries. Rspack (or Rsbuild) to migrate a large webpack app with its plugins and Module Federation intact. Turbopack inside Next.js, where it's the default. → [60](60-monorepos-build-tooling-and-bundlers.md)

**209. Why pnpm for monorepos?**
A content-addressed store (fast installs, little disk use), strict `node_modules` that stops phantom dependencies, workspaces, catalogs for shared versions, and supply-chain controls such as `minimumReleaseAge`. → [60](60-monorepos-build-tooling-and-bundlers.md)

**210. What do Turborepo or Nx add?**
A task graph across packages, local and remote caching of task outputs, affected-only runs, and boundary rules between packages. In [60](60-monorepos-build-tooling-and-bundlers.md), `turbo boundaries` caught a phantom dependency in a lint config. → [60](60-monorepos-build-tooling-and-bundlers.md)

**211. When are micro-frontends the right choice?**
When independent teams must deploy parts of one product independently, and the organisational cost of coordination exceeds the technical cost of integration. Not for code organisation: a monorepo with boundaries does that more cheaply. → [61](61-micro-frontends-and-module-federation.md)

**212. What's the main operational risk of Module Federation?**
A remote's failure becoming the shell's failure, and shared-dependency version conflicts. In [61](61-micro-frontends-and-module-federation.md), the default `version-first` strategy blanked the whole shell when one remote was down; `loaded-first` plus an error boundary kept the shell working. → [61](61-micro-frontends-and-module-federation.md)

**213. How do feature flags fit into delivery?**
They separate deploying from releasing: code ships dark, then turns on for staff, a percentage, or a segment, and turns off without a deploy. Use a vendor-neutral API (OpenFeature), give every flag an owner and an expiry, and remove flags once released. → [62](62-cicd-release-engineering-and-feature-flags.md)

**214. What belongs in a frontend CI pipeline?**
Type checks, lint, unit and integration tests, build, bundle budgets, accessibility checks, end-to-end tests of critical journeys, preview deployments per pull request, and supply-chain checks. Fast feedback first, slow checks later or in parallel. → [62](62-cicd-release-engineering-and-feature-flags.md)

**215. How do you roll out a risky frontend change?**
Behind a flag, to internal users first, then a canary percentage with automatic rollback on error-rate or Web Vitals regressions, then everyone. Keep the previous build's assets available so open tabs keep working. → [62](62-cicd-release-engineering-and-feature-flags.md)

**216. What's a fitness function?**
An automated check that an architectural property still holds: bundle budgets, dependency rules between packages, contrast ratios, accessibility rules, the absence of imports from a deprecated package. It turns architecture decisions into tests. → [01](01-thinking-like-a-frontend-architect.md), [63](63-architecture-governance-and-adrs.md)

**217. How do you write a good codemod?**
Start from real examples in the codebase, transform the common case automatically, report the cases you can't handle safely instead of guessing, keep the output formatted, and run it on the whole repository in CI before merging. [64](64-migration-playbooks.md) has a tested one. → [64](64-migration-playbooks.md)

**218. ESLint or oxlint?**
oxlint is far faster and covers many common rules; ESLint has the full plugin ecosystem, including the React Compiler's lint rules in eslint-plugin-react-hooks. Many teams run oxlint first for speed and ESLint for the rules only it has. → [60](60-monorepos-build-tooling-and-bundlers.md)

---

## 15. Architecture, system design and leadership

**219. How do you approach a frontend system design interview?**
Clarify users, scale and constraints; agree on the core features; sketch the architecture (rendering strategy, data flow, state ownership, APIs); go deep on two or three hard parts; then cover failure modes, performance, accessibility, security and how you'd measure success. Say your assumptions out loud. → [66](66-frontend-system-design.md)

**220. Design a typeahead search.**
Debounce input, cancel stale requests (`AbortController`) and ignore out-of-order responses, cache results per query, show recent searches instantly, keyboard navigation with the ARIA combobox pattern, highlight matches, and handle errors and empty states. [66](66-frontend-system-design.md) has a tested implementation. → [66](66-frontend-system-design.md)

**221. Design a multi-tenant SaaS dashboard.**
Tenant in the URL and in every query key, server-rendered shell with streamed panels, a permission model checked on the server, a widget layer with error isolation, feature flags per tenant, and per-tenant observability. [67](67-case-study-enterprise-saas-dashboard.md) works through it. → [67](67-case-study-enterprise-saas-dashboard.md)

**222. Design a collaborative kanban board.**
A CRDT document per board in which each card owns its column and rank, Y.Text for titles, presence in an awareness channel, a sync server that authenticates and enforces roles, offline persistence in IndexedDB, and per-user undo. [69](69-case-study-collaborative-project-management.md) works through it. → [69](69-case-study-collaborative-project-management.md)

**223. Design an infinite feed.**
Cursor-based pagination, virtualization, prefetching the next page near the end, restoring scroll position on back navigation, de-duplicating items across pages, optimistic interactions, and image loading that doesn't shift the layout. Consider live updates as a "new posts" pill rather than shifting content. → [66](66-frontend-system-design.md)

**224. How do you choose a rendering strategy for a new product?**
From the pages' needs: SEO and first-load performance (server rendering or prerendering), personalisation and freshness (dynamic or cached per user), interactivity (client components or an SPA), and operations (who runs the servers and patches them). Decide per route, not per app. → [32](32-rendering-strategy-architecture.md), [54](54-choosing-a-react-framework.md)

**225. Monolith, modular monolith or micro-frontends?**
A modular monolith (one deployable, strong internal boundaries enforced in CI) is the right default for most organisations. Micro-frontends when teams genuinely need independent deployment. A tangled monolith is what you get by default without boundaries. → [21](21-frontend-architecture-styles-and-boundaries.md), [61](61-micro-frontends-and-module-federation.md)

**226. What's an ADR, and what makes a good one?**
A short record of one decision: context, options considered, the decision, consequences and how you'll verify it. Good ones are written when the decision is made, include the options you rejected and why, and live next to the code. → [63](63-architecture-governance-and-adrs.md)

**227. How do you decide between reversible and irreversible decisions?**
Make reversible ones quickly and locally, and spend time on the irreversible ones: data models that persist on devices, public APIs, framework choices, URL structures. Where you can, make a decision reversible (a flag, an adapter) before making it. → [01](01-thinking-like-a-frontend-architect.md)

**228. How do you manage technical debt?**
Make it visible (an inventory with cost estimates), tie paying it down to outcomes (incidents, lead time, performance), fix it inside the features being changed, and reserve capacity for the rest. Debt you never pay because it never hurts may not be debt. → [63](63-architecture-governance-and-adrs.md)

**229. How does Conway's law affect frontend architecture?**
Systems mirror the communication structure of the organisation that builds them. If three teams own one page, the page will have three seams; design team boundaries and module boundaries together. → [01](01-thinking-like-a-frontend-architect.md)

**230. How would you plan a large migration?**
Measure the baseline, define done, break the work into steps that each ship on their own, use codemods and adapters, track progress publicly, and do the work in the features teams are already changing. [64](64-migration-playbooks.md) and [71](71-case-study-legacy-react-modernization.md) apply this. → [64](64-migration-playbooks.md), [71](71-case-study-legacy-react-modernization.md)

**231. Build or buy, for example a design system's headless layer?**
Buy (adopt) where the problem is hard, well solved and not your differentiator, like accessible behaviour for complex widgets. Build where it's your product's core or where no option fits your constraints. Revisit when the costs change. → [35](35-enterprise-design-system-architecture.md)

**232. Tell me about a time you were wrong about a technical decision.**
Pick a real one: what you believed, the evidence that changed your mind, what you did about it, and what you do differently now. A good example from this handbook's own research: assuming the React Compiler would stop a table re-rendering, and measuring that it didn't until the component boundary changed. → [72](72-the-principal-frontend-engineer.md)

**233. How do you know your architecture is working?**
Outcomes: the user-facing metrics (Web Vitals, errors, accessibility defects), delivery metrics (lead time, change failure rate), developer experience (CI time, setup time) and adoption of the paved road. If teams route around your architecture, it isn't working, whatever the diagrams say. → [72](72-the-principal-frontend-engineer.md)

---

## Decision framework

**Problem:** preparing efficiently for a specific interview loop.

**Constraints:** the level (senior, staff, principal), the rounds, the stack, and how much time you have.

| Round | Sections to practise | Also |
|---|---|---|
| React deep dive | 2, 3, 4, 5 | Build something small with 19.3 features |
| Frontend system design | 6, 7, 8, 15 | Two full mock designs from [66](66-frontend-system-design.md) |
| Performance or platform | 8, 14 | Measure one of your own apps |
| Security-focused | 11, 6 | Read [A3](A3-security-advisories-timeline.md) |
| Next.js role | 6, 12 | Build a page with Cache Components |
| Angular or polyglot role | 13, and 2 for comparison | [59](59-react-vs-angular-architecture-comparison.md) |
| Leadership | 15 | Stories from [72](72-the-principal-frontend-engineer.md) §12 |
| Machine coding | — | [74](74-machine-coding-drills.md) |
| General system design | 15 | [79](79-distributed-systems-design-for-frontend-architects.md) |
| Principal leadership loop | 15 | [77](77-hiring-leveling-and-org-design.md), [78](78-business-cases-and-investment-arguments.md), [75](75-experimentation-and-product-analytics.md), [76](76-frontend-cost-and-capacity-engineering.md) |

**Criteria:** prioritise the sections that match the rounds, then your weakest areas, then breadth.

**Failure modes:** memorising answers without the "why"; outdated version facts; no caveats; no numbers in stories.

**Migration path:** from senior to staff answers, add the trade-off, the failure mode and a measurement to every answer.

---

## Pitfalls and anti-patterns

- **Answering a different question.** Restate it in your own words first.
- **Version facts from memory.** Frameworks change yearly; know what changed recently and say "as of".
- **No trade-offs.** Every "use X" needs a "unless Y".
- **Absolute statements.** "Never use effects" is wrong; "most data fetching shouldn't be in effects" is right.
- **No numbers.** "It was faster" is weak; "INP p75 went from 310 to 180 ms" is strong.
- **Jumping into a design without requirements.** Spend the first minutes on scope.

---

## Architect's checklist

- [ ] I can answer every question in sections 2 and 6 out loud in under a minute.
- [ ] For each answer, I can say when it stops being true.
- [ ] I know what changed in React 19.1, 19.2 and 19.3, and in my framework's last major.
- [ ] I know the security floors for the frameworks I'd use.
- [ ] I've done two full system-design mocks and two machine-coding drills under time pressure.
- [ ] I have six to eight leadership stories with numbers, including one where I was wrong.

---

## Interview angles

**Q: What's the most important thing a senior frontend engineer should understand about React?**
A: That rendering is a pure calculation React may repeat, interrupt or throw away, and that effects are for synchronising with outside systems. Most React bugs come from breaking one of those two ideas.

**Q: What's changed most in frontend architecture in the last two years?**
A: Server Components moving rendering decisions to the component level, the React Compiler changing how we think about memoization, Rust-based tooling making builds an order of magnitude faster, and supply-chain and RSC security becoming everyday concerns.

**Q: How do you keep up with the ecosystem?**
A: I read release notes and advisories for the tools I depend on, try each significant release in a scratch project before adopting it, and measure instead of trusting announcements.

**Q: What would you look for when interviewing a principal frontend engineer?**
A: Framing before solving, trade-offs with numbers, organisational scope in their stories, the ability to explain a deep technical topic simply, and evidence that they changed their mind when the data said so.

**Q: What question do you ask at the end of an interview?**
A: "What's the hardest technical decision this team will make in the next year, and who makes it?" The answer tells you about the work and the decision-making culture at once.

---

## Further reading

- [react.dev](https://react.dev/): the reference for every React API in this chapter.
- [web.dev: Core Web Vitals](https://web.dev/articles/vitals).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [Next.js documentation](https://nextjs.org/docs) and [Angular documentation](https://angular.dev/).
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/).

---

[← Previous: 72 — The Principal Frontend Engineer](72-the-principal-frontend-engineer.md) · [Index](README.md) · [Next: 74 — Machine-Coding Drills →](74-machine-coding-drills.md)
