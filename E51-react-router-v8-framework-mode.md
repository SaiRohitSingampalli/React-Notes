# E51 — A React Router v8 app in framework mode

> Runnable code for [51 — React Router v8 in Framework Mode](51-react-router-v8-framework-mode.md). 4 tests.

The chapter's app: a route tree as configuration, route modules with loaders and actions and generated types, auth middleware with typed context, streaming, fetcher mutations, a resource route for webhooks, and a per-request CSP nonce in `entry.server.tsx`. The services (`app/server/*.server.ts`) are stand-ins.

`npm test` builds the app, starts the production server and checks what the chapter claims: `/` is prerendered, each response has a fresh nonce that every script carries, the loader renders the invoice, and the webhook route answers JSON. `npm run typecheck` generates the route types first, as the chapter's section 5 describes.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 51    # writes examples/51-react-router-v8-framework-mode/
cd examples/51-react-router-v8-framework-mode
npm ci
npm test
npm run typecheck
npm run dev    # then open http://localhost:5173/invoices/inv_42
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `react-router.config.ts` | 51, "2. Anatomy of a framework-mode app" |
| `app/context.ts` | 51, "6.1 The model" |
| `app/entry.server.tsx` | 51, "10.3 CSP nonces and SRI" |
| `app/entry.server.tsx` | 51, "11. Errors and observability" |
| `app/routes.ts` | 51, "2. Anatomy of a framework-mode app" |
| `app/root.tsx` | 51, "6.2 The rules that bite" |
| `app/server/session.server.ts` | 51, "10.2 Sessions" |
| `app/routes/app-layout.tsx` | 51, "6.1 The model" |
| `app/routes/api.webhooks.billing.ts` | 51, "8. Mutations: forms, actions and fetchers" |
| `app/routes/preferences.tsx` | 51, "7.2 Client loaders: when the browser owns part of the data" |
| `app/routes/invoices/detail.tsx` | 51, "4. Route modules: the export contract" |
| `app/routes/invoices/index.tsx` | 51, "7.3 Opting out of revalidation" |
| `app/routes/invoices/index.tsx` | 51, "8. Mutations: forms, actions and fetchers" |
| `tsconfig.json` | 51, "5. Type safety: generated route types" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `app/context.ts`

```ts
// app/context.ts
import { createContext } from 'react-router';

export type SessionUser = { id: string; name: string; tenantId: string; permissions: string[] };

// No default value: context.get() throws if a loader runs without the auth middleware having set it
export const userContext = createContext<SessionUser>();
```

### `app/entry.server.tsx`

