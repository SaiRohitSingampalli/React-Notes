# 27 — React Best Practices, Anti-patterns and Code Review Guide

> Code review is where architecture either happens or quietly fails. Automate everything a machine can check, and spend human attention on what machines can't: state ownership, boundaries, failure modes, accessibility and the clarity of intent.

**Prerequisites:** Parts II and III · **Related:** [21 Boundaries](21-frontend-architecture-styles-and-boundaries.md) · [63 Governance](63-architecture-governance-and-adrs.md) · [42 Testing](42-testing-architecture.md)

---

## TL;DR

- **Automate the mechanical:** formatting, lint (hooks, compiler-derived rules, a11y, boundaries), types, tests, bundle budgets and a11y scans run in CI. Humans shouldn't comment on what a bot can catch.
- **Review for what matters:** correctness and edge cases, state ownership, effect necessity, component API design, failure modes, accessibility, security, performance (with evidence) and tests that check behaviour.
- Use the **40 anti-patterns** table below as a shared vocabulary. Most production React bugs are one of them.
- Use the **"replace old patterns" list for React 19.3**. Code written in 2021 style isn't wrong, but it carries cost and blocks Compiler, RSC and a11y improvements.
- Label comments by **severity** (blocking / suggestion / nit / question) and keep PRs **small**. Review latency is an architecture concern, too.

---

## 1. What to automate (so humans don't have to)

| Check | Tool | Gate |
|---|---|---|
| Formatting | Prettier / Biome / Oxfmt | Pre-commit + CI |
| Hooks rules, compiler-derived rules | `eslint-plugin-react-hooks` v7 | CI error |
| Accessibility lint | `eslint-plugin-jsx-a11y` | CI error |
| Module boundaries, cycles | `eslint-plugin-boundaries`, Nx, dependency-cruiser | CI error ([21](21-frontend-architecture-styles-and-boundaries.md)) |
| Types | `tsc --noEmit` (TS 7 for speed) | CI error |
| Unit and component tests | Vitest + Testing Library | CI error |
| A11y scans of stories and pages | axe (Storybook test runner, Playwright) | CI error for serious/critical |
| Bundle size per route | size-limit / bundle analyzer budgets | CI error on regression |
| Lighthouse / Web Vitals budgets | Lighthouse CI on key templates | CI warn/error |
| Secrets, dependency policy | Secret scanning, OSV, lockfile lint, npm 12 `allowScripts` | CI error ([43](43-frontend-security-architecture.md)) |
| Ownership | CODEOWNERS | Required reviewers |

---

## 2. The human review rubric

### State and data

- [ ] Each new piece of state has **one owner** (component, URL, server cache, form, store) and isn't duplicated ([28](28-state-and-data-ownership-architecture.md)).
- [ ] Nothing that can be derived is stored.
- [ ] Server data comes from the data layer (cache, loader, RSC), not copied into local or global state.
- [ ] Invalidation after mutations is explicit.

### Effects

- [ ] Every effect synchronises with an external system. There's no derived state, no event logic and no chains ([13](13-effects-and-synchronization.md)).
- [ ] Every effect has a cleanup (or a reason it needs none).
- [ ] No suppressed `exhaustive-deps` without a written justification.

### Components and APIs

- [ ] Props follow conventions (variants not booleans, `value`/`onValueChange`, `className`/`ref` pass-through) ([22](22-component-architecture-and-patterns.md)).
- [ ] No components defined inside components; keys are stable IDs.
- [ ] The component has a single responsibility. Extraction is justified by reuse or by state isolation.

### Server and client boundaries (RSC apps)

- [ ] `'use client'` sits at the leaves.
- [ ] Props crossing to Client Components are minimal DTOs, with no secrets or internal fields.
- [ ] Server Functions authenticate, authorise, validate and are idempotent ([18](18-react-server-components-and-server-functions.md)).
- [ ] Modules touching secrets import `server-only`.

### Failure modes

- [ ] Loading, empty and error states exist and are designed.
- [ ] Error boundaries cover new regions. Expected errors are returned as state, not thrown ([40](40-resilience-and-reliability.md)).
- [ ] Offline, slow-network and version-skew behaviour is considered for critical flows.

### Accessibility

- [ ] Semantic elements; keyboard operable; visible focus; labels and descriptions; focus management for overlays and route changes ([36](36-accessibility-engineering.md)).
- [ ] Dynamic changes are announced where needed (live regions).

