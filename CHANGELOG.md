# Changelog

Corrections and additions since the first complete edition. Each entry names the chapter, what changed and why.

## 27 November 2026: the examples move into the handbook folder

The companion code no longer ships as a second zip with subfolders. It now sits in this folder as flat files, so the whole handbook is one flat folder:

- **25 example pages, E03 to E79**, named after their chapters, with [E00](E00-running-the-examples.md) as the index. Each page explains its project, then lists every file in it.
- **`examples.lock.json`**, the exact lockfile of each project that has dependencies.
- **`extract-examples.mjs`**, which writes the pages back out as project folders (`node extract-examples.mjs`), and with `--run` also installs, tests, type-checks and builds each one.

The code is unchanged. Extracting the pages reproduces every file and lockfile byte for byte, and `--run` passes on all 25 projects from a fresh copy. The README's companion-code section and the chapters' **Runnable code** tips now point to the pages.

## 26 November 2026: editorial pass on the densest chapters

The longest technical chapters repeated their deep dives in the TL;DR, the checklist and the interview answers. The pass cut that overlap and used the space for one hard decision per chapter, worked through in depth at the end of its decision framework.

| Chapter | Tightened | New section |
|---|---|---|
| [58](58-angular-at-scale.md) | TL;DR halved (440 to 221 words), with details left to their sections; failure modes that repeated the pitfalls folded into them; the SSR interview answer shortened | "The hard decision: whether to run a server at all" |
| [51](51-react-router-v8-framework-mode.md) | TL;DR cut from 262 to 192 words; v8's change list now lives only in the migration section | "The hard decision: who owns server state, loaders or a query cache" |
| [56](56-angular-architecture-and-dependency-injection.md) | TL;DR cut from 303 to 255 words, nested lists flattened | "The hard decision: should components reach data directly, or through a facade?" |
| [33](33-api-integration-bff-and-contracts.md) | (TL;DR already short) | "The hard decision: which layer retries?", with an end-to-end test that counts requests |

Chapter [69](69-case-study-collaborative-project-management.md), the other chapter over 6,000 words, already works through its hard decision in an ADR, so it was left as it is.

## 26 November 2026: companion code