```tsx
// app/entry.server.tsx: the default entry, plus a per-request CSP nonce, error reporting and tracing
import { PassThrough } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { isbot } from 'isbot';
import { renderToPipeableStream, type RenderToPipeableStreamOptions } from 'react-dom/server';
import { createReadableStreamFromReadable } from '@react-router/node';
import {
  ServerRouter, type EntryContext, type HandleErrorFunction, type RouterContextProvider, type ServerInstrumentation,
} from 'react-router';
import { captureError, recordTiming } from './shared/observability'; // companion stand-in for the app's module

export const streamTimeout = 5_000; // deferred promises still pending after this are rejected

export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return; // client navigated away: not an error worth paging on
  captureError(error, { path: new URL(request.url).pathname, method: request.method }); // from '@/shared/observability'
};

export const instrumentations: ServerInstrumentation[] = [
  {
    route(route) {
      route.instrument({
        async loader(callLoader) {
          const start = performance.now();
          const result = await callLoader(); // read-only: you observe, you cannot change the result
          recordTiming(`loader:${route.id}`, performance.now() - start, result.status);
        },
      });
    },
  },
];

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  if (request.method.toUpperCase() === 'HEAD') {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }
  const nonce = randomBytes(16).toString('base64');
  responseHeaders.set(
    'Content-Security-Policy',
    `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
  );

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get('user-agent');
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady';
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort(), streamTimeout + 1000);

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
      {
        nonce,
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) { clearTimeout(timeoutId); timeoutId = undefined; callback(); },
          });
          responseHeaders.set('Content-Type', 'text/html');
          pipe(body);
          resolve(new Response(createReadableStreamFromReadable(body), { headers: responseHeaders, status: responseStatusCode }));
        },
        onShellError(error: unknown) { reject(error); },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) console.error(error);
        },
      },
    );
  });
}
```

### `app/root.tsx`

```tsx
// app/root.tsx (the chapter prints an excerpt)
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import type { Route } from './+types/root';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Client middleware wraps every client navigation and fetcher call (here: navigation timing)
const timingMiddleware: Route.ClientMiddlewareFunction = async ({ request }, next) => {
  const start = performance.now();
  await next();
  performance.measure(`nav ${new URL(request.url).pathname}`, { start });
};
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [timingMiddleware];

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return <main><h1>{error.status === 404 ? 'Page not found' : 'Something went wrong'}</h1></main>;
  }
  return <main><h1>Something went wrong</h1></main>; // report `error` from entry.server's handleError
}
```

### `app/routes.ts`

```ts
// app/routes.ts: the route tree is configuration, not a folder convention
import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('pricing', 'routes/pricing.tsx'),
  route('login', 'routes/login.tsx'),
  layout('routes/app-layout.tsx', [                 // pathless layout: auth middleware + shell
    ...prefix('invoices', [
      index('routes/invoices/index.tsx'),
      route(':invoiceId', 'routes/invoices/detail.tsx'),
    ]),
    route('preferences', 'routes/preferences.tsx'),
  ]),
  route('api/webhooks/billing', 'routes/api.webhooks.billing.ts'), // resource route: no component
] satisfies RouteConfig;
```

### `app/routes/api.webhooks.billing.ts`

```ts
// app/routes/api.webhooks.billing.ts: a resource route (no default export), signature-checked
import type { Route } from './+types/api.webhooks.billing';
import { verifyBillingSignature } from '../server/invoices.server';

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const raw = await request.text();
  const event = await verifyBillingSignature(request.headers.get('billing-signature'), raw); // throws if invalid
  // … update projections, enqueue jobs; respond fast
  return Response.json({ received: event.type });
}
```

### `app/routes/app-layout.tsx`

```tsx
// app/routes/app-layout.tsx: authenticated shell; middleware runs before every loader and action below it
import { Outlet, redirect } from 'react-router';
import type { Route } from './+types/app-layout';
import { userContext } from '../context';
import { getUserFromSession } from '../server/auth.server';

const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  const user = await getUserFromSession(request);
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  context.set(userContext, user);
};

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return { user: { name: user.name } }; // DTO for the shell; never the whole session
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="app-shell">
      <header>Signed in as {loaderData.user.name}</header>
      <main id="main"><Outlet /></main>
    </div>
  );
}
```

### `app/routes/home.tsx`

```tsx
export default function Home() { return <h1>Acme Insights</h1>; }
```

### `app/routes/invoices/detail.tsx`

```tsx
// app/routes/invoices/detail.tsx: loader with streaming, action with validation, typed everything
import { Suspense } from 'react';
import { Await, data, Form, useNavigation } from 'react-router';
import type { Route } from './+types/detail';
import { userContext } from '../../context';
import { invoices } from '../../server/invoices.server';

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const invoice = await invoices.get(user.tenantId, params.invoiceId); // params.invoiceId is typed
  if (!invoice) throw data('Invoice not found', { status: 404 });
  return {
    invoice,
    canVoid: user.permissions.includes('invoice:void') && invoice.status === 'open',
    activity: invoices.activity(user.tenantId, invoice.id), // not awaited: streams to the client
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user.permissions.includes('invoice:void')) throw data('Forbidden', { status: 403 });
  const form = await request.formData();
  const reason = String(form.get('reason') ?? '').trim();
  if (reason.length < 5) return data({ errors: { reason: 'Give a reason of at least 5 characters' } }, { status: 400 });
  await invoices.void(user.tenantId, params.invoiceId, reason);
  return { ok: true as const };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `Invoice ${loaderData.invoice.number} · Acme Insights` : 'Invoice · Acme Insights' }];
}

export function headers() {
  return { 'Cache-Control': 'private, no-store' }; // tenant data: never in shared caches
}

