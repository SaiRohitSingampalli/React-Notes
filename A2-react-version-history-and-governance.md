# A2 — React Version History, Release Channels and Governance

> Every big change in React was an answer to a specific pain. Knowing the pain is how you predict which parts of today's React will last.

**Prerequisites:** none · **Related:** [A1 React API Reference](A1-react-api-reference.md) · [A3 Security Advisories Timeline](A3-security-advisories-timeline.md) · [A4 Experimental and Canary APIs](A4-experimental-and-canary-apis.md) · [16 React 19 Features and the Compiler](16-react-19-features-and-the-compiler.md) · [64 Migration Playbooks](64-migration-playbooks.md)

> [!NOTE]
> Release dates are npm publish dates from `npm view react time`, checked on 25 November 2026. The `react` versions published to npm in 2012 belong to an unrelated earlier package; Facebook's React appears under that name from 0.8.0 (December 2013).

---

## TL;DR

- **Thirteen years, eight big shifts:** the virtual DOM (2013), function components and one-way data (2014–15), Fiber (2017), Hooks (2019), concurrent rendering (2022), Server Components (stable in 2024), the Compiler (2025) and the React Foundation (2026).
- **Each shift solved a pain that the previous model created:** unpredictable DOM mutation, logic that couldn't be shared, rendering that couldn't be interrupted, waterfalls and bundle bloat, and memoization by hand.
- **Three release channels:** `latest` (stable), `canary` (what frameworks build on) and `experimental` (features under evaluation).
- **Removals are preceded by warnings.** 18.3 was 18.2 plus warnings for everything 19.0 removed.
- **Security fixes are backported across minor lines.** In 2025–26 every RSC fix shipped for 19.0, 19.1 and 19.2 (and 19.3 once it existed).
- **Since February 2026, React is governed by the React Foundation** under the Linux Foundation, with technical governance independent of its funding board.

---

## 1. Timeline

| Version | Released | Headline | Why it mattered |
|---|---|---|---|
| 0.3 | 29 May 2013 (open-sourced at JSConf US) | Components, JSX, a virtual DOM | UI as a function of state, instead of hand-written DOM mutation |
| 0.8 | 19 Dec 2013 | First release on npm as `react` | The start of the npm-based ecosystem |
| 0.13 | 10 Mar 2015 | ES2015 class components | Components as standard JavaScript classes, not `createClass` |
| 0.14 | 7 Oct 2015 | `react-dom` split out; stateless function components | React became renderer-agnostic (React Native launched the same year) |
| 15.0 | 7 Apr 2016 | Version scheme change; `document.createElement` for initial render | Dropped the extra `<span>`s; signalled production maturity |
| 15.5 | 7 Apr 2017 | PropTypes and `createClass` moved to separate packages | The start of slimming the core |
| 16.0 | 26 Sep 2017 | Fiber; fragments and strings from render; portals; error boundaries; MIT licence | The architecture that made everything after it possible |
| 16.3 | 29 Mar 2018 | New context API, `createRef`, `forwardRef`, `getDerivedStateFromProps`, `StrictMode` | A path away from unsafe lifecycles, in preparation for async rendering |
| 16.6 | 23 Oct 2018 | `memo`, `lazy`, `Suspense` for code splitting | The first piece of Suspense |
| 16.8 | 6 Feb 2019 | Hooks | Logic reuse without classes, higher-order components or render props |
| 16.9 | 8 Aug 2019 | `<Profiler>` API, `UNSAFE_` lifecycle warnings, async `act` | Tooling for the Hooks era |
| 16.14 | 14 Oct 2020 | The new JSX transform, backported | No more `import React` for JSX |
| 17.0 | 20 Oct 2020 | "No new features": events attached to the root, gradual upgrades | Made it possible to run two React versions in one page |
| 18.0 | 29 Mar 2022 | Concurrent rendering via `createRoot`; automatic batching; transitions; streaming SSR with Suspense; `useId`, `useSyncExternalStore` | Rendering became interruptible and prioritised |
| 18.2 | 14 Jun 2022 | Fixes | The long-lived 18 release |
| 18.3 | 25 Apr 2024 | 18.2 plus warnings for every API that 19 removes | The model for safe upgrades |
| 19.0 | 5 Dec 2024 | Actions, `use`, `useActionState`, `useOptimistic`, Server Components and Server Functions stable, `ref` as a prop, metadata and resource APIs | The server became part of React's model |
| 19.1 | 28 Mar 2025 | Owner Stacks | Debugging "who rendered this?" |
| 19.2 | 1 Oct 2025 | `<Activity>`, `useEffectEvent`, `cacheSignal`, Performance Tracks, partial prerendering APIs | Pre-rendering and keeping state while hidden |
| 19.3 | 9 Sep 2026 | `<ViewTransition>` and `addTransitionType` stable, Fragment refs, `browser()`, Trusted Types | Native-feeling transitions |
| 19.3.1 | 14 Oct 2026 | Security release (an unauthenticated RCE in RSC) | See [A3](A3-security-advisories-timeline.md) |

