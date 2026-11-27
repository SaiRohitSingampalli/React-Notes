# E56 — Angular 22: DI, signals, Signal Forms, SignalStore, and React interop

> Runnable code for [56 — Angular Architecture and Dependency Injection](56-angular-architecture-and-dependency-injection.md), [57 — Angular Signals, Reactivity and RxJS](57-angular-signals-reactivity-and-rxjs.md) and [59 — React vs Angular: An Architect's Comparison](59-react-vs-angular-architecture-comparison.md). 28 tests.

One Angular CLI workspace holds the Angular code from three chapters, because each Angular install is large:

- **56, architecture and DI**: the composition root, `@Service()` singletons, typed tokens and multi-providers for feature navigation, feature-scoped state, functional guards and interceptors (with their order tested), `injectAsync` for lazy services, the global error handler, and route-level injectors.
- **57, signals and RxJS**: `linkedSignal` filters, a debounced `httpResource` search, a Signal Forms form, RxJS at the edges, and an NgRx SignalStore.
- **59, React and Angular compared**: the Angular halves of the side-by-side examples, and a React component hosted in Angular (and an Angular element in React).

The specs run on Vitest through Angular's unit-test builder.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 56    # writes examples/56-angular-architecture-and-dependency-injection/
cd examples/56-angular-architecture-and-dependency-injection
npm ci
npm test
npm run typecheck
npm run build
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/app/features/invoices/invoice-detail.ts` | 56, "4.7 Lazy services with `injectAsync()`" |
| `src/app/features/invoices/invoices.routes.ts` | 56, "4.4 Scoping state to a feature" |
| `src/app/core/auth-session.ts` | 56, "4.2 Declaring services: `@Service()` and `@Injectable()`" |
| `src/app/core/app-config.ts` | 56, "4.3 Tokens, provider recipes and multi providers" |
| `src/app/features/invoices/invoices.nav.ts` | 56, "4.3 Tokens, provider recipes and multi providers" |
| `src/app/shell/shell.ts` | 56, "4.3 Tokens, provider recipes and multi providers" |
| `src/app/features/invoices/invoice-selection.ts` | 56, "4.4 Scoping state to a feature" |
| `src/app/core/guards.ts` | 56, "4.6 The injection context" |
| `src/app/core/http-interceptors.ts` | 56, "4.6 The injection context" |
| `src/app/core/error-handler.ts` | 56, "4.8 Initialisation and global error handling" |
| `src/app/reactivity/invoice-filters.ts` | 57, "1.1 `signal`, `computed`, `linkedSignal`, `effect`" |
| `src/app/reactivity/invoice-search.ts` | 57, "2.2 `httpResource`, chaining and debouncing" |
| `src/app/reactivity/create-invoice-form.ts` | 57, "3.1 Model, schema, template" |
| `src/app/reactivity/invoice-events.ts` | 57, "4.2 Interop at the edges" |
| `src/app/reactivity/invoice-store.ts` | 57, "5.2 A SignalStore for a feature" |
| `src/app/compare/invoice-summary.ts` | 59, "2. Reactivity: re-run and reconcile vs track and refresh" |
| `src/app/compare/invoice-count.ts` | 59, "3.2 DI vs imports and context" |
| `src/app/interop/react-island.ts` | 59, "9. Coexistence and migration" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/app/app.config.ts`

```ts
// app.config.ts: the composition root. Everything global is visible in one file
import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routerProviders } from './core/router-config';
import { APP_CONFIG } from './core/app-config';
import { AuthSession } from './core/auth-session';
import { ReportingErrorHandler } from './core/error-handler';
import { problemDetailsInterceptor, requestContextInterceptor, unauthorizedInterceptor } from './core/http-interceptors';
import { retryInterceptor } from './core/retry-interceptor';
import { INVOICE_NAV } from './features/invoices/invoices.nav';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    routerProviders,
    provideHttpClient(withInterceptors([          // requests run top to bottom, responses and errors bottom to top
      problemDetailsInterceptor,                  // outermost: sees the final error, hands components ApiError
      requestContextInterceptor,                  // runs once: every retry shares the request id
      unauthorizedInterceptor,                    // sees raw 401s after retries
      retryInterceptor,                           // innermost: a retry re-runs only the backend call
    ])),                                          // Fetch backend by default
    { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api', release: '2026.11.3' } },
    { provide: ErrorHandler, useClass: ReportingErrorHandler },
    provideAppInitializer(() => inject(AuthSession).restore()),     // bootstrap waits for the session
    INVOICE_NAV,
  ],
};
```

### `src/app/app.routes.ts`

```ts
import { Routes } from '@angular/router';
import { requirePermission } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'invoices' },
  { path: 'login', loadComponent: () => import('./core/login').then((m) => m.Login), title: 'Sign in' },
  {
    path: 'invoices',
    canMatch: [requirePermission('invoice:read')],  // navigation never loads the chunk without the permission
    loadChildren: () => import('./features/invoices/invoices.routes').then((m) => m.INVOICE_ROUTES),
    data: { preload: true, permission: 'invoice:read' }, // preloading ignores canMatch: the strategy checks this
  },
  { path: '**', loadComponent: () => import('./core/not-found').then((m) => m.NotFound), title: 'Not found' },
];
```

### `src/app/app.ts`

```ts
import { Component } from '@angular/core';
import { Shell } from './shell/shell';
import { SyntaxCheck } from './ui/syntax-check';
import { InvoiceSearch } from './reactivity/invoice-search';
import { CreateInvoiceForm } from './reactivity/create-invoice-form';

@Component({ selector: 'app-root', imports: [Shell, SyntaxCheck, InvoiceSearch, CreateInvoiceForm], template: `<app-shell /><app-syntax-check /><app-invoice-search /><app-create-invoice-form />` })
export class App {}
```

### `src/app/compare/invoice-count.ts`

```ts
// Angular: the dependency is injected; the seams for tests are providers and HttpTestingController
import { Component, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { Invoice, Status } from './invoice-summary';

@Component({
  selector: 'app-invoice-count',
  template: `
    @if (invoices.hasValue()) {
      <p>{{ invoices.value().length }} {{ status() }} invoices</p>
    } @else if (invoices.error()) {
      <p role="alert">Couldn't load invoices.</p>
    } @else {
      <p>Loading…</p>
    }
  `,
})
export class InvoiceCount {
  readonly status = input.required<Status>();
  readonly invoices = httpResource<Invoice[]>(() => ({ url: '/api/invoices', params: { status: this.status() } }));
}
```

### `src/app/compare/invoice-summary.ts`

```ts
// Angular: the class runs once; signals track who reads them, and only those bindings update
import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

export type Status = 'open' | 'paid' | 'void';
export interface Invoice { id: string; status: Status; amountCents: number }

@Component({
  selector: 'app-invoice-summary',
  imports: [CurrencyPipe],
  template: `
    <section>
      <select [value]="status()" (change)="onStatus($event)">
        <option value="open">Open</option>
        <option value="paid">Paid</option>
        <option value="void">Void</option>
      </select>
      <p>{{ visible().length }} invoices, {{ total() / 100 | currency: 'GBP' : 'symbol' : '1.2-2' : 'en-GB' }}</p>
    </section>
  `,
})
export class InvoiceSummary {
  readonly invoices = input.required<readonly Invoice[]>();
  readonly status = signal<Status>('open');
  readonly visible = computed(() => this.invoices().filter((i) => i.status === this.status()));
  readonly total = computed(() => this.visible().reduce((sum, i) => sum + i.amountCents, 0));

  onStatus(event: Event) {
    this.status.set((event.target as HTMLSelectElement).value as Status);
  }
}
```

### `src/app/core/app-config.ts`

```ts
// core/app-config.ts: typed configuration as an injection token, not a global import
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  release: string;
}
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// Features contribute navigation to the shell without the shell importing them (multi provider)
export interface NavItem { label: string; path: string; permission?: string }
export const NAV_ITEMS = new InjectionToken<readonly NavItem[]>('NAV_ITEMS');
```

### `src/app/core/auth-session.ts`

```ts
// core/auth-session.ts: a root singleton holding session state as signals
import { computed, inject, Service, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface SessionUser { id: string; name: string; tenantId: string; permissions: readonly string[] }

@Service()                                       // root-provided; inject() only, no constructor DI
export class AuthSession {
  private readonly http = inject(HttpClient);
  private readonly user = signal<SessionUser | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);

  can(permission: string): boolean {
    return this.user()?.permissions.includes(permission) ?? false;
  }

  /** Called once by an app initializer; the BFF answers from its HttpOnly session cookie. */
  async restore(): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.http.get<SessionUser>('/bff/session')));
    } catch {
      this.user.set(null);                       // anonymous is a valid state, not a crash
    }
  }

  clear(): void { this.user.set(null); }
}
```

### `src/app/core/error-handler.ts`

```ts
// core/error-handler.ts: one place where uncaught errors become telemetry
import { ErrorHandler, inject, Service } from '@angular/core';
import { APP_CONFIG } from './app-config';

@Service({ autoProvided: false })                 // provided explicitly as ErrorHandler in app.config
export class ReportingErrorHandler implements ErrorHandler {
  private readonly config = inject(APP_CONFIG);
  handleError(error: unknown): void {
    console.error(error);                          // keep the dev experience
    reportToTelemetry(error, { release: this.config.release });
  }
}
declare function reportToTelemetry(error: unknown, tags: Record<string, string>): void;
```

### `src/app/core/guards.ts`

```ts
// core/guards.ts: guards are UX; the API still authorises every request
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

export function requirePermission(permission: string): CanMatchFn {
  return (_route, segments) => {
    const session = inject(AuthSession);
    if (session.can(permission)) return true;
    const returnTo = '/' + segments.map((s) => s.path).join('/');
    return inject(Router).createUrlTree(['/login'], { queryParams: { returnTo } });
  };
}
```

### `src/app/core/http-interceptors.ts`

```ts
// core/http-interceptors.ts: functional interceptors, composed in order
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { APP_CONFIG } from './app-config';
import { AuthSession } from './auth-session';

export const requestContextInterceptor: HttpInterceptorFn = (req, next) => {
  const { release } = inject(APP_CONFIG);
  return next(req.clone({
    setHeaders: { 'X-Request-Id': crypto.randomUUID(), 'X-Client-Release': release },
  }));
};

export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(AuthSession);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/bff/session')) {
        session.clear();
        void router.navigate(['/login'], { queryParams: { returnTo: router.url } });
      }
      return throwError(() => err);
    }),
  );
};

/** RFC 9457 Problem Details: the one error shape components ever see. */
export interface ProblemDetails { type: string; title: string; status: number; detail?: string; instance?: string; [extension: string]: unknown }

export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(readonly problem: ProblemDetails) { super(problem.title); }
}

const isProblem = (body: unknown): body is ProblemDetails =>
  typeof body === 'object' && body !== null && typeof (body as ProblemDetails).title === 'string' && typeof (body as ProblemDetails).status === 'number';

/** Outermost interceptor: everything inside works with raw HttpErrorResponse; components get ApiError. */
export const problemDetailsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      const problem: ProblemDetails = isProblem(err.error)
        ? err.error
        : { type: 'about:blank', title: err.status === 0 ? 'Network error' : err.statusText || 'Request failed', status: err.status };
      return throwError(() => new ApiError(problem));
    }),
  );
```

### `src/app/core/login.ts`

```ts
import { Component, input } from '@angular/core';
@Component({ selector: 'app-login', template: `<h1>Sign in</h1><p>Returning to {{ returnTo() ?? '/' }}</p>` })
export class Login { readonly returnTo = input<string>(); }   // bound from ?returnTo= by withComponentInputBinding
```

### `src/app/core/not-found.ts`

```ts
import { Component } from '@angular/core';
@Component({ selector: 'app-not-found', template: `<h1>Page not found</h1>` })
export class NotFound {}
```

### `src/app/core/preloading.ts`

```ts
// core/preloading.ts: preload what users are likely to need, unless the network or their permissions say not to
import { inject, Service } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable, timer, switchMap } from 'rxjs';
import { AuthSession } from './auth-session';

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string };

@Service()
export class LikelyNextPreloading implements PreloadingStrategy {
  private readonly session = inject(AuthSession);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    const constrained = conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    if (constrained || route.data?.['preload'] !== true) return EMPTY;
    // The preloader ignores canMatch, so gated routes declare their permission and we check it here
    const permission = route.data?.['permission'] as string | undefined;
    if (route.canMatch?.length && (!permission || !this.session.can(permission))) return EMPTY;
    return timer(2_000).pipe(switchMap(load));    // after first paint has settled
  }
}
```

### `src/app/core/retry-interceptor.ts`

```ts
// core/retry-interceptor.ts: retries only what is safe to retry, with backoff; callers opt out via HttpContext
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

export const RETRY_ATTEMPTS = new HttpContextToken<number>(() => 2);
const RETRYABLE_STATUS = new Set([0, 429, 502, 503, 504]);       // network failure, throttled, gateway errors

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const idempotent = req.method === 'GET' || req.method === 'HEAD' || req.headers.has('Idempotency-Key');
  const attempts = req.context.get(RETRY_ATTEMPTS);
  if (!idempotent || attempts === 0) return next(req);
  return next(req).pipe(
    retry({
      count: attempts,
      delay: (err: unknown, n) => {
        if (!(err instanceof HttpErrorResponse) || !RETRYABLE_STATUS.has(err.status)) throw err;
        const retryAfter = Number(err.headers.get('Retry-After'));
        return timer(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 200 * 2 ** (n - 1));
      },
    }),
  );
};
```

### `src/app/core/router-config.ts`

```ts
// core/router-config.ts: router features for a large app, in one place
import { provideRouter, withAutoCleanupInjectors, withComponentInputBinding, withInMemoryScrolling, withPreloading, withViewTransitions } from '@angular/router';
import { routes } from '../app.routes';
import { LikelyNextPreloading } from './preloading';

export const routerProviders = provideRouter(
  routes,
  withComponentInputBinding(),                                   // params, query params and data as inputs
  withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
  withViewTransitions({ skipInitialTransition: true }),          // cross-fade between pages where supported
  withPreloading(LikelyNextPreloading),
  withAutoCleanupInjectors(),                                    // route-scoped services die with their route
);
```

### `src/app/features/invoices/invoice-api.ts`

```ts
// features/invoices/invoice-api.ts: the only place that knows invoice URLs
import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../core/app-config';
import { Invoice } from './invoice.model';
import type { InvoiceDraft } from '../../reactivity/create-invoice-form';

@Service()
export class InvoiceApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/invoices`;

  url(path = ''): string { return `${this.base}${path}`; }          // for httpResource in components

  create(draft: InvoiceDraft): Observable<Invoice> {
    return this.http.post<Invoice>(this.url(), draft);
  }

  void(id: string, reason: string): Observable<Invoice> {
    return this.http.post<Invoice>(this.url(`/${encodeURIComponent(id)}/void`), { reason });
  }
}
```

### `src/app/features/invoices/invoice-detail.ts`

```ts
// features/invoices/invoice-detail.ts: route params as required inputs, lazy service on demand (the chapter prints an excerpt)
import { httpResource } from '@angular/common/http';
import { Component, inject, injectAsync, input, onIdle } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../core/auth-session';
import { InvoiceApi } from './invoice-api';
import { Invoice } from './invoice.model';