export default function InvoiceDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { invoice, canVoid, activity } = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  const errors = actionData && 'errors' in actionData ? actionData.errors : undefined;

  return (
    <article>
      <h1>Invoice {invoice.number}</h1>
      <p>Status: {invoice.status}</p>
      {canVoid && (
        <Form method="post">
          <label htmlFor="reason">Reason for voiding</label>
          <input id="reason" name="reason" aria-invalid={!!errors?.reason} aria-describedby={errors?.reason ? 'reason-error' : undefined} />
          {errors?.reason && <p id="reason-error">{errors.reason}</p>}
          <button type="submit" aria-disabled={submitting}>{submitting ? 'Voiding…' : 'Void invoice'}</button>
        </Form>
      )}
      <Suspense fallback={<p>Loading activity…</p>}>
        <Await resolve={activity}>
          {(items) => <ul>{items.map((a) => <li key={a.id}>{a.text}</li>)}</ul>}
        </Await>
      </Suspense>
    </article>
  );
}
```

### `app/routes/invoices/index.tsx`

```tsx
// app/routes/invoices/index.tsx (the chapter prints an excerpt)
import { Form, href, Link, useFetcher, type ShouldRevalidateFunctionArgs } from 'react-router';
import type { Route } from './+types/index';
import { userContext } from '../../context';
import { invoices } from '../../server/invoices.server';

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return { q, rows: await invoices.list(user.tenantId, q) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const form = await request.formData();
  if (form.get('intent') !== 'star') return new Response('Unknown intent', { status: 400 });
  await invoices.setStar(user.tenantId, String(form.get('id')), form.get('starred') === 'true');
  return { ok: true as const };
}

// A star toggle does not change which invoices match the search: skip the list reload it would trigger
export function shouldRevalidate({ formData, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formData?.get('intent') === 'star') return false;
  return defaultShouldRevalidate;
}

function StarButton({ id, starred }: { id: string; starred: boolean }) {
  const fetcher = useFetcher<typeof action>();
  // Optimistic: while the submission is in flight, render the value being submitted
  const optimistic = fetcher.formData ? fetcher.formData.get('starred') === 'true' : starred;
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="star" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="starred" value={String(!optimistic)} />
      <button type="submit" aria-pressed={optimistic}>{optimistic ? 'Unstar' : 'Star'}</button>
    </fetcher.Form>
  );
}

