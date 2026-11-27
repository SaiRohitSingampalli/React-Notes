# The Complete React UI Architecture Handbook

### From React Fundamentals to Enterprise-Scale Systems, with Next.js and Angular

![React](https://img.shields.io/badge/React-19.3.1%2B-61dafb?logo=react&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)
![Angular](https://img.shields.io/badge/Angular-22-dd0031?logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-6%20%7C%207-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Baseline](https://img.shields.io/badge/baseline-November%202026-555)

> A React developer understands how to build components. A React UI architect understands how to design, scale, secure, operate and evolve an entire frontend system. This handbook is written for the second job, without skipping any of the first.

---

## Why this handbook exists

Frameworks change every eighteen months. The forces they respond to (latency, state, change, trust, people) have not changed in twenty years. This book teaches both layers:

1. **The complete technical foundation.** Every React 19.3 API, hook and component; how Fiber, lanes, hydration and the Flight protocol really work; the browser platform underneath it all.
2. **The engineering decisions that connect the technologies.** Naming TanStack Query, Zustand and Redux Toolkit is easy. An architect has to answer harder questions. *When should each one be introduced? What data must never be duplicated across stores? Who owns invalidation? What happens when an optimistic mutation conflicts with the server?*

The book is organised around **five architectural capabilities**:

| Capability | What it means in practice | Where it lives |
|---|---|---|
| **System design** | Boundaries, composition, scalability, rendering topology, distributed systems | Parts I, III, IV, XI, XII |
| **Data architecture** | State ownership, caching, consistency, contracts | Part IV |
| **UI platform engineering** | Design systems, reusable packages, accessibility, i18n | Parts V, X |
| **Production engineering** | Performance, reliability, observability, security | Parts VI, VII |
| **Technical leadership** | Governance, ADRs, migrations, trade-offs, case studies, hiring, org design, business cases | Parts XI, XII |

## Who it is for

| You are… | Use the handbook to… |
|---|---|
| A senior engineer aiming for **staff or principal** | Close the gap between "I can build it" and "I can explain why, compare it with the alternatives, and lead the change" |
| A **frontend or UI architect**, or a tech lead | Use it as a reference for design reviews, ADRs, RFCs, platform decisions and incident reviews |
| Preparing for a **staff-plus interview loop** | Work through the system-design method, the case studies, the question bank and the machine-coding drills |
| An **Angular engineer** moving to React and Next.js, or the reverse | Use the comparison chapters to map concepts between the two worlds |
| An **engineering manager** of frontend teams | Read governance, delivery, migration and leadership |

---

## How every chapter is built

| Section | What it gives you |
|---|---|
| **TL;DR** | The 5–8 sentences you'd say in an elevator or an interview |
| **Mental model** | The one picture that makes the rest obvious |
| **Deep dive** | Internals, mechanics and code: how it really works |
| **Decision framework** | Problem → constraints → competing approaches → decision criteria → trade-offs → failure modes → migration path |
| **Pitfalls and anti-patterns** | What goes wrong in production, and why |
| **Architect's checklist** | A review checklist you can paste into a design doc |
| **Interview angles** | Principal-level questions, each with a model answer |
| **Further reading** | Primary sources: specs, official docs, maintainers' own writing |

### How to read the rules

Most guidance in this book is a **default**: what to do unless you have a specific reason, and the safeguards that make the exception safe. Where a rule has no exceptions (security, accessibility and correctness requirements such as authorizing every Server Function or never storing tokens in `localStorage`), the text says so. Chapter 28's duplication table shows the convention: each row is labelled *default* or *requirement*, with its deliberate exceptions.

Claims marked *verified* come from code and measurements run while writing, with the versions named in each chapter. Corrections made after publication are listed in [CHANGELOG.md](CHANGELOG.md).

### Companion code

The runnable code lives in this folder too, so the handbook stays flat. There are 25 example pages, [E03](E03-javascript-runtime-and-engine.md) to [E79](E79-distributed-systems-design-for-frontend-architects.md), covering 27 chapters. Each is named after its chapter, explains a small project, and then lists every file in it. `node extract-examples.mjs` writes the pages out as project folders, with exact lockfiles from `examples.lock.json`. Every project passes a clean `npm ci`, its tests, its type-check and its build on Node 22.23 (169 tests in all). The code is extracted from the chapters by script rather than retyped, so what you run is what you read. Start with [E00 — Running the Examples](E00-running-the-examples.md). Chapters with an example say so in a **Runnable code** tip before their further reading.

| Area | Example pages |
|---|---|
| Foundations and React | [E03](E03-javascript-runtime-and-engine.md), [E11](E11-build-your-own-react.md), [E12](E12-hooks-in-depth.md), [E25](E25-complex-ui-engineering.md), [E26](E26-forms-and-validation.md), [E29](E29-client-state-management.md) |
| Data, reliability and security | [E33](E33-api-integration-bff-and-contracts.md), [E37](E37-internationalization-and-localization.md), [E40](E40-resilience-and-reliability.md), [E43](E43-frontend-security-architecture.md), [E45](E45-authentication-and-authorization.md) |
| Frameworks | [E51](E51-react-router-v8-framework-mode.md) React Router, [E52](E52-tanstack-start-and-router.md) TanStack Start, [E68](E68-case-study-ecommerce-storefront.md) Next.js, [E56](E56-angular-architecture-and-dependency-injection.md) Angular (chapters 56, 57 and 59) |
| Case studies and drills | [E65](E65-ai-powered-react-interfaces.md), [E66](E66-frontend-system-design.md), [E67](E67-case-study-enterprise-saas-dashboard.md), [E68](E68-case-study-ecommerce-storefront.md), [E69](E69-case-study-collaborative-project-management.md), [E70](E70-case-study-enterprise-design-system.md), [E74](E74-machine-coding-drills.md) |
| Principal-level models | [E75](E75-experimentation-and-product-analytics.md), [E76](E76-frontend-cost-and-capacity-engineering.md), [E78](E78-business-cases-and-investment-arguments.md), [E79](E79-distributed-systems-design-for-frontend-architects.md) |

### Running example: Acme

A fictional company called **Acme** threads through the book, so patterns and decisions add up to something concrete:

| Acme product | Architectural flavour | Main case study |
|---|---|---|
| **Acme Insights**: multi-tenant analytics SaaS | Auth, RBAC/ABAC, feature modules, server-state caching, charts, tables, observability | [67](67-case-study-enterprise-saas-dashboard.md) |
| **Acme Store**: public storefront | SEO, streaming, RSC, edge caching, checkout, optimistic cart | [68](68-case-study-ecommerce-storefront.md) |
| **Acme Boards**: collaborative project management | WebSockets, offline, CRDTs, conflict resolution | [69](69-case-study-collaborative-project-management.md) |
| **Prism**: Acme's design system | Tokens, headless primitives, theming, accessibility, versioned packages | [70](70-case-study-enterprise-design-system.md) |
| **Acme Admin**: a 2019-era React 16 console | Modernisation to React 19.3, adopting the Compiler, measurable improvements | [71](71-case-study-legacy-react-modernization.md) |

Each case study ships the deliverables an architect actually produces: an **architecture diagram, repository layout, ADR, deployment pipeline, operational checklist and performance report**.

### Conventions

- Code is **TypeScript** unless the point is JavaScript semantics. Diagrams are **Mermaid**, which GitHub renders natively.
- APIs carry **channel badges**: `Stable` · `Stable (RSC)` · `Dev-only` · `Canary` · `Experimental` · `Deprecated` · `Removed`.
- GitHub alert blocks mark the kind of advice:

> [!NOTE]
> Background or nuance.

> [!TIP]
> A technique that pays off quickly.

> [!IMPORTANT]
> A principle you should be able to defend in a design review.

> [!WARNING]
> A common production failure mode.

> [!CAUTION]
> A security or data-loss risk.

---

## Version baseline and security floors (November 2026)

| Technology | Baseline | Highlights at this version |
|---|---|---|
| React | **19.3.1** | `<ViewTransition>`, Fragment refs, `browser()`, Trusted Types, Server Components rendering `<Context>`; 19.2 added `<Activity>`, `useEffectEvent`, `cacheSignal`, Performance Tracks, Partial Pre-rendering. **No React 20 has been announced.** |
| React Compiler | **1.x** | Stable since Oct 2025; an experimental Rust port was merged in Jun 2026 |
| React DevTools | **8.0** | Suspense tab on by default; the Timeline tab was removed in favour of Performance Tracks in the browser |
| Next.js | **16.4** | Cache Components recommended for all apps and on by default **for new** `create-next-app` projects; it becomes the default for everyone in Next.js 17 |
| React Router | **8.x** | ESM-only, middleware on by default, `react-router-dom` removed |
| TanStack Start | **1.x** | Stable since Oct 13, 2026 |
| Expo / React Native | **SDK 58 / RN 0.88** | New Architecture mandatory since RN 0.82 |
| Angular | **22** | Zoneless and `OnPush` by default, Signal Forms stable; majors are now yearly (v23 ≈ Jun 2027) |
| TypeScript | **6.0 / 7.0** | 7.0 is the native Go port, about 10× faster; its compiler API only arrives in 7.1 |
| Vite / Vitest | **8 / 5** | Rolldown + Oxc under Vite |
| npm | **12** | Dependency install scripts are off by default |

> [!CAUTION]
> **Security floors.** React Server Components have had **nine** security advisories since December 2025 (React2Shell, CVSS 10.0, through CVE-2026-126187, CVSS 9.5 RCE). Any app using RSC must run at least:
>
> | Package line | Minimum safe version |
> |---|---|
> | React / `react-server-dom-*` 19.0.x | **19.0.9** |
> | 19.1.x | **19.1.10** |
> | 19.2.x | **19.2.9** |
> | 19.3.x | **19.3.1** |
> | Next.js 16.x / 15.x | **16.4.5 / 15.5.29** (13.x and 14.x are end-of-life, with no fix) |
>
> Client-only React apps (no server rendering of RSC) are not affected. See [44 RSC Security](44-rsc-security-threat-model.md) and [A3 Advisory Timeline](A3-security-advisories-timeline.md).

---

## Table of contents

### Part I: React and Browser Foundations
| # | Chapter | What you will learn |
|---|---|---|
| 01 | [Thinking Like a Frontend Architect](01-thinking-like-a-frontend-architect.md) | Quality attributes, trade-off analysis, the frontend as a distributed system, reversibility, Conway's law |
| 02 | [How Browsers Render](02-browser-rendering-pipeline.md) | Parsing, the critical rendering path, style → layout → paint → composite, the frame budget, long tasks |
| 03 | [The JavaScript Runtime and Engine](03-javascript-runtime-and-engine.md) | The event loop, closures, V8 tiers, hidden classes, GC, memory leaks, modules, cancellation |
| 04 | [TypeScript at Scale](04-typescript-at-scale.md) | Types as sets, domain modelling, branded types, schema validation at boundaries, typing React, TS 7 |
| 05 | [Networking, Caching and Delivery](05-networking-caching-and-delivery.md) | HTTP/2 and HTTP/3, Cache-Control mastery, CDNs, resource hints, Early Hints, CORS, cookies |
| 06 | [Modern Web Platform APIs](06-modern-web-platform-apis.md) | Workers, Service Workers, Web Components, Observers, storage, Popover, Anchor Positioning, View Transitions, Navigation API |
| 07 | [Modern CSS and Layout Architecture](07-modern-css-and-layout-architecture.md) | Cascade layers, container queries, `:has()`, nesting, custom properties, logical properties, Grid and Flexbox, fluid type |
| 08 | [React's Mental Model and the Rules of React](08-react-mental-model-and-rules.md) | UI = f(state), purity, render vs commit, state as a snapshot, identity, the Rules of React |
| 09 | [React Fundamentals: The Complete Reference](09-react-fundamentals-complete-reference.md) | JSX, props, children, conditional rendering, lists and keys, events, inputs, fragments, StrictMode, every fundamental with its edge cases |

### Part II: React 19.3 Complete Reference
| # | Chapter | What you will learn |
|---|---|---|
| 10 | [React Internals: Fiber, Reconciliation and Lanes](10-react-internals-fiber-and-reconciliation.md) | Fibers, the work loop, double buffering, diffing, keys, bailouts, lanes, commit phases, events, hydration |
| 11 | [Build Your Own React](11-build-your-own-react.md) | A working mini React: elements, a fiber work loop, reconciliation, `useState`, `useEffect`, from scratch |
| 12 | [Hooks in Depth](12-hooks-in-depth.md) | How hooks are stored, every built-in hook, when to use it and when not, stale closures, custom-hook design |
| 13 | [Effects and Synchronization](13-effects-and-synchronization.md) | Effects as synchronization, the "you might not need an effect" catalogue, races, cleanup, `useEffectEvent` |
| 14 | [Refs, the DOM, Portals and Imperative APIs](14-refs-dom-portals-and-imperative-apis.md) | Refs as props, ref cleanup, Fragment refs, `useImperativeHandle`, portals, `flushSync`, focus and scroll, third-party widgets |
| 15 | [Concurrent React: Suspense, Transitions, Activity and View Transitions](15-concurrent-react-suspense-and-transitions.md) | Interruptible rendering, transitions, deferred values, Suspense boundary design, `<Activity>`, `<ViewTransition>` |
| 16 | [React 19.x Features and the React Compiler](16-react-19-features-and-the-compiler.md) | Actions, `useActionState`, `useOptimistic`, `use()`, metadata, resource APIs, the Compiler's internals and rollout |
| 17 | [SSR, Streaming and Hydration with React DOM](17-ssr-streaming-and-hydration.md) | Server APIs, streaming, selective hydration, mismatches, `browser()`, Partial Pre-rendering, SSR from scratch |
| 18 | [React Server Components and Server Functions](18-react-server-components-and-server-functions.md) | The two-graph architecture, the Flight protocol, serialization, composition and boundary diagrams, cache topology |
| 19 | [Class Components, Lifecycles and Legacy APIs](19-class-components-lifecycles-and-legacy-apis.md) | Every lifecycle, error boundaries, `PureComponent`, HOCs, `Children`/`cloneElement`, removed APIs, migrating to hooks |
| 20 | [React Tooling, DevTools and Debugging Workflows](20-react-tooling-devtools-and-debugging.md) | DevTools 8, Performance Tracks, Owner Stacks, Fast Refresh internals, lint rules, diagnosing real performance and hydration problems |

### Part III: Component and UI Architecture
| # | Chapter | What you will learn |
|---|---|---|
| 21 | [Frontend Architecture Styles and Application Boundaries](21-frontend-architecture-styles-and-boundaries.md) | Layered, vertical-slice, feature-first, hexagonal, modular monolith; dependency direction, public exports, DI, composition roots |
| 22 | [Component Architecture, Contracts and Design Patterns](22-component-architecture-and-patterns.md) | Component contracts, composition, compound and headless components, controlled vs uncontrolled, polymorphism |
| 23 | [Styling Architecture and Theming](23-styling-architecture-and-theming.md) | CSS Modules, Tailwind v4, zero-runtime CSS-in-JS, runtime CSS-in-JS and RSC, theming, dark mode |
| 24 | [Animation and Motion Systems](24-animation-and-motion-systems.md) | CSS transitions, View Transitions, Motion, FLIP, gestures, animation budgets, reduced motion |
| 25 | [Complex UI Engineering](25-complex-ui-engineering.md) | Overlays and stacking, menus, dialogs, virtualized grids, tree views, editors, drag-and-drop, canvas, large forms |
| 26 | [Forms and Validation Architecture](26-forms-and-validation.md) | Form Actions, React Hook Form, TanStack Form, Standard Schema, server validation, progressive enhancement |
| 27 | [React Best Practices, Anti-patterns and Code Review Guide](27-react-best-practices-and-code-review.md) | A code-review rubric, the 40 most common anti-patterns, and the "replace old patterns" list for React 19.3 |

### Part IV: State, Data and Server Architecture
| # | Chapter | What you will learn |
|---|---|---|
| 28 | [State and Data Ownership Architecture](28-state-and-data-ownership-architecture.md) | **Flagship.** State categories, source of truth, cache ownership, invalidation, mutation races, optimistic conflicts, persistence, consistency |
| 29 | [Client State Management](29-client-state-management.md) | Context performance, Redux Toolkit, Zustand, Jotai, XState, signals; when to introduce each, and migration scenarios |
| 30 | [Server State, Data Fetching and Cache Invalidation](30-server-state-and-data-fetching.md) | TanStack Query internals, SWR, RTK Query, GraphQL clients, waterfalls, prefetching, optimistic mutations |
| 31 | [Routing Architecture](31-routing-architecture.md) | Nested routes, loaders and actions, type-safe routing, search params as state, code splitting, URL design |
| 32 | [Rendering Strategy Architecture](32-rendering-strategy-architecture.md) | CSR, SSR, SSG, ISR, streaming, RSC, PPR, islands, edge rendering, cache topology, choosing per route |
| 33 | [API Integration, BFF and Data Contracts](33-api-integration-bff-and-contracts.md) | BFFs, REST vs GraphQL vs tRPC, OpenAPI codegen, runtime validation, error contracts, idempotency |
| 34 | [Real-Time, Offline and Collaborative State](34-realtime-offline-and-collaboration.md) | SSE and WebSockets, ordering, reconnection, PWAs, local-first sync engines, CRDTs vs OT |

### Part V: Enterprise Design Systems and Inclusive UI
| # | Chapter | What you will learn |
|---|---|---|
| 35 | [Enterprise Design System Architecture](35-enterprise-design-system-architecture.md) | Tokens, primitives, headless components, theming, multi-brand, versioning, governance, multi-framework systems |
| 36 | [Accessibility as a System Contract](36-accessibility-engineering.md) | WCAG 2.2, the EAA, APG patterns, focus management, screen readers, automated and manual audits, a11y programs |
| 37 | [Internationalization and Localization](37-internationalization-and-localization.md) | ICU MessageFormat, Intl, Temporal, RTL, font fallback, layout expansion, locale routing, translation pipelines |

### Part VI: Performance, Reliability, Observability and Testing
| # | Chapter | What you will learn |
|---|---|---|
| 38 | [React Performance Engineering](38-react-performance-engineering.md) | The render cost model, profiling workflows, the Compiler and when manual memoization is still justified, virtualization |
| 39 | [Production Web Performance: Core Web Vitals, Budgets and RUM](39-web-performance-and-core-web-vitals.md) | LCP, INP and CLS sub-parts, scheduling vs rendering, long tasks, bundle budgets, third parties, CI regression gates |
| 40 | [Resilience and Reliability Engineering](40-resilience-and-reliability.md) | Failure boundaries, retries, timeouts, fallbacks, degraded modes, offline behaviour, version skew |
| 41 | [Observability and Diagnostics](41-observability-and-diagnostics.md) | Browser telemetry, logging, tracing, source maps, release correlation, frontend SLOs, incident response |
| 42 | [Testing Architecture](42-testing-architecture.md) | Testing Library in depth, the trophy vs the pyramid, Vitest browser mode, MSW, Playwright, contract, visual, a11y and load tests |

### Part VII: Security and Enterprise Architecture
| # | Chapter | What you will learn |
|---|---|---|
| 43 | [Frontend Security Architecture](43-frontend-security-architecture.md) | XSS, CSP, Trusted Types, CSRF, session boundaries, supply chain after Shai-Hulud and npm 12, OWASP ASVS 5.0 |
| 44 | [RSC Security: Threat Model, CVE History and Patch Operations](44-rsc-security-threat-model.md) | Flight deserialization as an attack surface, all nine advisories, operational patching procedures |
| 45 | [Authentication and Authorization](45-authentication-and-authorization.md) | OAuth 2.1/OIDC with PKCE, BFF token handler, passkeys, RBAC/ABAC, why hiding a button is not authorization |
| 46 | [Enterprise SaaS Architecture](46-enterprise-saas-architecture.md) | Multi-tenancy, entitlements, customer branding, audit trails, privacy, legacy integration, enterprise SSO |

### Part VIII: The Modern React Ecosystem
| # | Chapter | What you will learn |
|---|---|---|
| 47 | [Next.js App Router Architecture](47-nextjs-app-router-architecture.md) | File conventions, layouts, parallel and intercepting routes, the server/client boundary, `proxy.ts`, navigation |
| 48 | [Next.js Rendering and Caching](48-nextjs-rendering-and-caching.md) | Cache Components, `'use cache'`, `cacheLife`/`cacheTag`, Partial Prefetching, `ensureStatic`, ISR, the legacy model |
| 49 | [Next.js Data, Mutations and Auth](49-nextjs-data-mutations-and-auth.md) | Server Actions, route handlers, the data access layer, revalidation, auth patterns, CVE-2025-29927 |
| 50 | [Next.js in Production](50-nextjs-in-production.md) | Adapters and self-hosting, images, fonts and scripts, observability, skew protection, security release cadence, upgrades |
| 51 | [React Router v8 in Framework Mode](51-react-router-v8-framework-mode.md) | Loaders, actions, middleware, modes, RSC support, migration from v6/v7 and Remix v2 |
| 52 | [TanStack Start and TanStack Router](52-tanstack-start-and-router.md) | Type-safe routing, search-param state, server functions, optional RSC, deployment |
| 53 | [React Native and Expo for Web Architects](53-react-native-and-expo.md) | New Architecture, Expo Router, code sharing, React Native Web, universal apps |
| 54 | [Choosing a React Framework](54-choosing-a-react-framework.md) | Rendering model, deployment requirements, cache semantics and team complexity compared; Vite SPA, Astro, Waku; Remix 3 is no longer React |
| 55 | [React Ecosystem Atlas 2026](55-react-ecosystem-atlas-2026.md) | The library to reach for in each category, when to introduce it, and when not to |

### Part IX: Angular for the Polyglot Architect
| # | Chapter | What you will learn |
|---|---|---|
| 56 | [Angular Architecture and Dependency Injection](56-angular-architecture-and-dependency-injection.md) | Standalone components, hierarchical injectors, `@Service()`, the compiler, change detection from Zone.js to zoneless |
| 57 | [Angular Signals, Reactivity and RxJS](57-angular-signals-reactivity-and-rxjs.md) | Signals, signal I/O, Resources, Signal Forms, RxJS interop, NgRx Signal Store |
| 58 | [Angular at Scale](58-angular-at-scale.md) | Routing, HTTP, SSR and incremental hydration, `@defer`, Vitest, Nx, Native Federation, Aria and CDK, upgrades |
| 59 | [React vs Angular: An Architect's Comparison](59-react-vs-angular-architecture-comparison.md) | Reactivity models, DI vs hooks, a decision matrix, coexistence and migration |

### Part X: Platform Engineering and Delivery
| # | Chapter | What you will learn |
|---|---|---|
| 60 | [Monorepos, Build Tooling and Bundlers](60-monorepos-build-tooling-and-bundlers.md) | pnpm, Nx, Turborepo, how bundlers work, Vite 8 with Rolldown, Turbopack, Rspack, linting at scale, publishing |
| 61 | [Micro-Frontends and Module Federation](61-micro-frontends-and-module-federation.md) | When (and when not) to split, Module Federation 2.0, shared dependencies, ownership models, independent deployment |
| 62 | [CI/CD, Release Engineering and Feature Flags](62-cicd-release-engineering-and-feature-flags.md) | Pipelines, environments, OpenFeature, canaries, rollback, version skew, dependency updates |

### Part XI: Architecture Leadership and Case Studies
| # | Chapter | What you will learn |
|---|---|---|
| 63 | [Architecture Governance: ADRs, Fitness Functions, Ownership and Tech Debt](63-architecture-governance-and-adrs.md) | ADRs and RFCs, architecture reviews, fitness functions, ownership, tech-debt economics |
| 64 | [Migration Playbooks](64-migration-playbooks.md) | Strangler fig, codemods, and step-by-step plans for the migrations you will actually face |
| 65 | [AI-Powered React Interfaces and AI-Assisted Engineering](65-ai-powered-react-interfaces.md) | Streamed and generative UI, tool calls, human approval, accessible live updates, prompt-injection boundaries, agents in the dev loop |
| 66 | [Frontend System Design: Method and Classic Prompts](66-frontend-system-design.md) | A repeatable method, plus news feed, typeahead, chat, media player and more |
| 67 | [Case Study: Enterprise SaaS Dashboard](67-case-study-enterprise-saas-dashboard.md) | Acme Insights: multi-tenancy, auth, feature modules, caching, tables, charts, observability |
| 68 | [Case Study: Large E-commerce Storefront](68-case-study-ecommerce-storefront.md) | Acme Store: SEO, streaming, RSC, caching, checkout, optimistic cart, performance |
| 69 | [Case Study: Collaborative Project-Management App](69-case-study-collaborative-project-management.md) | Acme Boards: WebSockets, offline, conflict resolution, shared state |
| 70 | [Case Study: Building an Enterprise Design System](70-case-study-enterprise-design-system.md) | Prism: headless primitives, tokens, themes, Storybook, testing, versioned packages |
| 71 | [Case Study: Legacy React Modernization](71-case-study-legacy-react-modernization.md) | Acme Admin: React 16 → 19.3, Compiler adoption, feature reorganisation, measured results |
| 72 | [The Principal Frontend Engineer](72-the-principal-frontend-engineer.md) | Archetypes, scope, strategy, influence, writing, sponsorship, the staff-plus interview loop |
| 73 | [Interview Question Bank](73-interview-question-bank.md) | 233 questions with model answers, by topic |
| 74 | [Machine-Coding Drills](74-machine-coding-drills.md) | Debounce, Promise utilities, signals, a virtual list, an LRU cache, hooks, and UI components with commentary |

### Part XII: Principal-Level Breadth
| # | Chapter | What you will learn |
|---|---|---|
| 75 | [Experimentation and Product Analytics](75-experimentation-and-product-analytics.md) | Assignment you can trust, exposure logging, sample size, peeking, sample ratio mismatch, Web Vitals guardrails, experiments and caching |
| 76 | [Frontend Cost and Capacity Engineering](76-frontend-cost-and-capacity-engineering.md) | A runnable cost model, unit costs, Little's law, the thundering herd, observability and CI costs |
| 77 | [Hiring, Leveling and Org Design](77-hiring-leveling-and-org-design.md) | Interview loops, anchored rubrics, calibration, the IC ladder, team topologies, platform teams, the first 90 days |
| 78 | [Business Cases and Investment Arguments](78-business-cases-and-investment-arguments.md) | The one-page memo, turning outcomes into money, NPV and payback, sensitivity, cost of delay |
| 79 | [Distributed Systems Design for Frontend Architects](79-distributed-systems-design-for-frontend-architects.md) | Estimation, building blocks, consistency and the UI, consistent hashing, queues and idempotency, rate limiting, a worked design |

### Appendices: Versioned Technical Reference
| # | Appendix | Contents |
|---|---|---|
| A1 | [React API Reference Tables](A1-react-api-reference.md) | Every component, hook and API in `react`, `react-dom`, `/client`, `/server`, `/static`, with channel labels, versions and a verified export diff |
| A2 | [React Version History, Release Channels and Governance](A2-react-version-history-and-governance.md) | 0.3 → 19.3.1, why each paradigm shift happened, release channels, the React Foundation |
| A3 | [Security Advisories Timeline](A3-security-advisories-timeline.md) | React, Next.js and Angular advisories from 2025–26, with affected and fixed versions, current floors and a response playbook |
| A4 | [Experimental, Canary and Unannounced APIs](A4-experimental-and-canary-apis.md) | What's in flight, and what's only rumour |
| A5 | [Glossary and Further Reading](A5-glossary-and-further-reading.md) | Terms and a curated reading list |

---

## Reading paths

| Goal | Path |
|---|---|
| 🎯 **Staff/principal interview in 3 weeks** | 01 → 08 → 10 → 12 → 13 → 15 → 18 → 21 → 28 → 30 → 32 → 38 → 39 → 66 → 67 → 72 → 73 → 74 → 79 |
| 🧭 **Principal-level breadth** | 72 → 77 → 78 → 75 → 76 → 79 → 63 |
| ⚛️ **Know everything about React** | 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 22 → 27 → A1 |
| 🏛️ **Newly appointed frontend architect** | 01 → 21 → 28 → 32 → 54 → 35 → 60 → 61 → 62 → 63 → 64 → 72 |
| 🅰️→⚛️ **Angular engineer moving to React and Next.js** | 56 → 57 → 59 → 08 → 12 → 13 → 15 → 18 → 47 → 48 |
| ⚛️→🅰️ **React engineer inheriting an Angular codebase** | 08 → 56 → 57 → 58 → 59 |
| 🔥 **Performance firefighter** | 02 → 03 → 38 → 39 → 05 → 32 → 20 → 50 |
| 🔐 **Security and compliance owner** | 43 → 44 → 45 → 46 → 18 → 49 → 36 → 60 → A3 |
| 🧱 **Platform or design-system lead** | 35 → 70 → 23 → 07 → 36 → 60 → 42 → 63 |

---

## The ten principles behind these notes

1. **The browser is the runtime; the framework is a library on top of it.** If you can't explain a problem in terms of the event loop, the network and the rendering pipeline, you haven't found the problem yet.
2. **Every piece of state has exactly one owner.** Find it before you write code: the URL, the server cache, a form, a component, or a store.
3. **Server state is a cache, not state.** It is stale by default; design invalidation first.
4. **Every abstraction is paid for in bytes, milliseconds or people.** Know which currency you're spending.
5. **Measure in the field, at the 75th percentile, on a mid-tier Android.** Your laptop is not your user.
6. **Accessibility and security are properties of the architecture, not tickets.**
7. **Hiding a button is not authorization.** Every authorization decision is enforced on the server.
8. **Prefer reversible decisions.** Make irreversible ones slowly, in writing, with the alternatives you rejected.
9. **Boundaries are the architecture**: module, network, deploy, team, trust, failure.
10. **Conway's law is undefeated.** Design the organisation and the system together.

---

## Keeping it current

- **Facts carry dates.** "As of Next.js 16.4" ages well; "Next.js now does X" does not.
- **Principles over APIs.** When an API changes, a chapter should need a patch, not a rewrite.
- **Primary sources.** Every chapter ends with links to specs, official docs and maintainers' writing.
- **No speculation.** There is no React 20 chapter. Unreleased work appears only in [A4](A4-experimental-and-canary-apis.md), labelled with its channel.

## How to use these notes

Fork them, annotate them, and add your own war stories under each chapter's **Architect's checklist**. That's where these notes become yours.