@Component({
  selector: 'app-invoice-detail',
  template: `
    @if (invoice.hasValue()) {
      <h1>Invoice {{ invoice.value().number }}</h1>
      <p>Status: {{ invoice.value().status }}</p>
      <button type="button" (click)="download(invoice.value())">Download PDF</button>
      @if (canVoid()) {
        <button type="button" (click)="voidInvoice(invoice.value())">Void</button>
      }
    } @else if (invoice.error()) {
      <p role="alert">Couldn't load this invoice.</p>
    } @else {
      <p>Loading…</p>
    }
  `,
})
export class InvoiceDetail {
  readonly invoiceId = input.required<string>();     // from :invoiceId, via withComponentInputBinding()

  private readonly api = inject(InvoiceApi);
  private readonly session = inject(AuthSession);
  private readonly pdf = injectAsync(() => import('./pdf-exporter').then((m) => m.PdfExporter), { prefetch: onIdle });

  protected readonly invoice = httpResource<Invoice>(() => this.api.url(`/${encodeURIComponent(this.invoiceId())}`));

  protected canVoid(): boolean {
    return this.session.can('invoice:void') && this.invoice.value()?.status === 'open';
  }

  protected async download(inv: Invoice): Promise<void> {
    const blob = await (await this.pdf()).export(inv);   // chunk is usually prefetched by now
    window.open(URL.createObjectURL(blob));
  }