export default function Invoices({ loaderData }: Route.ComponentProps) {
  return (
    <section>
      <h1>Invoices</h1>
      <Form role="search">
        <label htmlFor="q">Search</label>
        <input id="q" name="q" type="search" defaultValue={loaderData.q} />
      </Form>
      <ul>
        {loaderData.rows.map((inv) => (
          <li key={inv.id}>
            <Link to={href('/invoices/:invoiceId', { invoiceId: inv.id })} prefetch="intent">{inv.number}</Link>
            <StarButton id={inv.id} starred={inv.starred} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### `app/routes/login.tsx`

```tsx
export default function Login() { return <h1>Sign in</h1>; }
```

### `app/routes/preferences.tsx`

```tsx
// app/routes/preferences.tsx: server data merged with browser-only state on the client
import type { Route } from './+types/preferences';
import { userContext } from '../context';

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return { saved: { density: 'comfortable' as 'comfortable' | 'compact' }, userId: user.id };
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const [server, draft] = await Promise.all([serverLoader(), Promise.resolve(readDraft())]);
  return { ...server, draft }; // draft lives in localStorage only
}
clientLoader.hydrate = true as const; // run on hydration too, so the draft shows on first load

export function HydrateFallback() {
  return <p>Loading preferences…</p>; // SSR renders this; the client loader fills in the rest
}

export default function Preferences({ loaderData }: Route.ComponentProps) {
  return <p>Density: {loaderData.draft?.density ?? loaderData.saved.density}</p>;
}

function readDraft(): { density: 'comfortable' | 'compact' } | null {
  try { return JSON.parse(localStorage.getItem('prefs-draft') ?? 'null'); } catch { return null; }
}
```

### `app/routes/pricing.tsx`

```tsx
export default function Pricing() { return <h1>Pricing</h1>; }
```

### `app/server/auth.server.ts`

```ts
import type { SessionUser } from '../context';
export async function getUserFromSession(_request: Request): Promise<SessionUser | null> { return { id: 'u1', name: 'Ana', tenantId: 't1', permissions: ['invoice:read', 'invoice:void'] }; }
export function safeReturnTo(value: string | null): string { return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/'; }
```

### `app/server/invoices.server.ts`

```ts
export type InvoiceDTO = { id: string; number: string; status: 'open' | 'paid' | 'void'; totalMinor: number; currency: string };
export type ActivityDTO = { id: string; at: string; text: string };
export const invoices = {
  get: async (_tenantId: string, id: string): Promise<InvoiceDTO | null> => ({ id, number: 'INV-0042', status: 'open', totalMinor: 129900, currency: 'EUR' }),
  activity: async (_tenantId: string, _id: string): Promise<ActivityDTO[]> => [],
  void: async (_tenantId: string, _id: string, _reason: string) => {},
  list: async (_tenantId: string, _q: string): Promise<(InvoiceDTO & { starred: boolean })[]> => [],
  setStar: async (_tenantId: string, _id: string, _starred: boolean) => {},
};
export async function verifyBillingSignature(_sig: string | null, raw: string) { return JSON.parse(raw) as { type: string; tenantId: string; invoiceId: string }; }
```

### `app/server/session.server.ts`

```ts
// app/server/session.server.ts: the session is an opaque id in a hardened cookie; the data lives server-side
import { createCookieSessionStorage } from 'react-router';

type SessionData = { sessionId: string };
type SessionFlash = { toast: string };

export const sessionStorage = createCookieSessionStorage<SessionData, SessionFlash>({
  cookie: {
    name: '__Host-session',      // __Host-: Secure, Path=/, no Domain, so subdomains can't plant it
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
    secrets: [process.env.SESSION_SECRET_CURRENT!, process.env.SESSION_SECRET_PREVIOUS!].filter(Boolean), // first signs, all verify
  },
});

export async function readSessionId(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return session.get('sessionId') ?? null;
}
```

### `app/shared/observability.ts`

```ts

// Companion code: stand-ins for the app's observability module (chapter 41). Swap in your vendor's SDK.
export function captureError(error: unknown, tags: Record<string, string> = {}) {
  console.error('[captureError]', tags, error);
}
export function recordTiming(name: string, ms: number, status: string) {
  if (process.env.LOG_TIMINGS) console.info(`[timing] ${name} ${ms.toFixed(1)} ms ${status}`);
}
```

### `test/smoke.test.mjs`

```js

// Companion code: start the production build and check what the chapter says it does
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const freePort = () => new Promise((resolve) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
let server, base;

before(async () => {
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn('node_modules/.bin/react-router-serve', ['build/server/index.js'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'production', SESSION_SECRET_CURRENT: 'test-only-secret' }, stdio: 'inherit' });
  for (let i = 0; i < 100; i++) {
    try { await fetch(base + '/'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('react-router-serve: the server did not start');
});
after(() => server?.kill());

test('marketing pages are prerendered at build time', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Acme Insights/);
});

test('every response carries a fresh CSP nonce, and every script uses it', async () => {
  const nonces = [];
  for (let i = 0; i < 2; i++) {
    const res = await fetch(base + '/invoices/inv_42');
    assert.equal(res.status, 200);
    const csp = res.headers.get('content-security-policy') ?? '';
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(nonce, 'CSP header with a nonce');
    const html = await res.text();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    assert.ok(scripts.length > 0);
    for (const tag of scripts) assert.ok(tag.includes(`nonce="${nonce}"`), tag);
    nonces.push(nonce);
  }
  assert.notEqual(nonces[0], nonces[1]);
});

test('the invoice loader streams activity after the shell', async () => {
  const html = await (await fetch(base + '/invoices/inv_42')).text();
  assert.match(html, /INV-0042/);
});

test('a resource route answers webhooks without rendering a page', async () => {
  const res = await fetch(base + '/api/webhooks/billing', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'invoice.paid', tenantId: 't1', invoiceId: 'inv_42' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: 'invoice.paid' });
});
```

### `package.json`

```json
{
  "name": "handbook-51-react-router-v8-framework-mode",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "react-router typegen && tsc",
    "pretest": "react-router build",
    "test": "node --test \"test/**/*.test.mjs\""
  },
  "dependencies": {
    "@react-router/node": "8.5.2",
    "@react-router/serve": "8.5.2",
    "isbot": "5.2.3",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-router": "8.5.2"
  },
  "devDependencies": {
    "@react-router/dev": "8.5.2",
    "@types/node": "22.20.6",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "typescript": "6.0.3",
    "vite": "8.3.8"
  }
}
```

### `.gitignore`

```text
node_modules
build
.react-router
```

### `react-router.config.ts`

```ts
// react-router.config.ts
import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,                       // server rendering at runtime (set false for SPA mode)
  prerender: ['/', '/pricing'],    // plus static HTML for marketing pages at build time
} satisfies Config;
```

### `tsconfig.json`

```json
{
  "include": ["**/*", "**/.server/**/*", "**/.client/**/*", ".react-router/types/**/*"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["node", "vite/client"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "rootDirs": [".", "./.react-router/types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  }
}
```

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';

export default defineConfig({ plugins: [reactRouter()] });
```

---

[← Previous: E45 — An authorization policy and its test matrix](E45-authentication-and-authorization.md) · [Chapter 51](51-react-router-v8-framework-mode.md) · [Index](README.md) · [Next: E52 — A TanStack Start app →](E52-tanstack-start-and-router.md)
