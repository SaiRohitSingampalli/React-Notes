# E67 — Tenant-scoped server state

> Runnable code for [67 — Case Study: Enterprise SaaS Dashboard (Acme Insights)](67-case-study-enterprise-saas-dashboard.md). 3 tests.

The chapter's data-access module (in the case study it lives at `packages/data-access/src/invoices.ts`): the tenant is part of every query key, previous data is kept only while paging within one tenant, and switching tenant drops the old tenant's cache.

The first test shows the bug this prevents. With TanStack Query's `keepPreviousData`, tenant A's customers stay on screen under tenant B's heading while B loads.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 67    # writes examples/67-case-study-enterprise-saas-dashboard/
cd examples/67-case-study-enterprise-saas-dashboard
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/invoices.ts` | 67, "4.1 Tenancy in the URL, context, keys and caches" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/invoices.ts`

```ts
// packages/data-access/src/invoices.ts: tenant-scoped server state.
// The tenant is part of every query key, and never "kept" across a switch.
import { QueryClient, useQuery } from '@tanstack/react-query';

export interface Invoice { id: string; customer: string }
export type Fetch = (tenantId: string, page: number) => Promise<Invoice[]>;

export const invoiceKeys = {
  all: (tenantId: string) => ['tenant', tenantId, 'invoices'] as const,
  page: (tenantId: string, page: number) => [...invoiceKeys.all(tenantId), { page }] as const,
};

/** Keeps previous data only when paging within the same tenant. */
export function useInvoices(fetchPage: Fetch, tenantId: string, page: number) {
  return useQuery({
    queryKey: invoiceKeys.page(tenantId, page),
    queryFn: () => fetchPage(tenantId, page),
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === tenantId ? previous : undefined),
  });
}

/** On tenant switch, drop every cached query of the old tenant (memory and data minimisation). */
export function onTenantSwitch(client: QueryClient, previousTenantId: string) {
  client.removeQueries({ queryKey: ['tenant', previousTenantId] });
}
```

### `test/InvoiceTable.tsx`

```tsx

// Companion code: a table over both hooks, so the test can show what the unsafe one puts on screen
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { invoiceKeys, useInvoices, type Fetch } from '../src/invoices.ts';

/** UNSAFE: keeps the previous key's data while the next loads, including across tenants. */
export function useInvoicesUnsafe(fetchPage: Fetch, tenantId: string, page: number) {
  return useQuery({ queryKey: invoiceKeys.page(tenantId, page), queryFn: () => fetchPage(tenantId, page), placeholderData: keepPreviousData });
}

export function InvoiceTable({ tenantId, page, fetchPage, safe }: { tenantId: string; page: number; fetchPage: Fetch; safe: boolean }) {
  const q = (safe ? useInvoices : useInvoicesUnsafe)(fetchPage, tenantId, page);
  if (q.isPending) return <p>Loading invoices…</p>;
  return (
    <table aria-label={`Invoices for ${tenantId}`} aria-busy={q.isPlaceholderData}>
      <tbody>{q.data?.map((i) => <tr key={i.id}><td>{i.id}</td><td>{i.customer}</td></tr>)}</tbody>
    </table>
  );
}
```

### `test/tenant-switch.test.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { onTenantSwitch, type Fetch } from '../src/invoices.ts';
import { InvoiceTable } from './InvoiceTable.tsx';

afterEach(cleanup);

// Tenant B's API is slow, so we can see what the table shows while B loads
const data: Record<string, string> = { 'tenant-a': 'Alpha Ltd', 'tenant-b': 'Beta GmbH' };
const fetchPage: Fetch = (tenantId, page) =>
  new Promise((resolve) => setTimeout(() => resolve([{ id: `${tenantId}-${page}`, customer: data[tenantId] }]), tenantId === 'tenant-b' ? 200 : 5));

function renderTable(safe: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (tenantId: string, page = 1) => <QueryClientProvider client={client}><InvoiceTable tenantId={tenantId} page={page} fetchPage={fetchPage} safe={safe} /></QueryClientProvider>;
  const r = render(view('tenant-a'));
  return { client, rerender: (tenantId: string, page?: number) => r.rerender(view(tenantId, page)) };
}

describe('tenant-scoped server state', () => {
  it('UNSAFE keepPreviousData shows tenant A rows under tenant B while B loads', async () => {
    const { rerender } = renderTable(false);
    await screen.findByText('Alpha Ltd');
    rerender('tenant-b');                                                   // the user switches tenant
    const table = screen.getByRole('table', { name: 'Invoices for tenant-b' });
    expect(table.textContent).toContain('Alpha Ltd');                       // another tenant's customer, on screen
    await screen.findByText('Beta GmbH');
  });

  it('SAFE placeholder keeps data when paging within a tenant, never across tenants', async () => {
    const { rerender } = renderTable(true);
    await screen.findByText('Alpha Ltd');
    rerender('tenant-a', 2);                                                // paging: previous page stays visible, marked busy
    expect(screen.getByRole('table', { name: 'Invoices for tenant-a' }).getAttribute('aria-busy')).toBe('true');
    await screen.findByText('tenant-a-2');
    rerender('tenant-b');                                                   // tenant switch: no foreign data, a loading state
    expect(screen.queryByText('Alpha Ltd')).toBeNull();
    expect(screen.getByText('Loading invoices…')).toBeTruthy();
    await screen.findByText('Beta GmbH');
  });

  it('removes the old tenant from the cache on switch', async () => {
    const { client, rerender } = renderTable(true);
    await screen.findByText('Alpha Ltd');
    onTenantSwitch(client, 'tenant-a');
    rerender('tenant-b');
    await screen.findByText('Beta GmbH');
    expect(client.getQueryCache().findAll({ queryKey: ['tenant', 'tenant-a'] })).toHaveLength(0);
  });
});
```

### `package.json`

```json
{
  "name": "handbook-67-case-study-enterprise-saas-dashboard",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "dependencies": {
    "@tanstack/react-query": "5.108.4",
    "react": "19.3.1",
    "react-dom": "19.3.1"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.13",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "jsdom": "31.0.1",
    "typescript": "6.0.3",
    "vitest": "5.1.2"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": false,
    "lib": [
      "es2024",
      "dom",
      "dom.iterable"
    ],
    "types": [],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "jsx": "react-jsx"
  },
  "include": [
    "src",
    "test"
  ]
}
```

### `vitest.config.ts`

```ts

import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom' } });
```

---

[← Previous: E66 — The typeahead core](E66-frontend-system-design.md) · [Chapter 67](67-case-study-enterprise-saas-dashboard.md) · [Index](README.md) · [Next: E68 — Storefront: cached product pages, safe structured data, an optimistic bag →](E68-case-study-ecommerce-storefront.md)