  protected async voidInvoice(inv: Invoice): Promise<void> {
    const updated = await firstValueFrom(this.api.void(inv.id, 'Duplicate'));
    this.invoice.set(updated);                           // local state now; the server already persisted it
  }
}
```

### `src/app/features/invoices/invoice-list.ts`

```ts
// features/invoices/invoice-list.ts: URL query params arrive as signal inputs
import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvoiceApi } from './invoice-api';
import { InvoicePage, InvoiceStatus } from './invoice.model';
import { InvoiceSelection } from './invoice-selection';

@Component({
  selector: 'app-invoice-list',
  imports: [RouterLink, CurrencyPipe],
  template: `
    <h1>Invoices</h1>
    <p aria-live="polite">{{ selection.count() }} selected</p>
    @if (invoices.error()) {
      <p role="alert">Couldn't load invoices. <button type="button" (click)="invoices.reload()">Retry</button></p>
    } @else {
      <ul [attr.aria-busy]="invoices.isLoading()">
        @for (inv of invoices.value()?.items ?? []; track inv.id) {
          <li>
            <input type="checkbox" [checked]="selection.has(inv.id)" (change)="selection.toggle(inv.id)"
                   [attr.aria-label]="'Select ' + inv.number" />
            <a [routerLink]="[inv.id]">{{ inv.number }}</a>
            {{ inv.customer }} · {{ inv.totalMinor / 100 | currency: inv.currency }}
          </li>
        } @empty {
          <li>No invoices match.</li>
        }
      </ul>
    }
  `,
})
export class InvoiceList {
  readonly status = input<InvoiceStatus>();          // ?status=open
  readonly page = input(1, { transform: (v: string | number | undefined) => Number(v ?? 1) || 1 });

  protected readonly selection = inject(InvoiceSelection);
  private readonly api = inject(InvoiceApi);
  private readonly query = computed(() => ({ status: this.status(), page: this.page() }));

  protected readonly invoices = httpResource<InvoicePage>(() => ({
    url: this.api.url(),
    params: { page: this.query().page, ...(this.query().status ? { status: this.query().status! } : {}) },
  }));
}
```

### `src/app/features/invoices/invoice-selection.ts`

```ts
// features/invoices/invoice-selection.ts: state scoped to the invoices section, not the whole app
import { computed, Service, signal } from '@angular/core';