A separate download, `frontend-architect-handbook-examples.zip`, now holds runnable code: 25 folders covering 27 chapters, each with tests, an exact lockfile and a README. A build script extracts the code from the chapters, and every folder passes a clean `npm ci`, its tests, its type-check and its build. The [README](README.md#companion-code) lists the chapters, and each of them has a **Runnable code** tip.

Running the code found two more corrections:

| Chapter | Change | Why |
|---|---|---|
| [37](37-internationalization-and-localization.md) | The French percent example now says it uses a no-break space before `%`, and that French groups thousands with a *narrow* no-break space | The table said narrow no-break space for the percent sign; ICU 78 (CLDR 48) outputs U+00A0 there and U+202F only between thousands |
| [25](25-complex-ui-engineering.md) | The grid is now verified by rendering it, and the text says to build its columns with the column helper's `columns([...])` | A plain array of mixed accessor columns doesn't type-check against `ColumnDef<typeof features, Order>[]` in TanStack Table 9 |

## 26 November 2026: code audit of every block

Every fenced block was extracted (782 in all). Each TypeScript and JavaScript block was parsed, and the 496 TS and TSX blocks were type-checked against the versions the handbook names (TypeScript 6.0.3, React 19.3, Next.js 16.4, Angular 22.3, TanStack Table 9.3). Utilities with behaviour worth proving were tested, and each bug below was reproduced against the earlier code first.

**Bugs fixed**

| Chapter | Change | Why |
|---|---|---|
| [03](03-javascript-runtime-and-engine.md) | `mapLimit` rejects limits that aren't positive integers | The same bug as chapter 74: a limit of 0 returned empty slots and ran nothing |
| [12](12-hooks-in-depth.md) | `useLocalStorageState` uses a stable, module-level `subscribe` and falls back when stored JSON is corrupt | An inline `subscribe` made React resubscribe on every render; a hand-edited value threw during render |
| [26](26-forms-and-validation.md) | Autosave became a `useAutosave` hook: saves run one at a time, each sends the ETag the previous one returned, only a successful response updates the ETag, failures reach `onError`, and a pending edit is sent on unmount | Overlapping saves sent the same `If-Match` and conflicted with each other; a 500 response replaced the ETag with `null`; network errors were unhandled; an edit made just before in-app navigation was lost |
| [28](28-state-and-data-ownership-architecture.md) | `loadPrefs` returns defaults for data written by a newer build, and the rule says not to save over it on load | After a rollback, migrating "down" isn't possible, and saving on load would destroy the newer data |
| [29](29-client-state-management.md) | The small store's `useStore` caches the selection per state and selector | A derived selector returned a new array on every `getSnapshot` call, and React stopped with "Maximum update depth exceeded" |
| [37](37-internationalization-and-localization.md) | `formatMoney` converts with ISO 4217 minor units and uses `Intl` only to display | `Intl` shows no decimals for HUF, IDR and COP, so 1,000 forints stored as 100000 displayed as 100,000 |
| [40](40-resilience-and-reliability.md) | The circuit breaker counts only timeouts, network failures and 5xx responses (configurable), and an aborted probe doesn't leave it stuck | Aborts counted as failures, so three quick navigations away opened the breaker |
| [43](43-frontend-security-architecture.md) | `safeUrl` no longer reads `window`, keeps relative URLs relative and trims input | Its default parameter threw `ReferenceError` during server rendering |

**API and type corrections**

| Chapter | Change | Why |
|---|---|---|
| [09](09-react-fundamentals-complete-reference.md), [19](19-class-components-lifecycles-and-legacy-apis.md), [30](30-server-state-and-data-fetching.md), [40](40-resilience-and-reliability.md), [41](41-observability-and-diagnostics.md), [51](51-react-router-v8-framework-mode.md) | The app's error reporter is named `captureError` | `reportError` is a DOM global with a different signature, so a missing import silently called the browser's version |
| [15](15-concurrent-react-suspense-and-transitions.md), [24](24-animation-and-motion-systems.md) | View-transition class maps include a `default` key; imports added | Required by `@types/react` 19.3 |
| [20](20-react-tooling-devtools-and-debugging.md) | `reactHooks.configs.flat.recommended` | `configs.recommended` is the legacy `.eslintrc` format and fails in a flat config |
| [25](25-complex-ui-engineering.md) | The data grid uses the TanStack Table 9 API (`useTable`, `tableFeatures`, `getRowId`) | The earlier code used the v8 API while the chapter names v9 |
| [29](29-client-state-management.md) | `atom(new Set<string>())` | An untyped empty `Set` atom infers `Set<unknown>` |
| [04](04-typescript-at-scale.md), [08](08-react-mental-model-and-rules.md), [09](09-react-fundamentals-complete-reference.md), [10](10-react-internals-fiber-and-reconciliation.md), [12](12-hooks-in-depth.md), [17](17-ssr-streaming-and-hydration.md), [19](19-class-components-lifecycles-and-legacy-apis.md), [22](22-component-architecture-and-patterns.md), [30](30-server-state-and-data-fetching.md), [58](58-angular-at-scale.md) | Fence languages corrected (`ts` to `tsx`) and excerpts completed so they parse | Blocks that don't parse can't be copied into a project |

**What remains, and why.** The remaining type diagnostics need the surrounding application: names the chapter defines elsewhere, route types that React Router and TanStack Router generate at build time, Angular injection tokens, and the deliberately legacy code in chapter 71. Eight JSX snippets show sibling elements side by side; each parses once wrapped in a fragment. React Native blocks were parsed but not type-checked.

## 26 November 2026: technical corrections after an external review

| Chapter | Change | Why |
|---|---|---|
| [28](28-state-and-data-ownership-architecture.md) | RTK Query moved from the "normalised entity cache" column to the query-level column, with a note on what `createEntityAdapter` does | RTK Query stores each query result independently and doesn't deduplicate entities across queries; an entity adapter in `transformResponse` normalises one response only |
| [28](28-state-and-data-ownership-architecture.md) | "What must never be duplicated" became "What not to duplicate, and when it's deliberate", with each row labelled *default* or *requirement* and its safeguarded exceptions (editing drafts, offline-first stores, multi-step flows) | Absolute rules hid legitimate, common exceptions |
| [33](33-api-integration-bff-and-contracts.md) | The HTTP client rejects an empty idempotency key | An empty key enabled retries of `POST` without sending the `Idempotency-Key` header: two attempts, no key |
| [33](33-api-integration-bff-and-contracts.md) | `Retry-After` is honoured exactly, or the request fails at once with `retryAfterMs` when the wait exceeds the caller's budget (`maxRetryWaitMs`, default 30 seconds) | `Retry-After: 120` previously produced a retry after 30 seconds, contradicting the chapter's own rule |
| [33](33-api-integration-bff-and-contracts.md) | `Retry-After` parsing accepts only non-negative integer seconds or an HTTP date; `sleep` removes its abort listener; `API_BASE` is defined | Malformed values were accepted; one abort listener leaked per wait; the constant was undeclared |
| [74](74-machine-coding-drills.md) | `mapLimit` rejects limits that aren't positive integers | A limit of 0 resolved immediately with an array of empty slots and ran no tasks |
| [README](README.md) | "How to read the rules": defaults versus requirements, and what *verified* means | Readers need to know which rules admit exceptions |

All code changes were reproduced against the earlier versions first and then tested: 7 new `node:test` cases for chapter 33's client and 1 new Vitest case for chapter 74 (23 in total).

## 25 November 2026: Part XII added

Chapters [75](75-experimentation-and-product-analytics.md) to [79](79-distributed-systems-design-for-frontend-architects.md): experimentation, cost and capacity, hiring and org design, business cases, and distributed systems design.