Around the core library:

| Year | Event |
|---|---|
| 2014 | Flux introduced: one-way data flow for applications |
| 2015 | React Native released |
| 2016 | Create React App released (sunset by the React team in February 2025) |
| 2017 | React relicensed from BSD plus patents to MIT |
| 2020 | Server Components previewed as a research demo (December) |
| 2021 | "React Forget", the compiler that became the React Compiler, previewed at React Conf |
| 2023 | Canary channel introduced for frameworks |
| 2025 | React Compiler 1.0 (7 October); React Conf announces the React Foundation |
| 2026 | React Foundation launched (24 February); React DevTools 8.0 (September) |

---

## 2. The shifts, and the pain behind each

### 2.1 The virtual DOM (2013)

**The pain:** large UIs built from manual DOM updates, where every new feature added another path that could leave the page inconsistent. **The answer:** describe the UI for the current state and let React work out the mutations. The virtual DOM was an implementation detail; "UI as a function of state" was the idea that lasted.

### 2.2 Components and one-way data (2014–2015)

**The pain:** two-way bindings that made it impossible to trace why something changed. **The answer:** data flows down through props, events flow up through callbacks, and application state flows one way (Flux, and later Redux). Function components in 0.14 made "a component is a function" literal.

### 2.3 Fiber (2017)

**The pain:** rendering was a single recursive, uninterruptible call. A large update blocked input for as long as it took. **The answer:** a rewrite in which rendering is split into units of work that can be paused, prioritised and resumed. Fiber shipped in 16.0 with almost no visible API change, which is why it's underrated: concurrent rendering, Suspense and transitions all depend on it.

### 2.4 Hooks (2019)

**The pain:** stateful logic couldn't be shared without wrapping components in higher-order components and render props, creating "wrapper hell", and classes split related logic across lifecycle methods. **The answer:** state and effects as functions that can be composed into custom hooks. The cost was a new mental model: closures, dependency arrays and the Rules of Hooks ([12](12-hooks-in-depth.md)).

### 2.5 Concurrent rendering (2022)

**The pain:** every update had the same priority, so typing could wait behind a slow list. **The answer:** priorities (lanes), interruptible rendering, transitions, and Suspense that works with streaming server rendering. It was opt-in through `createRoot`, so applications could upgrade before they adopted any concurrent feature ([15](15-concurrent-react-suspense-and-transitions.md)).

### 2.6 Server Components (preview 2020, stable 2024)

**The pain:** client-side data fetching created waterfalls, and every library a component used was shipped to every user. **The answer:** components that run on the server, read data directly and send only their output, with Client Components for interactivity ([18](18-react-server-components-and-server-functions.md)). It moved part of React into frameworks and, as 2025–26 showed, created a new server-side attack surface ([44](44-rsc-security-threat-model.md)).

### 2.7 The Compiler (2025)

**The pain:** `useMemo`, `useCallback` and `memo` everywhere, written by hand, and wrong half the time. **The answer:** a build-time compiler that memoizes automatically, assuming the Rules of React. Version 1.0 shipped in October 2025. It optimizes the code you have, not the component boundaries you should have drawn ([71](71-case-study-legacy-react-modernization.md)).

### 2.8 The React Foundation (2026)

**The pain:** a library used across the industry, governed by one company. **The answer:** a foundation under the Linux Foundation, launched on 24 February 2026, with founding platinum members Amazon, Callstack, Expo, Huawei, Meta, Microsoft, Software Mansion and Vercel, and Seth Webster as executive director. Technical governance is independent of the funding board, and the repository moved to `github.com/react/react`.

---

## 3. Release channels

| Channel | npm tag | Version format | Who it's for |
|---|---|---|---|
| Stable | `latest` | `19.3.1` | Applications |
| Canary | `canary` | `19.3.0-canary-<commit>-<date>` | Frameworks and libraries that integrate features before a stable release; Next.js's App Router builds on it |
| Experimental | `experimental` | `0.0.0-experimental-<commit>-<date>` | Trying features that might change or be removed |
| Release candidates and betas | `rc`, `beta` | `19.0.0-rc.1` | Testing a major before release |