@Service({ autoProvided: false })                // must be provided: here, by the feature's route
export class InvoiceSelection {
  private readonly ids = signal<ReadonlySet<string>>(new Set());
  readonly count = computed(() => this.ids().size);
  has(id: string) { return this.ids().has(id); }
  toggle(id: string) {
    this.ids.update((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  }
  clear() { this.ids.set(new Set()); }
}
```

### `src/app/features/invoices/invoice.model.ts`

```ts
export type InvoiceStatus = 'open' | 'paid' | 'void';
export interface Invoice { id: string; number: string; customer: string; status: InvoiceStatus; totalMinor: number; currency: string }
export interface InvoicePage { total: number; items: Invoice[] }
```

### `src/app/features/invoices/invoices.nav.ts`

```ts
// features/invoices/invoices.nav.ts: the feature's eager contribution, kept apart from its lazy code
import { Provider } from '@angular/core';
import { NAV_ITEMS } from '../../core/app-config';

export const INVOICE_NAV: Provider = {
  provide: NAV_ITEMS,
  multi: true,
  useValue: [{ label: 'Invoices', path: '/invoices', permission: 'invoice:read' }],
};
```

### `src/app/features/invoices/invoices.routes.ts`

```ts
// features/invoices/invoices.routes.ts: a lazy feature with its own environment injector
import { Routes } from '@angular/router';
import { InvoiceSelection } from './invoice-selection';

export const INVOICE_ROUTES: Routes = [
  {
    path: '',
    providers: [InvoiceSelection],                  // one instance for the whole section
    children: [
      { path: '', loadComponent: () => import('./invoice-list').then((m) => m.InvoiceList), title: 'Invoices' },
      { path: ':invoiceId', loadComponent: () => import('./invoice-detail').then((m) => m.InvoiceDetail), title: 'Invoice' },
    ],
  },
];
```

### `src/app/features/invoices/pdf-exporter.ts`

```ts
// features/invoices/pdf-exporter.ts: heavy and rarely used, so loaded on demand with injectAsync
import { Service } from '@angular/core';
import { Invoice } from './invoice.model';

@Service()                                         // injectAsync requires an auto-provided service
export class PdfExporter {
  async export(invoice: Invoice): Promise<Blob> {
    return new Blob([`Invoice ${invoice.number}`], { type: 'application/pdf' });   // stand-in for a PDF library
  }
}
```

### `src/app/interop/react-island.ts`

```ts
// interop/react-island.ts: host a React component inside an Angular template
import { afterRenderEffect, Component, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';

@Component({ selector: 'app-react-island', template: '' })
export class ReactIsland<P extends object> {
  readonly component = input.required<ComponentType<P>>();
  readonly props = input.required<P>();
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private root: Root | undefined;

  constructor() {
    afterRenderEffect(() => {                      // browser only; re-runs when either input changes
      this.root ??= createRoot(this.host);
      this.root.render(createElement(this.component(), this.props()));
    });
    inject(DestroyRef).onDestroy(() => this.root?.unmount());
  }
}
```

### `src/app/reactivity/create-invoice-form.ts`

```ts
// reactivity/create-invoice-form.ts: Signal Forms. The model is a signal; the schema is code
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  applyEach, applyWhen, email, form, FormField, FormRoot, hidden, maxLength, min, minDate, required, validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { InvoiceApi } from '../features/invoices/invoice-api';

export interface InvoiceLine { description: string; quantity: number; unitPriceMinor: number }
export interface InvoiceDraft {
  customer: { name: string; email: string; type: 'smb' | 'enterprise'; poNumber: string };
  dueDate: Date;
  lines: InvoiceLine[];
  notes: string;
}

export const emptyDraft = (): InvoiceDraft => ({
  customer: { name: '', email: '', type: 'smb', poNumber: '' },
  dueDate: new Date(Date.now() + 30 * 864e5),
  lines: [{ description: '', quantity: 1, unitPriceMinor: 0 }],
  notes: '',
});

export function createInvoiceForm(model = signal(emptyDraft()), api = inject(InvoiceApi)) {
  return form(model, (p) => {
    required(p.customer.name, { message: 'Customer name is required' });
    required(p.customer.email, { message: 'Billing email is required' });
    email(p.customer.email, { message: 'Enter a valid email address' });
    hidden(p.customer.poNumber, { when: ({ valueOf }) => valueOf(p.customer.type) !== 'enterprise' });
    applyWhen(p.customer, ({ value }) => value().type === 'enterprise', (c) => {
      required(c.poNumber, { message: 'Enterprise customers need a PO number' });
    });
    minDate(p.dueDate, () => startOfToday(), { message: 'The due date cannot be in the past' });
    validate(p.lines, ({ value }) => (value().length === 0 ? { kind: 'noLines', message: 'Add at least one line' } : undefined));
    applyEach(p.lines, (line) => {
      required(line.description, { message: 'Describe the line item' });
      min(line.quantity, 1, { message: 'Quantity must be at least 1' });
      min(line.unitPriceMinor, 0);
    });
    maxLength(p.notes, 500);
  }, {
    submission: {
      action: async (f) => {
        try {
          await firstValueFrom(api.create(f().value()));
          return undefined;                                       // success: no errors
        } catch (e) {
          if (e instanceof HttpErrorResponse && e.status === 409) {
            return { fieldTree: f.customer.poNumber, kind: 'duplicate', message: 'This PO number was already invoiced' };
          }
          throw e;                                                // unexpected: let the error handler see it
        }
      },
    },
  });
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

@Component({
  selector: 'app-create-invoice-form',
  imports: [FormField, FormRoot],
  template: `
    <form [formRoot]="invoiceForm" novalidate>
      <label for="name">Customer</label>
      <input id="name" [formField]="invoiceForm.customer.name" />
      @for (e of invoiceForm.customer.name().errors(); track e.kind) { <p class="error">{{ e.message }}</p> }

      <label for="email">Billing email</label>
      <input id="email" type="email" [formField]="invoiceForm.customer.email" />

      <label for="type">Customer type</label>
      <select id="type" [formField]="invoiceForm.customer.type">
        <option value="smb">Small business</option><option value="enterprise">Enterprise</option>
      </select>

      @if (!invoiceForm.customer.poNumber().hidden()) {
        <label for="po">PO number</label>
        <input id="po" [formField]="invoiceForm.customer.poNumber" />
      }

      @for (line of invoiceForm.lines; track $index) {
        <fieldset>
          <legend>Line {{ $index + 1 }}</legend>
          <input aria-label="Description" [formField]="line.description" />
          <input aria-label="Quantity" type="number" [formField]="line.quantity" />
        </fieldset>
      }
      <button type="button" (click)="addLine()">Add line</button>
      <button type="submit" [disabled]="invoiceForm().submitting()">Create invoice</button>
    </form>
  `,
})
export class CreateInvoiceForm {
  private readonly model = signal(emptyDraft());
  protected readonly invoiceForm = createInvoiceForm(this.model);

  protected addLine() {
    this.model.update((m) => ({ ...m, lines: [...m.lines, { description: '', quantity: 1, unitPriceMinor: 0 }] }));
  }
}
```

### `src/app/reactivity/invoice-events.ts`

```ts
// reactivity/invoice-events.ts: events over time stay RxJS; the latest state becomes a signal at the edge
import { computed, inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { retry, scan, share, timer } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { APP_CONFIG } from '../core/app-config';

export type InvoiceEvent = { type: 'invoice.paid' | 'invoice.voided'; invoiceId: string; at: string };

@Service()
export class InvoiceEvents {
  private readonly url = inject(APP_CONFIG).apiBaseUrl.replace(/^http/, 'ws') + '/events';

  readonly events$ = webSocket<InvoiceEvent>(this.url).pipe(
    retry({ delay: (_err, attempt) => timer(Math.min(1000 * 2 ** attempt, 30_000) + Math.random() * 500) }), // backoff + jitter
    share(),                                               // one socket, however many subscribers
  );

  /** The 20 most recent events, as a signal for templates. Subscribes for the app's lifetime. */
  readonly recent = toSignal(
    this.events$.pipe(scan((acc, e) => [e, ...acc].slice(0, 20), [] as InvoiceEvent[])),
    { initialValue: [] },
  );
  readonly unreadCount = computed(() => this.recent().length);
}
```

### `src/app/reactivity/invoice-filters.ts`

```ts
// reactivity/invoice-filters.ts: synchronous state as signals; derived state as computed; resets as linkedSignal
import { computed, effect, linkedSignal, Service, signal } from '@angular/core';
import { InvoiceStatus } from '../features/invoices/invoice.model';

export type StatusFilter = InvoiceStatus | 'all';

@Service({ autoProvided: false })
export class InvoiceFilters {
  readonly status = signal<StatusFilter>(readSaved()?.status ?? 'all');
  readonly query = signal('');

  // Writable, but resets to 1 whenever status or query change
  readonly page = linkedSignal({ source: () => [this.status(), this.query()] as const, computation: () => 1 });

  readonly params = computed(() => ({ status: this.status(), q: this.query().trim(), page: this.page() }));
  readonly isFiltered = computed(() => this.status() !== 'all' || this.params().q !== '');

  // An effect syncs signal state to a non-signal API (storage). It never derives state.
  private readonly persist = effect(() => {
    try { localStorage.setItem('invoice-filters', JSON.stringify({ status: this.status() })); } catch { /* private mode */ }
  });

  reset() { this.status.set('all'); this.query.set(''); }
}

function readSaved(): { status: StatusFilter } | null {
  try { return JSON.parse(localStorage.getItem('invoice-filters') ?? 'null'); } catch { return null; }
}
```

### `src/app/reactivity/invoice-search.ts`

```ts
// reactivity/invoice-search.ts: debounced input → chained HTTP resource; no subscriptions to manage
import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, debounced, inject } from '@angular/core';
import { InvoiceApi } from '../features/invoices/invoice-api';
import { InvoicePage } from '../features/invoices/invoice.model';
import { InvoiceFilters, StatusFilter } from './invoice-filters';

@Component({
  selector: 'app-invoice-search',
  imports: [CurrencyPipe],
  providers: [InvoiceFilters],
  template: `
    <label for="q">Search</label>
    <input id="q" type="search" [value]="filters.query()" (input)="filters.query.set($any($event.target).value)" />
    <select aria-label="Status" [value]="filters.status()" (change)="filters.status.set($any($event.target).value)">
      <option value="all">All</option><option value="open">Open</option><option value="paid">Paid</option><option value="void">Void</option>
    </select>

    @switch (results.status()) {
      @case ('error') { <p role="alert">Search failed. <button type="button" (click)="results.reload()">Retry</button></p> }
      @default {
        <p aria-live="polite">{{ results.isLoading() ? 'Searching…' : (results.value()?.total ?? 0) + ' results' }}</p>
        <ul [attr.aria-busy]="results.isLoading()">
          @for (inv of results.value()?.items ?? []; track inv.id) {
            <li>{{ inv.number }} · {{ inv.customer }} · {{ inv.totalMinor / 100 | currency: inv.currency }}</li>
          }
        </ul>
        <button type="button" (click)="filters.page.set(filters.page() + 1)">Next page</button>
      }
    }
  `,
})
export class InvoiceSearch {
  protected readonly filters = inject(InvoiceFilters);
  private readonly api = inject(InvoiceApi);

  // Experimental (22.0): a Resource that settles 300 ms after the last keystroke
  private readonly settledQuery = debounced(() => this.filters.params().q, 300);

  protected readonly results = httpResource<InvoicePage>(({ chain }) => ({
    url: this.api.url(),
    params: {
      q: chain(this.settledQuery),             // while the debounce is pending, this resource is 'loading'
      page: this.filters.page(),
      ...statusParam(this.filters.status()),
    },
  }), { defaultValue: { total: 0, items: [] } });
}

function statusParam(s: StatusFilter): Record<string, string> { return s === 'all' ? {} : { status: s }; }
```

### `src/app/reactivity/invoice-store.ts`

```ts
// reactivity/invoice-store.ts: NgRx SignalStore for a feature with real state transitions
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { InvoiceApi } from '../features/invoices/invoice-api';
import { Invoice, InvoicePage, InvoiceStatus } from '../features/invoices/invoice.model';

type LoadState = 'idle' | 'loading' | 'loaded' | { error: string };

export const InvoiceStore = signalStore(
  withEntities<Invoice>(),
  withState({ status: 'all' as InvoiceStatus | 'all', load: 'idle' as LoadState }),
  withComputed(({ entities, status }) => ({
    visible: computed(() => (status() === 'all' ? entities() : entities().filter((i) => i.status === status()))),
    openTotalMinor: computed(() => entities().filter((i) => i.status === 'open').reduce((s, i) => s + i.totalMinor, 0)),
  })),
  withMethods((store, http = inject(HttpClient), api = inject(InvoiceApi)) => ({
    setStatus(status: InvoiceStatus | 'all') { patchState(store, { status }); },
    // rxMethod: switchMap cancels the previous request when the trigger fires again
    loadPage: rxMethod<number>(pipe(
      tap(() => patchState(store, { load: 'loading' })),
      switchMap((page) => http.get<InvoicePage>(api.url(), { params: { page } }).pipe(
        tap({
          next: (res) => patchState(store, setAllEntities(res.items), { load: 'loaded' }),
          error: (e: unknown) => patchState(store, { load: { error: String(e) } }),
        }),
      )),
    )),
    async voidInvoice(id: string, reason: string) {
      const before = store.entityMap()[id];
      patchState(store, updateEntity({ id, changes: { status: 'void' } }));       // optimistic
      try {
        const saved = await firstValueFrom(api.void(id, reason));
        patchState(store, updateEntity({ id, changes: saved }));
      } catch (e) {
        if (before) patchState(store, updateEntity({ id, changes: { status: before.status } })); // roll back
        throw e;
      }
    },
  })),
  withHooks({ onInit(store) { store.loadPage(1); } }),
);
```

### `src/app/shell/shell.ts`

```ts
// shell/shell.ts: renders navigation contributed by features, filtered by permission
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '../core/app-config';
import { AuthSession } from '../core/auth-session';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Main">
      @for (item of visibleNav(); track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ item.label }}</a>
      }
    </nav>
    <main id="main"><router-outlet /></main>
  `,
})
export class Shell {
  private readonly session = inject(AuthSession);
  private readonly nav = inject(NAV_ITEMS).flat();      // multi provider: an array of contributions
  protected readonly visibleNav = computed(() =>
    this.nav.filter((i) => !i.permission || this.session.can(i.permission)));
}
```

### `src/app/ui/report-tabs.ts`

```ts
// ui/report-tabs.ts: Angular Aria supplies roles, keyboard handling and focus; the design system supplies markup and CSS
import { Component, model } from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';

@Component({
  selector: 'app-report-tabs',
  imports: [Tabs, TabList, Tab, TabPanel, TabContent],
  template: `
    <div ngTabs>
      <div ngTabList aria-label="Report period" selectionMode="follow" [(selectedTab)]="period">
        <button ngTab value="month" type="button">This month</button>
        <button ngTab value="quarter" type="button">Quarter</button>
        <button ngTab value="year" type="button">Year</button>
      </div>
      <div ngTabPanel value="month"><ng-template ngTabContent><p>Month report</p></ng-template></div>
      <div ngTabPanel value="quarter"><ng-template ngTabContent><p>Quarter report</p></ng-template></div>
      <div ngTabPanel value="year"><ng-template ngTabContent><p>Year report</p></ng-template></div>
    </div>
  `,
  styles: `[ngTab][aria-selected='true'] { border-bottom: 2px solid currentColor; }`,
})
export class ReportTabs {
  readonly period = model<string | undefined>('month');
}
```

### `src/app/ui/syntax-check.ts`

```ts
import { Component, ElementRef, model, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-toggle',
  host: { role: 'switch', '[attr.aria-checked]': 'checked()', '(click)': 'checked.set(!checked())', tabindex: '0' },
  template: `<ng-content />`,
})
export class Toggle { readonly checked = model(false); }

@Component({
  selector: 'app-syntax-check',
  imports: [Toggle],
  template: `
    @let total = items().length;
    <p #summary>{{ total }} items</p>
    <app-toggle [(checked)]="compact">Compact rows</app-toggle>
    @if (show()) { <div animate.enter="fade-in" animate.leave="fade-out">Hello</div> }
    @defer (on idle(500); prefetch on hover) {
      <p>Heavy chart</p>
    } @placeholder (minimum 200ms) {
      <p>Chart placeholder</p>
    } @loading (after 100ms; minimum 300ms) {
      <p>Loading chart…</p>
    } @error {
      <p>Chart failed to load.</p>
    }
    @boundary {
      <p>{{ risky() }}</p>
    } @error (let e = $error, retry = $reset; when isTimeout(e)) {
      <p role="alert">The chart timed out. <button type="button" (click)="retry()">Try again</button></p>
    } @error {
      <p role="alert">This section failed to render.</p>
    }
    @switch (mode()) {
      @case ('a') { <span>A</span> }
      @default { <span>Other</span> }
    }
  `,
})
export class SyntaxCheck {
  readonly items = signal([1, 2, 3]);
  readonly compact = signal(false);
  readonly show = signal(true);
  readonly mode = signal<'a' | 'b'>('a');
  private readonly summary = viewChild.required<ElementRef<HTMLParagraphElement>>('summary');
  risky(): string { throw new Error('x'); }
  isTimeout(e: unknown) { return e instanceof Error && e.name === 'TimeoutError'; }
  width() { return this.summary().nativeElement.offsetWidth; }
}
```

### `src/index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Acme</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

### `src/main.ts`

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

### `src/styles.css`

```css
/* You can add global styles to this file, and also import other style files */
```

### `src/app/compare/compare.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InvoiceSummary, type Invoice } from './invoice-summary';
import { InvoiceCount } from './invoice-count';

const invoices: Invoice[] = [
  { id: 'INV-1', status: 'open', amountCents: 12_000 },
  { id: 'INV-2', status: 'open', amountCents: 3_050 },
  { id: 'INV-3', status: 'paid', amountCents: 99_900 },
];

describe('side-by-side examples (Angular)', () => {
  it('InvoiceSummary derives the visible list and total from signals', async () => {
    const fixture = TestBed.createComponent(InvoiceSummary);
    fixture.componentRef.setInput('invoices', invoices);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('p')?.textContent?.trim()).toBe('2 invoices, £150.50');
    const select = el.querySelector('select')!;
    select.value = 'paid';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(el.querySelector('p')?.textContent?.trim()).toBe('1 invoices, £999.00');
  });

  it('InvoiceCount loads with httpResource and refetches when its input changes', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(InvoiceCount);
    const ctl = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('status', 'open');
    TestBed.tick();                                               // runs the resource's request effect
    expect(fixture.nativeElement.textContent.trim()).toBe('Loading…');
    ctl.expectOne('/api/invoices?status=open').flush(invoices.slice(0, 2));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('2 open invoices');
    fixture.componentRef.setInput('status', 'paid');
    TestBed.tick();
    ctl.expectOne('/api/invoices?status=paid').flush(invoices.slice(2));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('1 paid invoices');
  });
});
```

### `src/app/core/core.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree, type Route, type UrlSegment } from '@angular/router';
import { APP_CONFIG } from './app-config';
import { AuthSession } from './auth-session';
import { requestContextInterceptor } from './http-interceptors';
import { requirePermission } from './guards';
import { InvoiceSelection } from '../features/invoices/invoice-selection';

