# 55 — React Ecosystem Atlas 2026

> A library is many things at once: a dependency, a supply-chain risk, an upgrade schedule, a hiring signal and an exit cost. Sorted by how often you'll actually think about each, "solves my problem" comes last. Use the fewest libraries that solve real problems. When you do add one, pick the boring, maintained choice that the next engineer already knows.

**Prerequisites:** [28 State and Data Ownership](28-state-and-data-ownership-architecture.md), [54 Choosing a Framework](54-choosing-a-react-framework.md) · **Related:** [29 Client State](29-client-state-management.md) · [30 Server State](30-server-state-and-data-fetching.md) · [35 Design Systems](35-enterprise-design-system-architecture.md) · [43 Security](43-frontend-security-architecture.md) · [60 Tooling](60-monorepos-build-tooling-and-bundlers.md)

---

## TL;DR

- **Platform first.** Before reaching for a library, check whether the platform already does it:
  - `<dialog>` and Popover ([06](06-modern-web-platform-apis.md)).
  - CSS anchor positioning.
  - View Transitions ([24](24-animation-and-motion-systems.md)).
  - `Intl` and Temporal ([37](37-internationalization-and-localization.md)).
  - `structuredClone`, `AbortSignal.timeout`, `URLPattern`.
  - React 19's Actions and `useOptimistic` ([16](16-react-19-features-and-the-compiler.md)).
- **One library per job,** chosen on purpose and recorded. Two state libraries, two date libraries or two component kits in one app is a governance failure, not a technical choice ([63](63-architecture-governance-and-adrs.md)).
- **Judge health on four signals:**
  - **Releases:** a steady cadence matters more than stars.
  - **Maintainers:** more than one, funded if possible.
  - **Security response:** advisories, provenance, no install scripts.
  - **Fit with React 19 and the Compiler:** works with SSR and RSC boundaries, and isn't flagged by the compiler's lint rules.
- **The 2026 churn worth knowing:**
  - New majors: TanStack Table v9, Jotai 3, MSW 3, Effect 4, Motion 14, MUI 9, Mantine 9, TypeScript 7 (native), pnpm 12, ESLint 10, Vitest 5.
  - Consolidations and deprecations: React Email 6 folded `@react-email/components` into `react-email`; `@opentelemetry/sdk-trace-web` is deprecated; Auth.js v5 is still in beta (Better Auth maintains Auth.js); Vaul is unmaintained; dnd-kit's new API lives in `@dnd-kit/react`.
- **The default stack** (section 1) is a starting point for an authenticated product app. Deviate when a requirement forces you to, and write down which one.

---

## How to read this atlas

Every category table has five columns:

| Column | Meaning |
|---|---|
| **Reach for** | The default in November 2026, given no special constraints |
| **Also good** | Credible alternatives, with the condition that makes them better |
| **Introduce when** | The signal that you need a library at all |
| **Avoid when** | When the default is the wrong tool, or no library is needed |

Versions are the latest on npm as of 22 November 2026. Re-check before you adopt: half of these will have moved by the time you read this.

---

## 1. A default stack for a new product app

