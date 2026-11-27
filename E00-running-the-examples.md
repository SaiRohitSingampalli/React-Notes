# E00 — Running the Examples

> The runnable code for 27 chapters: 25 small projects with 169 tests. Each page explains a project and lists every file in it, and one script turns the pages back into folders you can run.

The examples live in this folder as pages, so the handbook stays flat: one page per project, named after its chapter (E33 holds chapter 33's code). Three files make it work:

- the pages, **E03 to E79**, each with the explanation first and every file of the project after it;
- **`examples.lock.json`**, the exact lockfile of each project, so installs are reproducible;
- **`extract-examples.mjs`**, which writes the projects out. It has no dependencies.

## Requirements

Node 22.18 or newer and npm 10. The projects without a framework run TypeScript directly with Node's built-in type stripping, which is why 22.18 is the minimum. Everything was verified with Node 22.23.5 and npm 10.9.9 on Linux on 26 November 2026: a clean `npm ci` from the lockfile, then the tests, the type-check and the build, in every project.

The framework apps download a few hundred megabytes each, and the Angular workspace the most. Nothing calls an external service: the backend services, the AI model and the sign-in checks are stand-ins, so you need no accounts or keys.

## Get the projects

From the handbook folder:

```bash
node extract-examples.mjs              # every example, into ./examples/
node extract-examples.mjs 33 74        # only E33 and E74
node extract-examples.mjs --out ~/code/handbook-examples
```

Then run one:

```bash
cd examples/33-api-integration-bff-and-contracts
npm ci
npm test
npm run typecheck      # where there's TypeScript
npm run build          # where there's an app or a library
```

Or check them all at once. This extracts each project, then runs a clean install, the tests, the type-check and the build, printing one line per project:

```bash
node extract-examples.mjs --run
node extract-examples.mjs --run 51 52 56
```

If the handbook is in a Git repository, add `examples/` to your `.gitignore`.

## The examples

| Page | Chapter | What runs | Tests |
|---|---|---|---|
| [E03](E03-javascript-runtime-and-engine.md) | [03](03-javascript-runtime-and-engine.md) | `mapLimit`: bounded concurrency in input order | 5 |
| [E11](E11-build-your-own-react.md) | [11](11-build-your-own-react.md) | mini React (fiber, hooks, keyed reconciliation) and its Todos demo | 5 |
| [E12](E12-hooks-in-depth.md) | [12](12-hooks-in-depth.md) | `useLocalStorageState` on `useSyncExternalStore` | 5 |
| [E25](E25-complex-ui-engineering.md) | [25](25-complex-ui-engineering.md) | a virtualised 10,000-row grid on TanStack Table 9 | 2 |
| [E26](E26-forms-and-validation.md) | [26](26-forms-and-validation.md) | `useAutosave`: queued saves, ETags, unmount flush | 6 |
| [E29](E29-client-state-management.md) | [29](29-client-state-management.md) | a small store with cached selectors | 3 |
| [E33](E33-api-integration-bff-and-contracts.md) | [33](33-api-integration-bff-and-contracts.md) | the production HTTP client: retries, `Retry-After`, idempotency | 9 |
| [E37](E37-internationalization-and-localization.md) | [37](37-internationalization-and-localization.md) | cached formatters, ISO 4217 money, the platform-outputs table | 7 |
| [E40](E40-resilience-and-reliability.md) | [40](40-resilience-and-reliability.md) | the circuit breaker and its failure classifier | 7 |
| [E43](E43-frontend-security-architecture.md) | [43](43-frontend-security-architecture.md) | `safeUrl` and `serializeForScript` | 6 |
| [E45](E45-authentication-and-authorization.md) | [45](45-authentication-and-authorization.md) | the authorization policy and its test matrix | 6 |
| [E51](E51-react-router-v8-framework-mode.md) | [51](51-react-router-v8-framework-mode.md) | a React Router v8 app: middleware, streaming, CSP nonces | 4 |
| [E52](E52-tanstack-start-and-router.md) | [52](52-tanstack-start-and-router.md) | a TanStack Start app: server functions, guards, CSRF | 3 |
| [E56](E56-angular-architecture-and-dependency-injection.md) | [56](56-angular-architecture-and-dependency-injection.md), [57](57-angular-signals-reactivity-and-rxjs.md), [59](59-react-vs-angular-architecture-comparison.md) | an Angular 22 workspace: DI, signals, Signal Forms, SignalStore, interop | 28 |
| [E65](E65-ai-powered-react-interfaces.md) | [65](65-ai-powered-react-interfaces.md) | a chat UI with tools and human approval, on a mock model | 3 |
| [E66](E66-frontend-system-design.md) | [66](66-frontend-system-design.md) | the typeahead core: debounce, cancellation, ordering | 4 |
| [E67](E67-case-study-enterprise-saas-dashboard.md) | [67](67-case-study-enterprise-saas-dashboard.md) | tenant-scoped server state | 3 |
| [E68](E68-case-study-ecommerce-storefront.md) | [68](68-case-study-ecommerce-storefront.md) | a Next.js 16 storefront: cached pages, JSON-LD, optimistic bag | 5 |
| [E69](E69-case-study-collaborative-project-management.md) | [69](69-case-study-collaborative-project-management.md) | a CRDT board on Yjs, a convergence fuzzer, a Hocuspocus server | 13 |
| [E70](E70-case-study-enterprise-design-system.md) | [70](70-case-study-enterprise-design-system.md) | tokens, a contrast gate, an accessible Switch, usage telemetry | 7 |
| [E74](E74-machine-coding-drills.md) | [74](74-machine-coding-drills.md) | all eleven drills, with tests | 23 |
| [E75](E75-experimentation-and-product-analytics.md) | [75](75-experimentation-and-product-analytics.md) | assignment, sample sizes, SRM, peeking simulation | 6 |
| [E76](E76-frontend-cost-and-capacity-engineering.md) | [76](76-frontend-cost-and-capacity-engineering.md) | the cost and capacity model, and an SSR benchmark | 3 |
| [E78](E78-business-cases-and-investment-arguments.md) | [78](78-business-cases-and-investment-arguments.md) | NPV, payback, IRR and the Prism case | 3 |
| [E79](E79-distributed-systems-design-for-frontend-architects.md) | [79](79-distributed-systems-design-for-frontend-architects.md) | a token bucket and consistent hashing | 3 |

## How the code relates to the chapters

- **Copied, not retyped.** A build script extracted the code from the chapters' Markdown, so the projects contain what the book prints.
- **Lines added around the chapter's code are marked.** That means imports a chapter leaves out, types it defines elsewhere, and extra code the tests need. Each is marked `// ── Companion code (not in the chapter) ──` or "glue".
- **Excerpts are completed.** Where a chapter prints an excerpt, the project has the whole file, and the excerpt's lines appear in it in order. Code a chapter elides with `…` is filled in.
- **Short test snippets are condensed.** A few-line snippet in the text that illustrates a test maps to the named test file, not line for line.

## What isn't here

Some code needs infrastructure rather than a laptop: CI pipelines, CDN and edge configuration, module federation across separate deployments, an observability vendor, a real identity provider, and Playwright suites that download browsers. Other chapters are about practice rather than code. All of their code blocks were parsed and type-checked in the code audit (see [CHANGELOG.md](CHANGELOG.md)).

---

[Index](README.md) · [Next: E03 — mapLimit: bounded concurrency →](E03-javascript-runtime-and-engine.md)