### Performance (with evidence)

- [ ] Claims of "this is faster" come with a profile or a benchmark.
- [ ] New dependencies have a size and maintenance justification.
- [ ] Large lists are paginated or virtualised; heavy work isn't on the main thread.

### Security

- [ ] No `dangerouslySetInnerHTML` outside the sanitising wrapper; no tokens in JS-readable storage; untrusted URLs are validated ([43](43-frontend-security-architecture.md)).

### Tests

- [ ] Tests assert behaviour through roles and text, not implementation details ([42](42-testing-architecture.md)).
- [ ] The critical paths of the change are covered, including error paths.

### i18n and observability

- [ ] No hard-coded user-facing strings, dates or currency formatting ([37](37-internationalization-and-localization.md)).
- [ ] New flows emit the events and errors needed to operate them ([41](41-observability-and-diagnostics.md)).

---

## 3. The 40 anti-patterns

| # | Anti-pattern | Why it hurts | Fix | Automated? |
|---|---|---|---|---|
| 1 | Derived state stored via `useState` + effect | Extra renders; drift between sources | Compute during render | `set-state-in-effect` |
| 2 | Effect chains (A sets B sets C) | Cascading renders; hard to follow | One event handler computes the next state | Partly |
| 3 | Event logic in effects (watching a "submitted" flag) | Runs at the wrong time; double fires | Do it in the handler | — |
| 4 | `fetch` in `useEffect` without cache or abort | Races, waterfalls, no SSR, refetch on mount | Loader / RSC / query library | Custom lint |
| 5 | Missing effect cleanup | Leaks, duplicate subscriptions | Symmetric cleanup; `AbortController` | StrictMode reveals it |
| 6 | Suppressed `exhaustive-deps` | Stale closures; Compiler bail-outs | Restructure; `useEffectEvent` | Lint (ban suppressions) |
| 7 | Object/function dependencies recreated every render | Effect re-runs, resubscribes | Primitive deps; create inside the effect; Compiler | `exhaustive-deps` hints |
| 8 | Mutating props or state | Missed updates; broken memoisation | Immutable updates; Immer | `immutability` |
| 9 | Index keys on dynamic lists | State attached to the wrong item | Stable IDs | Custom lint |
| 10 | Random keys in render | Remount every render | Stable IDs | `purity` (partly) |
| 11 | Components defined inside components | Remount every render; lost state and focus | Module-scope components | `static-components` |
| 12 | Calling components as functions | Hooks attach to the wrong fiber | Render as JSX | Partly |
| 13 | Conditional or looped hooks | Corrupted hook order | Top-level hooks (`use` is the exception) | `rules-of-hooks` |
| 14 | Reading or writing refs during render | Non-reactive UI; purity violation | State; effects; handlers | `refs` |
| 15 | Impure render (`Date.now()`, `Math.random()`, analytics) | Hydration mismatches; duplicated side effects | Pass values in; effects or handlers for side effects | `purity` |
| 16 | Server data copied into local or global state | Stale copies; invalidation bugs | Server-state cache as the single owner | — |
| 17 | Global store as a junk drawer | Everything couples to everything | State taxonomy; colocate ([28](28-state-and-data-ownership-architecture.md)) | — |
| 18 | Context for high-frequency state | Re-renders every consumer | Store with selectors | — |
| 19 | Context value recreated each render (uncompiled code) | Consumer re-render storms | Memoise or Compiler; split contexts | — |
| 20 | Deep prop drilling through pass-through layers | Brittle, noisy | Composition (children or slots), context | — |
| 21 | Boolean prop explosion | Invalid combinations | Variant enums; discriminated unions | Types |
| 22 | `cloneElement`/`Children` magic | Breaks with wrappers; untypeable | Compound components + context | Custom lint |
| 23 | God components (several responsibilities, many hundreds of lines) | Hard to test and change | Split by responsibility or state locality | Size heuristics |
| 24 | Premature generic abstractions | Inner-platform effect | Rule of three; duplicate first | — |
| 25 | Reflexive `useMemo`/`useCallback` in compiled code | Noise; occasionally slower | Trust the Compiler; keep justified cases | Compiler badge |
| 26 | `'use client'` at layout or page roots | Ships the whole subtree to the client | Push client boundaries to leaves | Custom lint |
| 27 | Full records passed to Client Components | Data exposure in the RSC payload | DTOs from a data access layer | Review |
| 28 | Server Functions without auth, validation or authorisation | Public, attacker-callable endpoints | Auth + schema + service-level authorisation | Review, tests |
| 29 | `dangerouslySetInnerHTML` with untrusted HTML | XSS | Sanitiser wrapper; Trusted Types | Lint ban |
| 30 | Tokens in `localStorage` | XSS exfiltration | HttpOnly cookies / BFF ([45](45-authentication-and-authorization.md)) | Review |
| 31 | `<div onClick>` as a button | Not keyboard- or SR-accessible | `<button type="button">` | `jsx-a11y` |
| 32 | Placeholder as label; unlabelled inputs | Inaccessible forms | `<label>` + `aria-describedby` | `jsx-a11y` |
| 33 | No focus management for overlays and routes | Keyboard and SR users get lost | Restore and move focus; native `<dialog>` | E2E a11y tests |
| 34 | `{count && …}` rendering `0` | Stray zeros in the UI | Boolean conditions | Custom lint |
| 35 | Controlled ↔ uncontrolled switching | Undefined behaviour, warnings | `value={x ?? ''}` | React warning |
| 36 | Unbounded lists rendered fully | Slow, with huge DOM | Paginate or virtualise; `content-visibility` | Perf budgets |
| 37 | Giant barrel imports | Slow dev and tests; cycles; bundle bloat | Narrow public APIs; direct entry points | Lint |
| 38 | Testing implementation details (internal state, snapshots of everything) | Brittle tests that miss real bugs | Testing Library by role; targeted snapshots | Review |
| 39 | No error boundaries, or only one at the root | One widget failure takes down the app | Boundaries per region | Review |
| 40 | Hard-coded strings, dates and currency | Breaks i18n; inconsistent formatting | Message catalogue; `Intl` | Lint (no literal strings in JSX) |