describe('DI architecture', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([requestContextInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api', release: 'test-1' } },
      ],
    });
  });

  it('keeps route-scoped services out of the root injector', () => {
    expect(() => TestBed.inject(InvoiceSelection)).toThrow(/No provider/);
  });

  it('adds request context headers in the interceptor', () => {
    TestBed.inject(HttpClient).get('/api/ping').subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/ping');
    expect(req.request.headers.get('X-Client-Release')).toBe('test-1');
    expect(req.request.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({});
  });

  it('redirects to login when the permission is missing', () => {
    const guard = requirePermission('invoice:read');
    const result = TestBed.runInInjectionContext(() => guard({} as Route, [{ path: 'invoices' } as UrlSegment], {} as never));
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnTo=%2Finvoices');
  });

  it('restores the session from the BFF and treats failure as anonymous', async () => {
    const session = TestBed.inject(AuthSession);
    const done = session.restore();
    TestBed.inject(HttpTestingController).expectOne('/bff/session').flush('nope', { status: 401, statusText: 'Unauthorized' });
    await done;
    expect(session.isAuthenticated()).toBe(false);
  });
});
```

### `src/app/core/interceptor-order.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { defer, firstValueFrom } from 'rxjs';
import { APP_CONFIG } from './app-config';
import { ApiError, problemDetailsInterceptor, requestContextInterceptor } from './http-interceptors';
import { retryInterceptor } from './retry-interceptor';