How the channels relate in practice:

- **Canary is close to stable, but not the same thing.** On 25 November 2026, `react@canary` exported exactly what 19.3.1 does ([A1](A1-react-api-reference.md) §10), but it's built from the main branch and can change daily.
- **Frameworks pin a specific canary.** If you use Next.js's App Router, the React that runs is the one the framework ships, whatever your `package.json` says.
- **Experimental is where unannounced work becomes visible.** Exports appear there long before documentation ([A4](A4-experimental-and-canary-apis.md)).

---

## 4. Versioning and support

- **Semantic versioning:** breaking changes in majors only. React's majors are infrequent: 16 (2017), 17 (2020), 18 (2022), 19 (2024).
- **Warnings before removals:** a removal is announced as a development warning in an earlier release, as 18.3 did for 19.0's removals and 16.9 did for `UNSAFE_` lifecycles.
- **No formal long-term-support policy** for the core library, but security fixes have been backported across recent minor lines. Every 2025–26 RSC fix shipped as patches for 19.0.x, 19.1.x and 19.2.x, and the October 2026 fix also for 19.3. The resulting floors are 19.0.9, 19.1.10, 19.2.9 and 19.3.1.
- **Frameworks set their own support windows:** Next.js has active and maintenance LTS lines (16.x and 15.5 in November 2026; 13.x and 14.x are end of life), React Router has yearly majors from v8, and Expo pins React Native and React per SDK.

Practical policy for an organisation:

| Situation | Policy |
|---|---|
| New application | The latest stable minor |
| Existing application | Within one minor of the latest; every security patch within the SLA |
| Using Server Components | At or above the security floors at all times ([A3](A3-security-advisories-timeline.md)) |
| A library you publish | Support the current major and the previous one where practical; test against canary in CI |

---

## 5. Governance

| Aspect | Before 2026 | Since February 2026 |
|---|---|---|
| Owner | Meta | The React Foundation (Linux Foundation) |
| Funding | Meta | Member companies (platinum founders: Amazon, Callstack, Expo, Huawei, Meta, Microsoft, Software Mansion, Vercel) |
| Technical decisions | The React team at Meta | Technical governance independent of the funding board |
| Repository | `github.com/facebook/react` | `github.com/react/react` |
| Proposals | RFC repository | RFCs, with framework authors involved through the canary channel |

What changed for architects is less visible than the announcement: release planning now explicitly includes the frameworks and companies that ship React (Expo, Vercel, Microsoft, Callstack, Software Mansion among them), and security handling has become more formal after the 2025–26 advisories.

---

## Decision framework

**Problem:** choosing when to upgrade React, and how far.

**Constraints:** your framework's supported React version, your use of Server Components, the APIs you depend on that are deprecated, and your test coverage.

| Option | Choose when | Risk |
|---|---|---|
| Stay on the current minor, patches only | You're mid-release or the next minor offers nothing you need | Low, as long as patches are applied |
| Upgrade to the latest minor | It's been out for a few weeks and your framework supports it | Low; minors don't remove APIs |
| Upgrade a major | Deprecation warnings are gone in development and tests are behavioural | Medium; follow [64](64-migration-playbooks.md) |
| Use canary directly | You maintain a framework or a library | High; pin exact versions |

**Criteria:** security floors first, then framework support, then features.

**Failure modes:** skipping the warning-only release before a major; treating canary as stable; assuming a client-only app needs RSC patches (it doesn't) or that an RSC app doesn't (it does).

---

## Pitfalls

- **Reading history as trivia.** The pain behind each shift explains which APIs are permanent and which are transitional.
- **Assuming the npm history is React's history.** The 2012 `react` packages were someone else's.
- **Ignoring backported patches.** You don't need the newest minor to be safe, but you do need the latest patch of your minor.
- **Confusing the React Foundation with the frameworks.** The foundation governs React; Next.js, React Router, Expo and others have their own governance and support policies.

---

## Further reading

- [The React blog](https://react.dev/blog): release posts for every version since 16.
- [React Canaries: Enabling Incremental Feature Rollout Outside Meta](https://react.dev/blog/2023/05/03/react-canaries) (2023).
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide).
- [React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1) (October 2025).
- [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) (February 2025).
- [Introducing Zero-Bundle-Size React Server Components](https://react.dev/blog/2020/12/21/data-fetching-with-react-server-components) (December 2020).

---

[← Previous: A1 — React API Reference Tables](A1-react-api-reference.md) · [Index](README.md) · [Next: A3 — Security Advisories Timeline →](A3-security-advisories-timeline.md)