---

## 4. Replace old patterns: the React 19.3 modernisation list

| Old pattern | Modern replacement | Since |
|---|---|---|
| `forwardRef((props, ref) => …)` | `ref` as a prop | 19.0 |
| `<Ctx.Provider value>` | `<Ctx value>` | 19.0 |
| `ReactDOM.useFormState` | `useActionState` | 19.0 |
| Hand-rolled `isLoading`/`error` for mutations | Actions + `useActionState` + `useOptimistic` | 19.0 |
| `ReactDOM.render` / `hydrate` | `createRoot` / `hydrateRoot` | 18 (removed in 19) |
| String refs, `findDOMNode`, legacy context | Refs, Fragment refs, `createContext` | Removed in 19 |
| `propTypes` / function `defaultProps` | TypeScript + runtime schemas / default parameters | Removed in 19 |
| Wrapper `<div ref>` just to observe or focus children | `<Fragment ref>` | 19.3 |
| `mounted` flag / `typeof window` render branches | Deterministic SSR, or `use(browser())` for rare browser-only UI | 19.3 |
| Effect + ref "latest value" hacks | `useEffectEvent` | 19.2 |
| Effect-based store subscriptions | `useSyncExternalStore` | 18 |
| Manual `useMemo`/`useCallback`/`memo` everywhere | React Compiler (keep justified manual memoisation) | Compiler 1.0 (Oct 2025) |
| `react-test-renderer`, Enzyme, shallow rendering | Testing Library, Vitest browser mode | — |
| DevTools Timeline tab | Performance Tracks in the browser | DevTools 8 |
| JS tooltip positioning in layout effects | CSS anchor positioning | Baseline 2026 |
| Portal-based modals | `<dialog>` / `popover` (top layer) | Baseline |
| Runtime CSS-in-JS in new code | Zero-runtime (CSS Modules, Tailwind v4, vanilla-extract, StyleX) | — |
| Create React App | Vite or a framework | CRA deprecated (2025) |
| `react-router-dom` imports | `react-router` and `react-router/dom` | React Router 8 |
| Global `JSX` namespace in types | `React.JSX` | @types/react 19 |
| Next.js `middleware.ts` | `proxy.ts` | Next.js 16 |
| Next.js implicit fetch caching, `unstable_cache` | Cache Components (`'use cache'`, `cacheLife`, `cacheTag`) | Next.js 16 (recommended from 16.4) |

---

## 5. Writing review comments that work