function setup(interceptors: HttpInterceptorFn[]) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors(interceptors)),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api', release: 'test-1' } },
    ],
  });
  return { http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
}

describe('interceptor order', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a retry re-subscribes downstream: interceptor bodies run once, deferred work runs per attempt', async () => {
    const calls: string[] = [];
    const once: HttpInterceptorFn = (req, next) => { calls.push('body'); return next(req); };
    const perAttempt: HttpInterceptorFn = (req, next) => defer(() => { calls.push('deferred'); return next(req); });
    const { http, ctl } = setup([requestContextInterceptor, retryInterceptor, once, perAttempt]);
    const result = firstValueFrom(http.get('/api/report'));
    const first = ctl.expectOne('/api/report');
    first.flush('busy', { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(200);
    const second = ctl.expectOne('/api/report');
    expect(second.request.headers.get('X-Request-Id')).toBe(first.request.headers.get('X-Request-Id'));
    second.flush({ ok: true });
    await result;
    expect(calls).toEqual(['body', 'deferred', 'deferred']);
  });

  it('error mapping outside retry: transient failures are retried, components get ApiError', async () => {
    const { http, ctl } = setup([problemDetailsInterceptor, retryInterceptor]);
    const result = firstValueFrom(http.get('/api/report'));
    for (const delay of [200, 400]) {
      ctl.expectOne('/api/report').flush('busy', { status: 503, statusText: 'Unavailable' });
      await vi.advanceTimersByTimeAsync(delay);
    }
    ctl.expectOne('/api/report').flush(
      { type: 'https://acme.example/problems/maintenance', title: 'Down for maintenance', status: 503 },
      { status: 503, statusText: 'Unavailable' },
    );
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem.title).toBe('Down for maintenance');
  });

  it('error mapping inside retry silently disables retries', async () => {
    const { http, ctl } = setup([retryInterceptor, problemDetailsInterceptor]);
    const result = firstValueFrom(http.get('/api/report'));
    ctl.expectOne('/api/report').flush('busy', { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(1_000);
    ctl.verify();                                  // no second attempt was made
  });
});
```

### `src/app/core/preloading.spec.ts`

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PreloadAllModules, PreloadingStrategy, provideRouter, Router, RouterPreloader, Routes, withPreloading } from '@angular/router';
import { Type } from '@angular/core';
import { AuthSession } from './auth-session';
import { requirePermission } from './guards';
import { LikelyNextPreloading } from './preloading';

@Component({ template: '' })
class Home {}

describe('preloading and canMatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function start(strategy: Type<PreloadingStrategy>, permissions: string[]) {
    const loader = vi.fn(async (): Promise<Routes> => []);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Home },
          { path: 'invoices', canMatch: [requirePermission('invoice:read')], data: { preload: true, permission: 'invoice:read' }, loadChildren: loader },
        ], withPreloading(strategy)),
        { provide: AuthSession, useValue: { can: (p: string) => permissions.includes(p) } },
      ],
    });
    TestBed.inject(RouterPreloader).setUpPreloading();   // done by the bootstrap listener in a real app
    await TestBed.inject(Router).navigateByUrl('/');
    return loader;
  }

  it('PreloadAllModules downloads a gated feature even for a user the guard would refuse', async () => {
    const loader = await start(PreloadAllModules, []);
    await vi.advanceTimersByTimeAsync(0);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('LikelyNextPreloading skips gated features the user cannot open', async () => {
    const loader = await start(LikelyNextPreloading, []);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(loader).not.toHaveBeenCalled();
  });

  it('LikelyNextPreloading preloads them for users who can, after first paint settles', async () => {
    const loader = await start(LikelyNextPreloading, ['invoice:read']);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(loader).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
```

### `src/app/core/retry-interceptor.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { RETRY_ATTEMPTS, retryInterceptor } from './retry-interceptor';