| Concern | Default | Why |
|---|---|---|
| Framework | Per [54](54-choosing-a-react-framework.md); a Vite 8 SPA if no server rendering is needed | Simplest operations for authenticated apps |
| Language | TypeScript (7.x native compiler for builds; 6.x where tools need the compiler API) | TS 7 (July 2026) is the Go port, typically 8–12× faster; it ships without a programmatic API (expected in 7.1), so typescript-eslint and framework compilers such as Angular's still run on 6.x via `@typescript/typescript6` |
| Routing | TanStack Router or React Router | Typed routes and data loading ([31](31-routing-architecture.md)) |
| Server state | TanStack Query 5 | The de facto cache for server data ([30](30-server-state-and-data-fetching.md)) |
| Client state | `useState`/`useReducer` + context → Zustand 5 when shared | Most "global state" is server state or URL state ([28](28-state-and-data-ownership-architecture.md)) |
| URL state | The router's search params (or `nuqs` in Next.js) | Shareable, back-button-friendly state |
| Forms | React 19 Actions for simple forms; React Hook Form 7 or TanStack Form 1 for complex ones | [26](26-forms-and-validation.md) |
| Validation | Zod 4 (or Valibot for size-critical bundles) via Standard Schema | One schema across client, server and forms |
| UI primitives | Base UI, React Aria Components or Radix | Accessible behaviour you don't want to rebuild ([35](35-enterprise-design-system-architecture.md)) |
| Styling | Tailwind CSS 4 or CSS Modules with design tokens | Zero-runtime, Compiler-friendly ([23](23-styling-architecture-and-theming.md)) |
| Testing | Vitest 5 (browser mode) + Testing Library + MSW 3 + Playwright | [42](42-testing-architecture.md) |
| Lint/format | ESLint 10 with `eslint-plugin-react-hooks` 7 (Compiler rules), or Biome 2 / Oxlint | Enforce the Rules of React ([27](27-react-best-practices-and-code-review.md)) |
| Observability | Sentry (or your vendor) + `web-vitals` 6 + OpenTelemetry for traces | [41](41-observability-and-diagnostics.md) |
| Flags | OpenFeature React SDK with your provider | Vendor-neutral flags ([62](62-cicd-release-engineering-and-feature-flags.md)) |
| Package manager | pnpm (12.x) with lockfile, `minimumReleaseAge`, and dependency scripts blocked | Supply-chain hygiene ([43](43-frontend-security-architecture.md)) |

---

## 2. The atlas