| Severity label | Meaning | Example |
|---|---|---|
| **blocking** | Must change before merge | "blocking: this Server Function deletes a project without checking the user's role. Any member can call it directly." |
| **suggestion** | Better option, author decides | "suggestion: `selectedUser` can be derived from `selectedId` + `users`, which would remove the effect and one source of truth." |
| **question** | Seeking understanding | "question: does this need to be a layout effect? It doesn't seem to measure anything." |
| **nit** | Trivial, non-blocking | "nit: `handleChange` → `onEmailChange` would match our naming guide." |
| **praise** | Reinforce good patterns | "praise: nice use of a `key` to reset the form instead of an effect." |

Principles:

- Comment on **code and consequences**, not people ("this re-renders the grid per keystroke", not "you made it slow").
- **Link to the standard** (this chapter, an ADR, a doc) instead of re-arguing it.
- Batch related comments, and suggest code (`suggestion` blocks) when it's short.
- If a discussion passes three rounds, **switch to a call** and record the outcome.

---

## 6. Team practices that keep quality high at scale

| Practice | Why |
|---|---|
| Small PRs (≈ < 400 lines changed), stacked when needed | Review quality drops sharply with size |
| Review-latency SLO (e.g., first response < 4 working hours) | Slow reviews push people into large PRs |
| CODEOWNERS per feature and package | The right expertise; clear accountability |
| PR templates linking the ticket, screenshots and video, a11y and perf notes | Context for reviewers |
| ADR links for architectural changes | Decisions reviewed once, referenced forever ([63](63-architecture-governance-and-adrs.md)) |
| Codemods for wide changes | Mechanical diffs reviewed as one rule, not 300 files |
| Lint-first culture ("if we said it twice in review, it's a lint rule") | Scales standards without scaling reviewers |
| Pairing or mob reviews for high-risk changes (auth, payments, RSC boundaries) | Shared understanding |
| Rotating "review captain" for the design system | Consistency across consumers |

---

## Architect's checklist

- [ ] Lint, type and test gates encode the mechanical parts of this rubric
- [ ] The rubric is linked from the PR template
- [ ] Anti-pattern numbers are used as shorthand in reviews ("AP-1: derived state")
- [ ] A modernisation backlog based on the "replace old patterns" table, tracked as ratchets
- [ ] Review-latency and PR-size metrics visible to teams
- [ ] High-risk areas (auth, payments, Server Functions) require specific reviewers

---

## Interview angles

**Q1. What do you look for when reviewing a React PR?**
After CI handles formatting, lint, types and tests: state ownership (is anything duplicated or derivable?), effects (are any unnecessary, and do they clean up?), component API fit with our conventions, server and client boundaries and data exposure in RSC apps, failure states (loading, empty, error, retry), accessibility (semantics, keyboard, focus, announcements), security (untrusted HTML, auth in Server Functions), evidence for performance claims, and tests that assert behaviour. Then I check whether the change fits the architecture (boundaries, ownership) or needs an ADR.

**Q2. How do you scale code quality across 50+ frontend engineers?**
Encode standards in tools (lint rules including compiler-derived ones, boundary rules, CI budgets), templates and the design system. Make the accessible, performant thing the default. Keep a short written rubric, use CODEOWNERS for expertise routing, and set review-latency SLOs. Use codemods for migrations, and ratchets for legacy debt. Run regular "architecture office hours". When something comes up in review twice, it becomes a rule or a component.

**Q3. A senior engineer insists on `useMemo` everywhere "for performance". How do you respond?**
Ask for profiling evidence. Explain that the React Compiler memoises automatically and more precisely, that unnecessary memoisation adds noise and costs, and that the real wins usually come from state colocation, transitions, virtualisation and less work per render. Keep explicit memoisation where identity is a correctness contract or the Compiler bails out, and agree on a written policy so it doesn't get re-argued in every PR.

---

## Further reading

- React docs, *Rules of React* and *You Might Not Need an Effect*: <https://react.dev>
- Google Engineering Practices, *Code Review Developer Guide*: <https://google.github.io/eng-practices/review/>
- Conventional Comments: <https://conventionalcomments.org>
- `eslint-plugin-react-hooks` rules: <https://github.com/react/react/tree/main/packages/eslint-plugin-react-hooks>
- Testing Library, *Guiding Principles*: <https://testing-library.com/docs/guiding-principles>

---

[← Previous: 26 — Forms and Validation Architecture](26-forms-and-validation.md) · [Index](README.md) · [Next: 28 — State and Data Ownership Architecture →](28-state-and-data-ownership-architecture.md)