describe('retryInterceptor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([retryInterceptor])), provideHttpClientTesting()] });
  });
  afterEach(() => vi.useRealTimers());

  it('retries a GET on 503 with backoff, then succeeds', async () => {
    const http = TestBed.inject(HttpClient), ctl = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(http.get<{ ok: boolean }>('/api/report'));
    ctl.expectOne('/api/report').flush('busy', { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(200);
    ctl.expectOne('/api/report').flush({ ok: true });
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('never retries a POST without an idempotency key', async () => {
    const http = TestBed.inject(HttpClient), ctl = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(http.post('/api/invoices', {}));
    ctl.expectOne('/api/invoices').flush('busy', { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toMatchObject({ status: 503 });
    ctl.verify();
  });

  it('lets a caller opt out through HttpContext', async () => {
    const http = TestBed.inject(HttpClient), ctl = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(http.get('/api/live', { context: new HttpContext().set(RETRY_ATTEMPTS, 0) }));
    ctl.expectOne('/api/live').flush('busy', { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toMatchObject({ status: 503 });
  });

  it('does not retry client errors', async () => {
    const http = TestBed.inject(HttpClient), ctl = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(http.get('/api/missing'));
    ctl.expectOne('/api/missing').flush('nope', { status: 404, statusText: 'Not Found' });
    await expect(result).rejects.toMatchObject({ status: 404 });
    ctl.verify();
  });
});
```

### `src/app/core/route-injector.spec.ts`

```ts
import { Component, inject, Service } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes, withAutoCleanupInjectors } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

@Service({ autoProvided: false })
class SectionState { static created = 0; readonly id = ++SectionState.created; }

@Component({ template: 'a' }) class PageA { readonly state = inject(SectionState); }
@Component({ template: 'b' }) class PageB {}

const routes: Routes = [
  { path: 'a', providers: [SectionState], component: PageA },
  { path: 'b', component: PageB },
];

async function visitAwayAndBack(features: ReturnType<typeof withAutoCleanupInjectors>[]) {
  SectionState.created = 0;
  TestBed.configureTestingModule({ providers: [provideRouter(routes, ...features)] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/a', PageA);
  await harness.navigateByUrl('/b', PageB);
  const back = await harness.navigateByUrl('/a', PageA);
  return { created: SectionState.created, idSeenOnReturn: back.state.id };
}

describe('route injector lifetime', () => {
  it('keeps the route injector by default', async () => {
    expect(await visitAwayAndBack([])).toEqual({ created: 1, idSeenOnReturn: 1 });
  });
  it('destroys unused route injectors with withAutoCleanupInjectors()', async () => {
    expect(await visitAwayAndBack([withAutoCleanupInjectors()])).toEqual({ created: 2, idSeenOnReturn: 2 });
  });
});
```

### `src/app/interop/angular-element.spec.ts`

```ts
import { Component, Injector, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createCustomElement } from '@angular/elements';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// An Angular component the React app keeps using during a migration
@Component({
  selector: 'acme-approval-badge',
  template: `<button type="button" (click)="approve.emit(count() + 1)">{{ label() }} ({{ count() }})</button>`,
})
class ApprovalBadge {
  readonly label = input('Approve');
  readonly count = input(0);
  readonly approve = output<number>();
}

describe('Angular element inside React', () => {
  it('takes properties from React and reports outputs as DOM events', async () => {
    customElements.define('acme-approval-badge', createCustomElement(ApprovalBadge, { injector: TestBed.inject(Injector) }));
    const container = document.body.appendChild(document.createElement('div'));
    const seen: number[] = [];
    const root = createRoot(container);
    const render = (count: number) =>
      root.render(createElement('acme-approval-badge', { label: 'Sign off', count, onapprove: (e: CustomEvent<number>) => seen.push(e.detail) }));

    await act(async () => render(2));
    await new Promise((r) => setTimeout(r, 0));                 // Angular renders the element asynchronously
    const element = container.querySelector('acme-approval-badge') as HTMLElement & { count: number };
    expect(element.count).toBe(2);                              // React 19 set a property, not an attribute
    expect(element.getAttribute('count')).toBeNull();
    expect(container.querySelector('button')?.textContent).toBe('Sign off (2)');

    container.querySelector('button')!.click();
    expect(seen).toEqual([3]);                                    // output -> CustomEvent 'approve' -> onapprove

    await act(async () => render(5));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('button')?.textContent).toBe('Sign off (5)');
    await act(async () => root.unmount());
  });
});
```

### `src/app/interop/react-island.spec.ts`

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { act, createElement, useState } from 'react';
import { ReactIsland } from './react-island';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A React component as a React team would ship it (written without JSX so the Angular test build needs no JSX setup)
function ApprovalCounter({ label, onApprove }: { label: string; onApprove: (count: number) => void }) {
  const [count, setCount] = useState(0);
  return createElement('button', { type: 'button', onClick: () => { setCount(count + 1); onApprove(count + 1); } }, `${label}: ${count}`);
}

@Component({
  imports: [ReactIsland],
  template: `@if (show()) { <app-react-island [component]="ApprovalCounter" [props]="{ label: label(), onApprove: approved }" /> }`,
})
class Host {
  readonly ApprovalCounter = ApprovalCounter;
  readonly show = signal(true);
  readonly label = signal('Approvals');
  readonly approvals = signal<number[]>([]);
  readonly approved = (count: number) => this.approvals.update((a) => [...a, count]);
}

describe('ReactIsland', () => {
  it('mounts a React component, passes props both ways, and unmounts it with the Angular view', async () => {
    const fixture = TestBed.createComponent(Host);
    const el: HTMLElement = fixture.nativeElement;
    await act(async () => { await fixture.whenStable(); });
    expect(el.querySelector('button')?.textContent).toBe('Approvals: 0');

    await act(async () => el.querySelector('button')!.click());
    expect(el.querySelector('button')?.textContent).toBe('Approvals: 1');
    expect(fixture.componentInstance.approvals()).toEqual([1]);          // React to Angular through a callback prop

    fixture.componentInstance.label.set('Reviews');
    await act(async () => { await fixture.whenStable(); });
    expect(el.querySelector('button')?.textContent).toBe('Reviews: 1'); // Angular to React; React state survives

    fixture.componentInstance.show.set(false);
    await act(async () => { await fixture.whenStable(); });
    expect(el.querySelector('button')).toBeNull();                      // the React root unmounted with the view
  });
});
```

### `src/app/reactivity/reactivity.spec.ts`

```ts
import { ApplicationRef, debounced, Injector, resource, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { submit } from '@angular/forms/signals';
import { APP_CONFIG } from '../core/app-config';
import { InvoiceFilters } from './invoice-filters';
import { createInvoiceForm, emptyDraft } from './create-invoice-form';
import { InvoiceStore } from './invoice-store';

const settle = async () => { await TestBed.inject(ApplicationRef).whenStable(); };

describe('reactivity', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InvoiceFilters, InvoiceStore,
        provideHttpClient(), provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api', release: 't' } },
      ],
    });
  });

  it('linkedSignal: page is writable but resets when the filters change', () => {
    const f = TestBed.inject(InvoiceFilters);
    f.page.set(3);
    expect(f.params().page).toBe(3);
    f.status.set('open');
    expect(f.page()).toBe(1);
  });

  it('resource: aborts the in-flight load when params change, then resolves', async () => {
    const id = signal('a');
    const signals: AbortSignal[] = [];
    const r = resource({
      params: () => ({ id: id() }),
      loader: ({ params, abortSignal }) => {
        signals.push(abortSignal);
        return new Promise<string>((res) => setTimeout(() => res(`value-${params.id}`), 20));
      },
      injector: TestBed.inject(Injector),
    });
    TestBed.tick();
    expect(r.status()).toBe('loading');
    id.set('b');
    TestBed.tick();
    expect(signals[0].aborted).toBe(true);
    await new Promise((res) => setTimeout(res, 40));
    expect(r.status()).toBe('resolved');
    expect(r.value()).toBe('value-b');
    r.set('edited');
    expect(r.status()).toBe('local');
  });

  it('chain: a dependent resource stays loading until its dependency resolves', async () => {
    const injector = TestBed.inject(Injector);
    const user = resource({ loader: () => new Promise<{ tenant: string }>((res) => setTimeout(() => res({ tenant: 't1' }), 20)), injector });
    const invoices = resource({
      params: ({ chain }) => ({ tenant: chain(user)!.tenant }),   // typed T | undefined: no defaultValue
      loader: async ({ params }) => [`inv-of-${params.tenant}`],
      injector,
    });
    TestBed.tick();
    expect(invoices.status()).toBe('loading');
    await new Promise((res) => setTimeout(res, 40));
    TestBed.tick();
    await settle();
    expect(invoices.value()).toEqual(['inv-of-t1']);
  });

  it('debounced: settles only after the quiet period', async () => {
    const q = signal('a');
    const d = debounced(() => q(), 30, { injector: TestBed.inject(Injector) });
    TestBed.tick();
    q.set('ab'); TestBed.tick();
    expect(d.status()).toBe('loading');
    await new Promise((res) => setTimeout(res, 60));
    TestBed.tick();
    expect(d.value()).toBe('ab');
  });

  it('signal forms: invalid drafts never reach the API; enterprise needs a PO number', async () => {
    const draft = signal(emptyDraft());
    const f = TestBed.runInInjectionContext(() => createInvoiceForm(draft));
    expect(f().valid()).toBe(false);
    expect(await submit(f)).toBe(false);
    TestBed.inject(HttpTestingController).expectNone('/api/invoices');

    draft.update((d) => ({ ...d, customer: { name: 'Acme', email: 'ap@acme.test', type: 'enterprise', poNumber: '' },
      lines: [{ description: 'Consulting', quantity: 2, unitPriceMinor: 50000 }] }));
    expect(f.customer.poNumber().hidden()).toBe(false);
    expect(f.customer.poNumber().errors().map((e) => e.kind)).toEqual(['required']);
  });

  it('signal forms: a 409 from the server becomes an error on the PO field', async () => {
    const draft = signal({ ...emptyDraft(), customer: { name: 'Acme', email: 'ap@acme.test', type: 'enterprise' as const, poNumber: 'PO-7' },
      lines: [{ description: 'Consulting', quantity: 1, unitPriceMinor: 1000 }] });
    const f = TestBed.runInInjectionContext(() => createInvoiceForm(draft));
    expect(f().valid()).toBe(true);
    const done = submit(f);
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectOne('/api/invoices').flush('dup', { status: 409, statusText: 'Conflict' });
    expect(await done).toBe(false);
    expect(f.customer.poNumber().errors()).toEqual([expect.objectContaining({ kind: 'duplicate', message: 'This PO number was already invoiced' })]);
  });

  it('signal store: optimistic void rolls back when the server refuses', async () => {
    const store = TestBed.inject(InvoiceStore);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === '/api/invoices').flush({ total: 1, items: [{ id: 'i1', number: 'INV-1', customer: 'Acme', status: 'open', totalMinor: 100, currency: 'EUR' }] });
    expect(store.openTotalMinor()).toBe(100);
    const voiding = store.voidInvoice('i1', 'Duplicate');
    expect(store.entityMap()['i1'].status).toBe('void');          // optimistic
    http.expectOne('/api/invoices/i1/void').flush('no', { status: 422, statusText: 'Unprocessable' });
    await expect(voiding).rejects.toBeTruthy();
    expect(store.entityMap()['i1'].status).toBe('open');          // rolled back
  });
});
```

### `src/app/ui/report-tabs.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { ReportTabs } from './report-tabs';

describe('ReportTabs (Angular Aria)', () => {
  it('renders an accessible tab pattern and switches with the keyboard', async () => {
    const fixture = TestBed.createComponent(ReportTabs);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(el.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Report period');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');                   // roving tabindex
    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.period()).toBe('quarter');            // selection follows focus
    expect(el.querySelector('[role="tabpanel"]:not([inert]) p, [role="tabpanel"][aria-hidden="false"] p')?.textContent ?? el.textContent).toContain('Quarter report');
  });
});
```

### `tsconfig.spec.json`

```json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [
      "vitest/globals"
    ]
  },
  "include": [
    "src/**/*.d.ts",
    "src/**/*.spec.ts"
  ]
}
```

### `public/favicon.ico`

<details><summary>Binary file (15,086 bytes), base64-encoded</summary>

```base64
AAABAAMAMDAAAAEAIACoJQAANgAAACAgAAABACAAqBAAAN4lAAAQEAAAAQAgAGgEAACGNgAAKAAA
ADAAAABgAAAAAQAgAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAABJCPAnSgrzskoK87JJCPAnAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUw7yEkUI9IhGCfT+SAr2/0wJ9f9NC/L/UAjzmVMO8hIA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMwAzwFLDO9jRAjy6UYJ9P5ICvb/
TAn1/0wJ9f9RCPT/UQj0/1QI8u5aBvB3jgv3BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYhDu
RkUJ79JGCfT+Rgn0/kYJ9P5ICvb/TAn1/0wJ9f9RCPT/UQj0/1YI8v9cB+7/Ywfq2GIQ7kYAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
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
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AH8b8zcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7RKOJgAA
AAAAAAAAAAAAAAAAAAAAAAAAUw7yEoMg8L8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAA8A+JmfAKiAgAAAAAAAAAAAAAAAAAAAAAew/kKpYl9P1xF+4tAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADpEZUa7wuA+ekRlRoAAAAAAAAAAAAAAAAA
AAAAYhDuRpsn9f+DHfOvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADyCHmM
8Al+//MGeSoAAAAAAAAAAAAAAAAAAAAAex3xWZsn9f+WJfT9fxnwGQAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
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
```

</details>

### `package.json`

```json
{
  "name": "handbook-56-angular-architecture-and-dependency-injection",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "test": "ng test --watch=false",
    "typecheck": "tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit"
  },
  "dependencies": {
    "@angular/aria": "22.3.0",
    "@angular/cdk": "22.3.0",
    "@angular/common": "22.3.0",
    "@angular/compiler": "22.3.0",
    "@angular/core": "22.3.0",
    "@angular/elements": "22.3.0",
    "@angular/forms": "22.3.0",
    "@angular/platform-browser": "22.3.0",
    "@angular/router": "22.3.0",
    "@ngrx/signals": "22.0.1",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "rxjs": "7.8.2",
    "tslib": "2.9.1"
  },
  "devDependencies": {
    "@angular/build": "22.3.0",
    "@angular/cli": "22.3.0",
    "@angular/compiler-cli": "22.3.0",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "jsdom": "31.0.1",
    "prettier": "3.10.1",
    "typescript": "6.0.3",
    "vitest": "5.1.2"
  }
}
```

### `.editorconfig`

```text
# Editor configuration, see https://editorconfig.org
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.ts]
quote_type = single
ij_typescript_use_double_quotes = false

[*.md]
max_line_length = off
trim_trailing_whitespace = false
```

### `.gitignore`

```text
node_modules
dist
.angular
```

### `.prettierrc`

```text
{
  "printWidth": 100,
  "singleQuote": true,
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular"
      }
    }
  ]
}
```

### `angular.json`

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": {
    "packageManager": "npm"
  },
  "newProjectRoot": "projects",
  "projects": {
    "acme": {
      "projectType": "application",
      "schematics": {},
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": [
              {
                "glob": "**/*",
                "input": "public"
              }
            ],
            "styles": [
              "src/styles.css"
            ],
            "security": {
              "autoCsp": true
            }
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kB",
                  "maximumError": "1MB"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "4kB",
                  "maximumError": "8kB"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "acme:build:production"
            },
            "development": {
              "buildTarget": "acme:build:development"
            }
          },
          "defaultConfiguration": "development"
        },
        "test": {
          "builder": "@angular/build:unit-test"
        }
      }
    }
  }
}
```

### `tsconfig.app.json`

```json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "src/**/*.spec.ts"
  ]
}
```

### `tsconfig.json`

```json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  },
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

---

[← Previous: E52 — A TanStack Start app](E52-tanstack-start-and-router.md) · [Chapter 56](56-angular-architecture-and-dependency-injection.md) · [Chapter 57](57-angular-signals-reactivity-and-rxjs.md) · [Chapter 59](59-react-vs-angular-architecture-comparison.md) · [Index](README.md) · [Next: E65 — A chat UI with tools and human approval →](E65-ai-powered-react-interfaces.md)
