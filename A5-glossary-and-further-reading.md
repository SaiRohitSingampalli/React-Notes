# A5 — Glossary and Further Reading

> Half of every architecture disagreement is two people using the same word for different things. Agree on the words first.

**Prerequisites:** none · **Related:** [A1 React API Reference](A1-react-api-reference.md) · [73 Interview Question Bank](73-interview-question-bank.md) · [README](README.md)

---

## TL;DR

- **About 100 terms** used across this handbook, each with a short definition and the chapter that covers it.
- **Definitions are for how the terms are used here,** in React 19.3, Next.js 16.4 and Angular 22.3 as of November 2026.
- **The reading list at the end** is short on purpose: specifications, official documentation, and a few books worth the time.

---

## Glossary

### A

**Accessible name** — The text assistive technology announces for an element: from its content, a `<label>`, `aria-label` or `aria-labelledby`. Testing Library's `getByRole(…, { name })` queries it. → [36](36-accessibility-engineering.md)

**Action (React)** — An async function run inside a transition; React tracks its pending state and errors. Passing a function to `<form action>` makes it one. → [16](16-react-19-features-and-the-compiler.md)

**Activity** — `<Activity mode="hidden">` hides UI while keeping its state; stable since 19.2. → [16](16-react-19-features-and-the-compiler.md)

**ADR (Architecture Decision Record)** — A short document recording one decision: context, options, decision, consequences, verification. → [63](63-architecture-governance-and-adrs.md)

**App Router** — Next.js's router built on React Server Components, nested layouts and streaming (the `app/` directory). → [47](47-nextjs-app-router-architecture.md)

**ARIA** — Attributes that add roles, states and properties for assistive technology. The first rule: use native HTML instead where possible. → [36](36-accessibility-engineering.md)

**Automatic batching** — Since React 18, all state updates in one tick render together, wherever they come from. → [15](15-concurrent-react-suspense-and-transitions.md)