### 2.1 Build, lint and repository tooling

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Dev server and bundler | **Vite 8** (Rolldown, Oxc) | Rsbuild/Rspack 2 (Webpack-compatible migrations); Turbopack inside Next.js | Always (or your framework's choice) | Hand-rolled Webpack configs for new apps |
| Monorepo orchestration | **Turborepo 2** (simple), **Nx 24** (large, with generators and boundaries) | pnpm workspaces alone for a few packages | More than one app or a shared package ([60](60-monorepos-build-tooling-and-bundlers.md)) | One app, one team |
| Lint | **ESLint 10** + `eslint-plugin-react-hooks` 7 + `@eslint-react` | **Oxlint 1.x** (very fast; pair with ESLint for plugin gaps), **Biome 2** (lint + format in one) | Day one | Running three linters with overlapping rules |
| Format | **Prettier 3** or Biome | | Day one | Debating style in reviews |
| Versioning and changelogs | **Changesets 3** | Release Please | Publishing packages | Single deployable app |

### 2.2 Server state and API clients

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Server-state cache | **TanStack Query 5** | SWR 2 (simpler, fewer features); RTK Query (already on Redux) | Any app that fetches and mutates server data | Framework loaders already cover a simple read-only page |
| End-to-end typed RPC (TS backend you own) | **tRPC 11** | **oRPC 1** (OpenAPI output built in) | Monorepo with a TypeScript backend | Public APIs, multi-language consumers: use OpenAPI ([33](33-api-integration-bff-and-contracts.md)) |
| GraphQL | **Apollo Client 4** | Relay 21 (large apps, strict fragments), urql 5 (light) | You already have a GraphQL API | Introducing GraphQL just for the frontend |
| OpenAPI clients | Generated types + a thin fetch wrapper (openapi-typescript and friends) | Orval, Hey API | Any REST API with a spec | Hand-written types that drift |

### 2.3 Client state

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Shared UI state across distant components | **Zustand 5** | Jotai 3 (atom graphs, derived state) | Context re-renders hurt, or state is shared by many unrelated components ([29](29-client-state-management.md)) | It's server data (use Query) or URL state (use the router) |
| Complex flows with explicit states | **XState 5** | `@xstate/store` 4 for simple event-driven stores | Wizards, protocols, retry and backoff flows, anything with illegal states to rule out | A boolean and a string would do |
| Large existing Redux apps | **Redux Toolkit 2** | | You have Redux | Starting a new app "because Redux" |
| Observable/mutable models | MobX 7, Valtio 2, Legend State | | Teams invested in that model | Mixed with the React Compiler without testing; mutation-based reactivity can defeat memoisation |

```ts
// src/store.ts: Zustand for client-only UI state shared across distant components
import { create } from 'zustand';

type Density = 'comfortable' | 'compact';
type UiState = {
  density: Density;
  commandPaletteOpen: boolean;
  setDensity: (d: Density) => void;
  toggleCommandPalette: () => void;
};

export const useUi = create<UiState>()((set) => ({
  density: 'comfortable',
  commandPaletteOpen: false,
  setDensity: (density) => set({ density }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
}));

// Components subscribe to a slice: this one re-renders only when density changes
export const useDensity = () => useUi((s) => s.density);
```

### 2.4 Local-first, sync and collaboration

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Collaborative editing (CRDT) | **Yjs 13** | Automerge 3 | Multiple people edit the same document at once ([34](34-realtime-offline-and-collaboration.md)) | Last-write-wins forms |
| Hosted presence and collaboration | **Liveblocks** | PartyKit (Cloudflare), your own WebSocket service | You want rooms, presence and comments without running infrastructure | Data residency rules forbid it |
| Sync engine over Postgres | **Zero** (1.x) | ElectricSQL 1.0, PowerSync, Convex (backend + sync) | Instant UI over a large relational dataset, offline-capable | Simple CRUD where Query plus optimistic updates suffice |
| Client-side reactive collections over any source | TanStack DB (1.0 RC) | | Many views over the same normalised client data | Production-critical paths before 1.0 stable |

### 2.5 Forms and validation

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Complex client forms | **React Hook Form 7** | **TanStack Form 1** (type-safe, framework-agnostic) | Many fields, dynamic arrays, field-level validation, performance-sensitive forms ([26](26-forms-and-validation.md)) | A three-field form: React 19 `<form action>` + `useActionState` |
| Progressive-enhancement forms with server validation | **Conform** | | Remix/React Router or Next.js Server Actions | SPA-only |
| Schemas | **Zod 4** | **Valibot 1** (smallest bundles), ArkType 2, Effect Schema (Effect 4) | Any boundary: API responses, forms, env vars, URL params | Validating trusted internal values everywhere |
| Interop | **Standard Schema** (`@standard-schema/spec`) | | Libraries that accept "any schema": routers, forms, server functions | |

### 2.6 UI primitives and component kits

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Headless, accessible primitives for your design system | **Base UI 1** or **React Aria Components 1** | Radix (unified `radix-ui` package), Ark UI 5 | Building a design system ([35](35-enterprise-design-system-architecture.md)) | Rebuilding menus and dialogs by hand |
| Copy-in components on primitives | **shadcn** (CLI 4) | | You want ownership of the code, not a dependency | You need centrally versioned components across many apps: build a package |
| Full component kits | **MUI 9**, **Mantine 9**, **Ant Design 6**, Chakra 3 | Fluent UI (Microsoft ecosystems) | Internal tools, admin apps, speed over brand | A strongly branded consumer product |
| Command palette | cmdk | Your primitives' combobox | ⌘K navigation | |
| Toasts | Sonner 2 | Your kit's toaster | Global notifications | Using toasts for errors users must act on ([36](36-accessibility-engineering.md)) |
| Positioning | CSS anchor positioning; Floating UI where unsupported | | Tooltips, popovers | |
| Date pickers | react-day-picker 10, React Aria's date components with `@internationalized/date` | | Date entry | Native `<input type="date">` covers the need |

### 2.7 Styling

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Utility-first | **Tailwind CSS 4** (+ `tailwind-merge` 3, `class-variance-authority`) | | Teams that like co-located styling and a constrained scale | You need runtime theming beyond CSS variables |
| Scoped CSS | **CSS Modules** + tokens as CSS variables | vanilla-extract, Panda CSS 2 (type-safe, zero-runtime) | Design systems that ship CSS | |
| Atomic, compiled CSS-in-JS | **StyleX** | | Large apps wanting deterministic style resolution | Small apps; the build integration isn't free |
| Runtime CSS-in-JS | styled-components 6 (v7 in prerelease), Emotion 11 | | Existing codebases | New code: runtime style injection fights streaming SSR, RSC and the Compiler ([23](23-styling-architecture-and-theming.md)) |

### 2.8 Tables, grids and virtualization

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Headless table logic | **TanStack Table 9** | | Custom-designed tables with sorting, filtering, grouping, selection | A static table: plain `<table>` |
| Batteries-included data grid | **AG Grid 36** | MUI X Data Grid 9 | Spreadsheet-like editing, pivoting, huge datasets, Excel export | Branded, simple lists |
| Virtualized lists | **TanStack Virtual 3** | react-window 2, React Virtuoso 4 (variable heights, chat) | More than ~a few hundred rows in the DOM ([25](25-complex-ui-engineering.md)) | Short lists: virtualization costs accessibility and find-in-page |

TanStack Table 9 (August 2026) is a real migration. Features are now registered explicitly, so a table that only sorts ships only sorting. `useTable` replaces `useReactTable`, and state lives in TanStack Store with fine-grained subscriptions. Sort and filter function names are type-checked against what you registered. Using an unregistered `sortFn: 'text'` failed the typecheck in the chapter's verification code.

```tsx
// src/InvoiceTable.tsx: TanStack Table v9 ships only the features you register
import {
  createColumnHelper, createSortedRowModel, FlexRender, rowSortingFeature, sortFn_alphanumeric, tableFeatures, useTable,
} from '@tanstack/react-table';

type Invoice = { id: string; number: string; customer: string; totalMinor: number };

const features = tableFeatures({                     // defined once, outside the component
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const col = createColumnHelper<typeof features, Invoice>();
const columns = col.columns([
  col.accessor('number', { header: 'Invoice', sortFn: 'alphanumeric' }),
  col.accessor('customer', { header: 'Customer' }),
  col.accessor('totalMinor', { header: 'Total', cell: (c) => (c.getValue() / 100).toFixed(2) }),
]);

export function InvoiceTable({ data }: { data: Invoice[] }) {
  const table = useTable({ features, columns, data });
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id} aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : 'none'}>
                <button type="button" onClick={h.column.getToggleSortingHandler()}>
                  <FlexRender header={h} />
                </button>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => <td key={cell.id}><FlexRender cell={cell} /></td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

For large existing v8 codebases, the `@tanstack/react-table/legacy` entry point (`useLegacyTable`) lets you upgrade the package first and migrate tables one at a time.

### 2.9 Charts and data visualisation

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Standard business charts | **Recharts 3** | ECharts 6 (large data, many chart types), Chart.js via react-chartjs-2 | Dashboards with common chart types | One sparkline: a small SVG |
| Bespoke visualisation | **visx 4** (D3 primitives as React) | D3 directly; Observable Plot (exploratory, concise) | Custom, designed visuals | Standard charts: you'll rebuild axes and tooltips |
| Very large datasets / maps | ECharts, deck.gl 9 | | Tens of thousands of points, WebGL | |

Charts need an accessible alternative (a data table or a summary). Colour must not be the only signal ([36](36-accessibility-engineering.md)).

### 2.10 Animation and drag-and-drop

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Component animation and gestures | **Motion 14** (`motion/react`) | React Spring 10 (physics) | Layout animations, gestures, shared-element transitions ([24](24-animation-and-motion-systems.md)) | CSS transitions or View Transitions already do it |
| Timeline and marketing animation | **GSAP 3** (fully free, including plugins, since 2025) | | Scroll-driven storytelling, complex timelines | App UI micro-interactions |
| One-line list animations | AutoAnimate | | Add/remove/reorder in lists | |
| Vector animation assets | dotLottie | | Designer-made animations | Decorative motion with no reduced-motion fallback |
| Drag and drop (app UI) | **dnd-kit** (`@dnd-kit/react`, the new API) | **Pragmatic drag and drop 4** (Atlassian; browser-native DnD, scales to big boards) | Sortable lists, boards | Native file drop zones (use the platform) |

`@dnd-kit/core` (the classic API) last published in December 2024. New code should evaluate `@dnd-kit/react`, which is still 0.x, or Pragmatic drag and drop. Whichever you pick, keyboard and screen reader support for reordering is a requirement, not a stretch goal.

### 2.11 Rich text and editors

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Product rich-text editor | **Tiptap 3** (ProseMirror-based, extension ecosystem) | **Lexical** (Meta; performance, small core) | Comments, documents, notes | A `<textarea>` with Markdown would do |
| Highly custom document models | Slate, Plate (`platejs`, on Slate) | ProseMirror directly | Bespoke structures, AI-assisted editing toolkits | |
| Block-based "Notion-like" | BlockNote | | Block editing out of the box | |
| Collaboration | Yjs bindings for Tiptap/Lexical/ProseMirror | | Multi-user editing | |

Editors are an XSS surface. Sanitise on output, not just on input, and keep pasted HTML away from `dangerouslySetInnerHTML` ([43](43-frontend-security-architecture.md)).

### 2.12 Dates and internationalisation

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Date arithmetic and formatting | **`Intl` + Temporal** (polyfill where unsupported: Temporal isn't in Safari yet) | date-fns 4 (with time zones), Day.js, Luxon | Anything beyond formatting ([37](37-internationalization-and-localization.md)) | Moment.js (legacy) |
| App translation (SPA) | **react-i18next** | react-intl 12 (FormatJS), Lingui 6 (compile-time, small) | More than one locale | |
| Next.js translation | **next-intl 4** | Paraglide 3 (compiled, tree-shakable messages) | Next.js App Router apps | |
| Message syntax | ICU MessageFormat today; MessageFormat 2 via `messageformat` v4 | | Plurals, gender, selects | String concatenation |

### 2.13 Authentication

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Self-hosted auth in your app | **Better Auth** | Auth.js (now maintained by the Better Auth team; v5 still beta) | You own users and sessions, and want passkeys, organisations, 2FA | You have an enterprise IdP; integrate it instead |
| Hosted identity | **Clerk**, **WorkOS AuthKit**, Auth0 | Your cloud's IdP | Enterprise SSO/SCIM, compliance, speed | Strict data residency |
| Standards-based OIDC client in the browser | oidc-client-ts | | Pure SPAs against an IdP | Prefer a BFF and cookies when you have a server ([45](45-authentication-and-authorization.md)) |

### 2.14 Testing

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Unit and component | **Vitest 5** (browser mode for real DOM) + **Testing Library** | Jest 30 (existing suites) | Day one ([42](42-testing-architecture.md)) | |
| Network mocking | **MSW 3** | | Component and integration tests, Storybook, local dev | |
| End to end | **Playwright** | | Critical journeys, cross-browser | Testing what a component test covers |
| Component workshop and docs | **Storybook 10** | Ladle | Design systems, visual review, interaction tests | One-off app components |
| Visual regression | Chromatic, Playwright screenshots | | Design systems | Flaky pixel diffs on dynamic data |

### 2.15 Observability, analytics and feature flags

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Errors and session context | **Sentry** (React SDK 11) | Datadog RUM 7, your APM vendor | Before launch ([41](41-observability-and-diagnostics.md)) | |
| Web vitals | **`web-vitals` 6** | Vendor RUM | Always | |
| Tracing | **OpenTelemetry** (browser instrumentation; `sdk-trace-web` is deprecated in favour of `sdk-trace`) | Vendor SDKs | Correlating frontend and backend | |
| Product analytics | PostHog | Amplitude, Mixpanel | Product decisions need data | Before consent and privacy review ([46](46-enterprise-saas-architecture.md)) |
| Feature flags | **OpenFeature** React SDK + a provider (LaunchDarkly, GrowthBook, Flagsmith, Unleash) | | Trunk-based delivery, experiments ([62](62-cicd-release-engineering-and-feature-flags.md)) | |

### 2.16 AI interfaces

| Need | Reach for | Also good | Introduce when | Avoid when |
|---|---|---|---|---|
| Streaming chat, tool calls, structured output | **Vercel AI SDK 7** (`ai`, `@ai-sdk/react`) | **TanStack AI 1** (October 2026; provider-agnostic, TanStack-style) | LLM features in a React app ([65](65-ai-powered-react-interfaces.md)) | |
| Chat UI components | assistant-ui | CopilotKit (in-app copilots with actions) | You want proven chat UX primitives | |
| Tool and context protocol | **MCP** TypeScript SDK | | Exposing app capabilities to agents | |

### 2.17 Maps, 3D, PDF and email

| Need | Reach for | Also good |
|---|---|---|
| Interactive maps | MapLibre GL 6 (+ react-map-gl 8) | Leaflet with react-leaflet 5 (simple, raster); deck.gl for data layers |
| 3D | React Three Fiber 9 + drei | Three.js directly |
| Generate PDFs | `@react-pdf/renderer` 4 | Server-side HTML-to-PDF (headless browser) for complex layouts |
| Display PDFs | `pdfjs-dist` 6 | The browser's built-in viewer |
| Email templates | **React Email 6** (`react-email`; `@react-email/components` is deprecated) | MJML |

### 2.18 Utilities

| Need | Reach for | Notes |
|---|---|---|
| Lodash-style helpers | **es-toolkit** | Modern, tree-shakable; often you need `Object.groupBy`, `structuredClone` or `Array.prototype.toSorted` instead |
| Immutable updates | Immer 11 | Redux Toolkit uses it; for deep updates in reducers |
| Exhaustive matching | ts-pattern 5 | Type-safe `match` over discriminated unions |
| Class names | clsx (+ tailwind-merge) | |
| Error boundaries | react-error-boundary 6 | Resettable boundaries with hooks ([40](40-resilience-and-reliability.md)) |
| URL state in Next.js | nuqs 2 | Type-safe search params |
| Keyboard shortcuts, debounce/throttle | TanStack Hotkeys, TanStack Pacer | Pre-1.0; or a few lines of your own |
| Drawer | Your primitives' dialog styled as a sheet | Vaul is marked unmaintained; its last release was December 2024 |

---

## 3. Evaluating a library before it enters the codebase

| Signal | How to check | Red flags |
|---|---|---|
| **Maintenance** | Release history (`npm view <pkg> time`), issue response times, number of active maintainers | One maintainer and no releases in 12 months; README "unmaintained" notices |
| **Security posture** | Advisories history, npm provenance, `postinstall` scripts, 2FA and trusted publishing | Install scripts in a UI library; tokens published from personal machines |
| **React 19 / Compiler fit** | Works under `<StrictMode>`, `eslint-plugin-react-hooks` doesn't flag it as incompatible, no reliance on mutation-based reactivity | Mutable stores read during render; `findDOMNode` or legacy context |
| **SSR / RSC fit** | Ships `'use client'` boundaries correctly; no `window` access at import | Crashes on import in Node; forces whole trees client-side |
| **Bundle cost** | Size of the tree-shaken import in *your* build, not the npm tarball | Side-effectful imports; no ESM build |
| **Accessibility** | Keyboard and screen reader support, documented patterns ([36](36-accessibility-engineering.md)) | "Accessibility on the roadmap" for an interactive widget |
| **Types** | First-party TypeScript, inference quality, no `any` holes | Community `@types` lagging majors |
| **License and governance** | License compatibility; foundation or company backing | Licence changes on minor releases; open-core with critical features paywalled |
| **Exit cost** | How much of your code would change to remove it? | Library types leaking through your domain layer |

Wrap the libraries you're most likely to replace (charts, editors, date pickers, analytics) behind your own components or modules, so the exit cost is one module rather than every call site ([22](22-component-architecture-and-patterns.md)).

> [!IMPORTANT]
> In 2026 the riskiest dependency is the one you install the day it's published. The malicious TanStack versions of May 2026 were published in a six-minute burst through the project's own pipeline, and anything that resolved fresh versions before they were pulled could install them. A minimum release age (`minimumReleaseAge` in pnpm), committed lockfiles, and blocked install scripts turn most supply-chain incidents into non-events ([43](43-frontend-security-architecture.md)).

---

## 4. What changed in 2026: majors and deprecations

| Package | Change | Date |
|---|---|---|
| TypeScript | 7.0, the native (Go) compiler; no programmatic API until 7.1, so `@typescript/typescript6` (`tsc6`) runs side by side for tools | 8 Jul 2026 |
| ESLint | 10.0 | 6 Feb 2026 |
| pnpm | 11.0, then 12.0 | 28 Apr / 26 Aug 2026 |
| Vite | 8 (Rolldown + Oxc) | 12 Mar 2026 |
| Vitest | 5.0 | 3 Sep 2026 |
| MSW | 3.0 | 28 Sep 2026 |
| TanStack Table | 9.0: explicit, tree-shakable features; `useTable`; Store-based state | 4 Aug 2026 |
| TanStack AI | 1.0 | 22 Oct 2026 |
| Vercel AI SDK | 7.0 | 25 Jun 2026 |
| Jotai | 3.0 | 8 Sep 2026 |
| Effect | 4.0 | 1 Oct 2026 |
| Motion | 13.0, then 14.0 | 5 Aug / 2 Oct 2026 |
| MUI | 9.0 | 7 Apr 2026 |
| Mantine | 9.0 | 31 Mar 2026 |
| MobX | 7.0 | 30 Jul 2026 |
| Sentry React SDK | 11.0 | 23 Sep 2026 |
| Nx | 24.0 | 21 Oct 2026 |
| react-i18next | 18.0 | 7 Nov 2026 |
| React Email | 6.0 unified everything into `react-email`; `@react-email/components` deprecated | Apr 2026 |
| OpenTelemetry JS | `@opentelemetry/sdk-trace-web` deprecated in favour of `@opentelemetry/sdk-trace` | 2026 |
| Auth.js / NextAuth | v4 is still `latest`; v5 still beta; maintained by the Better Auth team since Sep 2025 | ongoing |
| styled-components | 6.x maintained; v7 in prerelease | 2026 |

The dates come from npm publish times. Each major has a migration guide: read it before upgrading, and upgrade one major per pull request.

---

## Decision framework

**Problem.** Should this library enter the codebase, and which one?

**Constraints.** Is there a platform feature or an existing dependency that covers it? Bundle budget. Supply-chain policy. Accessibility requirements. SSR/RSC and React Compiler compatibility. Team familiarity. License.

| Situation | Decision |
|---|---|
| The platform or React 19 covers 80% of the need | Use the platform; wrap it in your own component |
| An existing dependency covers it | Use it, even if a trendier option exists |
| It's a core concern (server state, forms, primitives) | Pick the category default; record it in an ADR |
| It's a leaf concern (charts, editor, maps) | Pick on fit; wrap it behind your own interface for a cheap exit |
| Two libraries for the same job exist in the codebase | Choose one; migrate opportunistically, with a lint rule banning new imports of the other |

**Criteria.** Need, then health, then fit with React 19 and SSR, then bundle and accessibility, then exit cost.

**Failure modes.**

- Adopting by stars.
- Duplicate libraries per category.
- Libraries that block React upgrades.
- Leaking library types into domain code.
- Unpinned versions with no release cooldown.
- Picking runtime CSS-in-JS for new RSC apps.

**Migration path.** Inventory dependencies by category. Mark one "default" per category in an `ARCHITECTURE.md`. Add lint rules (`no-restricted-imports`) against non-defaults. Then retire duplicates as code is touched.

---

## Pitfalls and anti-patterns

- **A global state library for server data.** Use Query, and keep Zustand for UI state.
- **A component kit plus a separate primitives library plus hand-rolled widgets**, giving three accessibility models and three focus-trap implementations.
- **Choosing by GitHub stars.** Stars measure past attention, not current maintenance.
- **Upgrading the whole ecosystem in one PR.** When it breaks, you can't tell which major caused it.
- **Libraries in the domain layer.** `import { z } from 'zod'` in a shared schema package is fine. `import type { Row } from '@tanstack/react-table'` in business logic is not.
- **Installing `latest` in CI.** Lockfiles exist; use them.
- **Ignoring deprecation notices.** `npm` prints them for a reason. `@react-email/components` and `sdk-trace-web` are 2026 examples.
- **Adding a utility library for one function.** `Object.groupBy` and `Array.prototype.toSorted` are built in.

---

## Architect's checklist

- [ ] One documented default per category (state, data, forms, validation, primitives, styling, testing, dates, i18n, charts)
- [ ] `no-restricted-imports` rules prevent duplicates and deprecated packages
- [ ] New dependencies go through review: health, security, React 19/SSR fit, bundle, accessibility, license, exit cost
- [ ] Lockfile committed; `minimumReleaseAge` configured; dependency install scripts blocked by default
- [ ] Leaf libraries (charts, editors, maps, analytics) are wrapped behind internal interfaces
- [ ] A Renovate or Dependabot policy groups minors, isolates majors, and respects release cooldowns
- [ ] Quarterly dependency review: deprecations, unmaintained packages, majors pending
- [ ] Bundle budgets in CI catch heavy additions ([39](39-web-performance-and-core-web-vitals.md))

---

## Interview angles

**Q1. How do you decide whether to add a library?**
First check whether the platform or React already solves it (dialogs, popovers, View Transitions, `Intl`, Actions), and whether an existing dependency does. If not, evaluate health (release cadence, maintainers, security response), fit (React 19, Compiler, SSR/RSC boundaries, types), cost (bundle, accessibility work) and exit cost. Core concerns get one documented default, recorded in an ADR. Leaf concerns get wrapped behind our own interface so replacing them later is cheap.

**Q2. TanStack Query, Zustand or Redux Toolkit for a new app?**
They solve different problems. Server data (anything that lives in a database) belongs in a server-state cache like TanStack Query: caching, dedupe, invalidation, optimistic updates. Client UI state shared across distant components (density, open panels, a command palette) fits Zustand, or plain context if it changes rarely. Redux Toolkit makes sense when an app already uses Redux or needs its devtools-centric, event-sourced model. Most apps need Query plus very little else.

**Q3. What would you look for before adopting a UI component library?**
Accessibility first: keyboard and screen reader behaviour for every interactive component, and documented patterns. Then theming through tokens or CSS variables, not runtime style injection. SSR and RSC compatibility, React 19 support, bundle cost per component, licence and governance, and how much branding control we need. For a strongly branded product I'd rather build a design system on headless primitives (Base UI, React Aria, Radix) than restyle a full kit.

**Q4. A dependency you rely on is marked unmaintained. What do you do?**
Assess the exposure: how widely it's used, whether it has known vulnerabilities, and whether it blocks React or framework upgrades. If it's wrapped behind our own component, replace the implementation in one place. If not, wrap it first, then swap. Meanwhile, pin it, monitor advisories, and add a lint rule against new imports. For a small, stable library, vendoring with an owner can be acceptable; for anything security-relevant it isn't.

**Q5. How do you protect the app from supply-chain attacks through npm?**
Committed lockfiles and `npm ci` or `pnpm install --frozen-lockfile`. A minimum release age, so nothing newly published installs automatically. Dependency install scripts blocked, with an allowlist. Provenance checks, while remembering that a compromised pipeline can produce valid provenance, as in the TanStack incident. Least-privilege CI tokens and OIDC trusted publishing for our own packages. Renovate with grouped, delayed updates. And a practised response: who rotates which secrets when a dependency turns malicious.

---

## Further reading

- npm, *package metadata* (`npm view <pkg> time`, `dist-tags`, `deprecated`) is the fastest ground truth for versions and maintenance
- TanStack blog, *Announcing TanStack Table V9*: <https://tanstack.com/blog/announcing-tanstack-table-v9>
- React Email docs, *Updating React Email* (v6 unification): <https://react.email/docs/getting-started/updating-react-email>
- OpenFeature React SDK: <https://openfeature.dev/docs/reference/technologies/client/web/react>
- pnpm docs, *Settings* (`minimumReleaseAge`, build-script controls): <https://pnpm.io/settings>
- Socket and Snyk package health pages, for maintenance and security signals before adoption

---

[← Previous: 54 — Choosing a React Framework](54-choosing-a-react-framework.md) · [Index](README.md) · [Next: 56 — Angular Architecture and Dependency Injection →](56-angular-architecture-and-dependency-injection.md)