**Awareness** — In Yjs, an ephemeral channel for presence (who's here, cursors) that is never stored in the document. → [69](69-case-study-collaborative-project-management.md)

### B

**bfcache** — The browser's back/forward cache, which restores a page instantly from memory if nothing prevents it (such as `unload` handlers). → [39](39-web-performance-and-core-web-vitals.md)

**BFF (Backend for Frontend)** — A server layer owned by a frontend team that shapes data for one client and keeps tokens off the browser. → [33](33-api-integration-bff-and-contracts.md)

**Bundle budget** — A size limit per route or entry, checked in CI so that regressions fail the build. → [60](60-monorepos-build-tooling-and-bundlers.md)

### C

**Cache Components** — Next.js's caching model since 16: `'use cache'`, `cacheLife`, `cacheTag`, with dynamic content streamed around cached parts. → [48](48-nextjs-rendering-and-caching.md)

**`cache()`** — React's per-request deduplication for Server Components; not a cross-request cache. → [18](18-react-server-components-and-server-functions.md)

**Canary (channel)** — React's prerelease channel for frameworks, built from the main branch. → [A2](A2-react-version-history-and-governance.md)

**Client boundary** — The point where a `'use client'` module is imported; it and everything it imports become client code. → [18](18-react-server-components-and-server-functions.md)

**CLS (Cumulative Layout Shift)** — The Core Web Vital for visual stability; good is ≤ 0.1 at p75. → [39](39-web-performance-and-core-web-vitals.md)

**Code splitting** — Loading code in chunks on demand, usually per route or per heavy feature. → [38](38-react-performance-engineering.md)

**Codemod** — A program that rewrites source code automatically, typically with jscodeshift or ast-grep. → [64](64-migration-playbooks.md)

**Commit phase** — When React applies changes to the DOM and runs layout effects; it can't be interrupted. → [10](10-react-internals-fiber-and-reconciliation.md)

**Concurrent rendering** — React's ability to prepare UI in the background, interrupt it and prioritise urgent updates. → [15](15-concurrent-react-suspense-and-transitions.md)

**Contrast ratio** — WCAG's measure of luminance difference: 4.5:1 for normal text and 3:1 for large text and non-text UI at level AA. → [70](70-case-study-enterprise-design-system.md)

**Core Web Vitals** — LCP, INP and CLS, measured at the 75th percentile of real users. → [39](39-web-performance-and-core-web-vitals.md)

**CORS** — The browser rule controlling whether a page may read cross-origin responses. Not CSRF protection. → [43](43-frontend-security-architecture.md)

**CRDT (Conflict-free Replicated Data Type)** — A data structure whose replicas converge regardless of update order; the basis of collaborative and offline editing. → [34](34-realtime-offline-and-collaboration.md)

**CSP (Content Security Policy)** — A response header restricting which scripts, styles and connections a page may use; nonces and `strict-dynamic` make it practical. → [43](43-frontend-security-architecture.md)

**CSR, SSR, SSG, ISR** — Client-side rendering; server-side rendering per request; static generation at build time; incremental regeneration of static pages. → [32](32-rendering-strategy-architecture.md)

**CSRF (Cross-Site Request Forgery)** — A site causing a user's browser to send an authenticated request to another site; prevented with `SameSite` cookies, origin checks and tokens. → [43](43-frontend-security-architecture.md)

### D

**Deferred value** — A lagging copy of a value from `useDeferredValue`, letting urgent renders go first. → [15](15-concurrent-react-suspense-and-transitions.md)

**Design tokens** — Named design decisions (colour, spacing, type) stored as data in tiers: primitive, semantic, component. → [35](35-enterprise-design-system-architecture.md)

**Discriminated union** — A TypeScript union whose members share a literal field (`status`), so impossible states can't be represented. → [04](04-typescript-at-scale.md)

**Disclosure pattern** — A button with `aria-expanded` that shows and hides content; the simple accessible alternative to a tree. → [74](74-machine-coding-drills.md)

**DTCG** — The W3C Design Tokens Community Group; its 2025.10 format is the first stable standard for token files. → [70](70-case-study-enterprise-design-system.md)

### E

**Edge runtime** — A restricted JavaScript runtime close to users (no full Node APIs), used for middleware and some rendering. → [50](50-nextjs-in-production.md)

**Effect** — Code that synchronises a component with an external system after commit (`useEffect`). → [13](13-effects-and-synchronization.md)

**Error boundary** — A class component that catches render errors below it and shows fallback UI. → [40](40-resilience-and-reliability.md)

**Event loop** — The browser's cycle of running a task, draining microtasks and rendering. → [03](03-javascript-runtime-and-engine.md)

**Event Timing** — The browser API that reports how long interactions took; the data INP is built from. → [71](71-case-study-legacy-react-modernization.md)

### F

**Feature flag** — A runtime switch that separates deploying code from releasing it. → [62](62-cicd-release-engineering-and-feature-flags.md)

**Fiber** — React's internal unit of work, one per component instance; the architecture behind interruptible rendering. → [10](10-react-internals-fiber-and-reconciliation.md)

**Fitness function** — An automated check that an architectural property holds (budgets, dependency rules, contrast). → [01](01-thinking-like-a-frontend-architect.md)

**Flight** — The wire format React uses to stream Server Component output to the client (the RSC payload). → [18](18-react-server-components-and-server-functions.md)

**Fractional index** — A sortable string key generated between two others, so reordering touches one item. → [69](69-case-study-collaborative-project-management.md)

**Fragment refs** — Refs on `<Fragment>` that expose methods over its DOM children (event listeners, focus, observers); stable since 19.3. → [16](16-react-19-features-and-the-compiler.md)

### G

**GHSA** — A GitHub Security Advisory ID. It often exists before a CVE is assigned. → [A3](A3-security-advisories-timeline.md)

**Glue work** — Coordination, documentation and unblocking that makes projects succeed and is easy to overlook. → [72](72-the-principal-frontend-engineer.md)

### H

**Headless component library** — Components that provide behaviour and accessibility without styles (React Aria, Base UI, Radix). → [35](35-enterprise-design-system-architecture.md)

**Hydration** — Attaching React to server-rendered HTML so it becomes interactive. → [17](17-ssr-streaming-and-hydration.md)

### I

**Idempotency key** — A unique key sent with a write so that retries don't apply it twice. → [40](40-resilience-and-reliability.md)

**Incremental hydration (Angular)** — Hydrating `@defer` blocks only when their triggers fire; the default since Angular 22. → [58](58-angular-at-scale.md)

**INP (Interaction to Next Paint)** — The Core Web Vital for responsiveness: the latency of the worst interactions; good is ≤ 200 ms at p75. → [39](39-web-performance-and-core-web-vitals.md)

**Interceptor** — Code wrapping every HTTP request and response, as in Angular's `HttpClient`. → [58](58-angular-at-scale.md)

### J

**JSX transform** — The compiler step turning JSX into `jsx()` calls from `react/jsx-runtime`; required since React 19. → [09](09-react-fundamentals-complete-reference.md)

### K

**Key** — A stable identity for an element among siblings, used in reconciliation; also a way to reset a subtree's state. → [09](09-react-fundamentals-complete-reference.md)

### L

**Lanes** — React's bitmask of update priorities. → [10](10-react-internals-fiber-and-reconciliation.md)

**LCP (Largest Contentful Paint)** — The Core Web Vital for loading: when the largest content element renders; good is ≤ 2.5 s at p75. → [39](39-web-performance-and-core-web-vitals.md)

**Loader** — A route-level function that fetches data before or while the route renders (React Router, TanStack Router). → [31](31-routing-architecture.md)

**Long task** — A main-thread task over 50 ms, during which input waits. → [03](03-javascript-runtime-and-engine.md)

### M

**`memo`** — Wraps a component so it skips re-rendering when its props are shallowly equal. → [38](38-react-performance-engineering.md)

**Micro-frontend** — An independently deployed part of one product's UI, owned by one team. → [61](61-micro-frontends-and-module-federation.md)

**Module Federation** — A runtime mechanism for loading code and sharing dependencies between separately built apps. → [61](61-micro-frontends-and-module-federation.md)

**Monorepo** — One repository holding many packages and apps, with tooling for task graphs and caching. → [60](60-monorepos-build-tooling-and-bundlers.md)

### O

**OnPush** — Angular's change-detection strategy that checks a component only when its inputs or signals change; the default since Angular 22. → [56](56-angular-architecture-and-dependency-injection.md)

**OpenFeature** — A vendor-neutral feature-flag API standard. → [62](62-cicd-release-engineering-and-feature-flags.md)

**Optimistic update** — Showing the expected result of a change before the server confirms it (`useOptimistic`). → [30](30-server-state-and-data-fetching.md)

**Owner Stack** — The chain of components that rendered a component, available in development through `captureOwnerStack()`. → [20](20-react-tooling-devtools-and-debugging.md)

### P

**Partial prerendering (PPR)** — A prerendered static shell with dynamic holes filled per request and streamed in. → [48](48-nextjs-rendering-and-caching.md)

**Paved road** — The default, supported way to build something, designed so the right choice is the easy one. → [63](63-architecture-governance-and-adrs.md)

**Portal** — Rendering children into a DOM node outside the parent's hierarchy while staying in the React tree. → [14](14-refs-dom-portals-and-imperative-apis.md)

**Progressive enhancement** — Building so the core works without JavaScript, then enhancing; React 19 form actions support it. → [26](26-forms-and-validation.md)

**`proxy.ts`** — Next.js 16's name for middleware: code that runs before routes. Not a security boundary on its own. → [49](49-nextjs-data-mutations-and-auth.md)

### R

**Reactive scope** — A block of code the React Compiler memoizes together, guarded by the values it depends on. → [71](71-case-study-legacy-react-modernization.md)

**Reconciliation** — React comparing the new element tree with the previous one to decide what to change. → [10](10-react-internals-fiber-and-reconciliation.md)

**Render phase** — When React calls components to compute the next UI; interruptible in concurrent rendering. → [10](10-react-internals-fiber-and-reconciliation.md)

**Resource (Angular)** — `resource()` and `httpResource()`: async values exposed as signals, stable since Angular 22. → [57](57-angular-signals-reactivity-and-rxjs.md)

**RSC (React Server Components)** — Components that run only on the server and stream their output to the client. → [18](18-react-server-components-and-server-functions.md)

**Rules of React** — Purity of components and hooks, immutability of props and state, and the Rules of Hooks; the Compiler depends on them. → [08](08-react-mental-model-and-rules.md)

**RUM (Real User Monitoring)** — Measuring performance and errors from real users' browsers. → [41](41-observability-and-diagnostics.md)

### S

**Selective hydration** — Hydrating Suspense boundaries independently, prioritising the one the user interacts with. → [17](17-ssr-streaming-and-hydration.md)

**Server Action / Server Function** — A server function marked `'use server'` that the client can call; every one is a public endpoint. → [18](18-react-server-components-and-server-functions.md)

**Signals** — Reactive values that track their readers, so only dependent computations update (Angular, Solid, Preact). → [57](57-angular-signals-reactivity-and-rxjs.md)

**Skew (version skew)** — Clients running one build talking to a server running another. → [62](62-cicd-release-engineering-and-feature-flags.md)

**Sponsorship** — Using your position to create opportunities for someone else, as distinct from mentoring. → [72](72-the-principal-frontend-engineer.md)

**State vector** — In Yjs, a summary of what a replica has seen, used to send only missing updates. → [69](69-case-study-collaborative-project-management.md)

**Streaming SSR** — Sending server-rendered HTML in pieces as Suspense boundaries resolve. → [17](17-ssr-streaming-and-hydration.md)

**Strict Mode** — Development-only double rendering and double effects that expose impure code. → [13](13-effects-and-synchronization.md)

**Suspense** — A boundary that shows a fallback while its children wait for code or data. → [15](15-concurrent-react-suspense-and-transitions.md)

### T

**Taint APIs** — Experimental React APIs that throw if a marked object or value reaches a Client Component. → [A4](A4-experimental-and-canary-apis.md)

**Tearing** — Parts of the UI showing different versions of the same external state during one render. → [15](15-concurrent-react-suspense-and-transitions.md)

**Transition** — A non-urgent, interruptible update (`startTransition`, `useTransition`). → [15](15-concurrent-react-suspense-and-transitions.md)

**Tree-shaking** — Removing unused exports at build time; depends on static ES module imports. → [60](60-monorepos-build-tooling-and-bundlers.md)

**Trusted publishing** — Publishing npm packages from CI with short-lived OIDC credentials instead of long-lived tokens, with provenance. → [62](62-cicd-release-engineering-and-feature-flags.md)

**Trusted Types** — A browser API that makes DOM-injection sinks accept only vetted values; React 19.3 passes them through. → [43](43-frontend-security-architecture.md)

**Turbopack** — The Rust bundler built into Next.js; the default since Next.js 16. → [60](60-monorepos-build-tooling-and-bundlers.md)

### U

**`useEffectEvent`** — Reads the latest props and state inside an effect without making them dependencies; stable since 19.2. → [13](13-effects-and-synchronization.md)

**`useSyncExternalStore`** — Subscribes to an external store without tearing. → [29](29-client-state-management.md)

### V

**View Transitions** — A browser API that animates between UI states; React's `<ViewTransition>` is stable since 19.3. → [24](24-animation-and-motion-systems.md)

**Virtualization** — Rendering only the visible part of a long list. → [25](25-complex-ui-engineering.md)

**Vite** — The build tool and dev server; since Vite 8 it bundles with Rolldown, a Rust bundler. → [60](60-monorepos-build-tooling-and-bundlers.md)

### W

**WCAG** — The Web Content Accessibility Guidelines; 2.2 level AA is the common legal and procurement target. → [36](36-accessibility-engineering.md)

**Web Worker** — A background thread for JavaScript without DOM access. → [06](06-modern-web-platform-apis.md)

### Z

**Zoneless** — Angular change detection without zone.js, driven by signals and explicit notifications; the default for new apps since Angular 21. → [57](57-angular-signals-reactivity-and-rxjs.md)

---

## Further reading

### Specifications and standards

- [HTML Living Standard](https://html.spec.whatwg.org/) and [ECMAScript](https://tc39.es/ecma262/).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).
- [Design Tokens Format Module 2025.10](https://www.designtokens.org/TR/2025.10/).
- [web.dev: Core Web Vitals](https://web.dev/articles/vitals).

### Official documentation

- [react.dev](https://react.dev/) and the [React blog](https://react.dev/blog).
- [Next.js](https://nextjs.org/docs), [React Router](https://reactrouter.com/), [TanStack](https://tanstack.com/), [Expo](https://docs.expo.dev/).
- [Angular](https://angular.dev/).
- [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), [Storybook](https://storybook.js.org/docs).
- [TypeScript](https://www.typescriptlang.org/docs/).

### Security

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/).
- [PortSwigger Web Security Academy](https://portswigger.net/web-security).
- The advisories pages listed in [A3](A3-security-advisories-timeline.md).

### Books

- Neal Ford, Rebecca Parsons and Patrick Kua, *Building Evolutionary Architectures*: fitness functions and incremental change.
- Martin Kleppmann, *Designing Data-Intensive Applications*: replication, consistency and the ideas behind CRDTs.
- Heydon Pickering, *Inclusive Components*: accessible component patterns, one at a time.
- Will Larson, *Staff Engineer*, and Tanya Reilly, *The Staff Engineer's Path*: the role described in [72](72-the-principal-frontend-engineer.md).
- Matthew Skelton and Manuel Pais, *Team Topologies*: Conway's law, applied.

### Essays worth rereading

- Dan Abramov, [overreacted.io](https://overreacted.io/): React's mental model from one of its authors.
- Ink & Switch, [Local-first software](https://www.inkandswitch.com/local-first/).
- Tanya Reilly, ["Being Glue"](https://noidea.dog/glue).

---

[← Previous: A4 — Experimental, Canary and Unannounced APIs](A4-experimental-and-canary-apis.md) · [Index](README.md) · [Back to the start: 01 — Thinking Like a Frontend Architect →](01-thinking-like-a-frontend-architect.md)
