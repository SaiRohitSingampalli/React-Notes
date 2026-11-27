# E68 — Storefront: cached product pages, safe structured data, an optimistic bag

> Runnable code for [68 — Case Study: Large E-commerce Storefront (Acme Store)](68-case-study-ecommerce-storefront.md). 5 tests.

A small Next.js 16 app with the chapter's product page: cached content with tag-based revalidation (`cacheComponents`), live price and stock streamed in under `Suspense`, and the catalogue's revalidation webhook. Beside it, the optimistic "add to bag" component and the JSON-LD serializer, with tests.

The catalogue and pricing services are stand-ins (`lib/catalogue.ts`). `npm run build` shows which routes are prerendered and which stream; `npm run dev` serves `/uk/p/desk-lamp`.

The JSON-LD test renders a product whose merchant-supplied name contains `</script>` and checks, in a real HTML parser, that the page still has exactly one script element.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 68    # writes examples/68-case-study-ecommerce-storefront/
cd examples/68-case-study-ecommerce-storefront
npm ci
npm test
npm run typecheck
npm run build
npm run dev    # then open http://localhost:3000/uk/p/desk-lamp
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `app/[market]/p/[slug]/page.tsx` | 68, "4.1 The product page: cached content, live price" |
| `app/api/revalidate/route.ts` | 68, "4.1 The product page: cached content, live price" |
| `components/cart.tsx` | 68, "4.4 The bag: optimistic, but the server decides" |
| `components/json-ld.tsx` | 68, "4.2 Structured data without an XSS" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `app/[market]/p/[slug]/page.tsx`

```tsx
// app/[market]/p/[slug]/page.tsx: a cached product shell with a live price streamed into it
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { catalogue, pricing } from '../../../../lib/catalogue';

export async function generateStaticParams() {
  return (await catalogue.popularSlugs()).flatMap((slug) => [{ market: 'uk', slug }, { market: 'de', slug }]);
}

async function getProduct(market: string, slug: string) {
  'use cache';
  cacheLife('hours');                            // product content changes rarely…
  cacheTag(`product:${slug}`);                   // …and the catalogue invalidates it by tag when it does
  return catalogue.product(market, slug);
}

async function LivePrice({ market, sku }: { market: string; sku: string }) {
  'use cache';
  cacheLife('seconds');                          // prices and stock: short-lived, never hours
  cacheTag(`price:${sku}`);
  const p = await pricing.livePrice(market, sku);
  return <p data-testid="price">{p.currency} {p.amount} · {p.inStock ? 'In stock' : 'Out of stock'}</p>;
}

export default async function ProductPage({ params }: { params: Promise<{ market: string; slug: string }> }) {
  const { market, slug } = await params;
  const product = await getProduct(market, slug);
  if (!product) notFound();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.sku };
  return (
    <main>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <Suspense fallback={<p>Checking price…</p>}>
        <LivePrice market={market} sku={product.sku} />
      </Suspense>
    </main>
  );
}
```

### `app/api/revalidate/route.ts`

```ts
// app/api/revalidate/route.ts: the catalogue calls this when a product changes
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.REVALIDATE_SECRET}`) return new Response('Forbidden', { status: 403 });
  const { slug } = (await request.json()) as { slug?: unknown };
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) return new Response('Bad request', { status: 400 });
  revalidateTag(`product:${slug}`, 'max');      // stale-while-revalidate: serve the old page once, then the new one
  return Response.json({ revalidated: `product:${slug}` });
}
```

### `app/layout.tsx`

```tsx
// Companion code: the minimal root layout Next.js requires
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

### `components/cart.tsx`

```tsx
// cart.tsx: an optimistic "add to bag" with React 19 actions; the server's answer always wins
import { useOptimistic, useState } from 'react';

export function AddToBag({ addItem }: { addItem: () => Promise<number> }) {
  const [count, setCount] = useState(0);                                   // confirmed by the server
  const [shown, addOptimistic] = useOptimistic(count, (current, delta: number) => current + delta);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    addOptimistic(1);                                                      // instant feedback
    try {
      setCount(await addItem());                                           // the server returns the real count
    } catch {
      setError('We couldn’t add that to your bag. Please try again.');     // optimistic value reverts on its own
    }
  }

  return (
    <form action={add}>
      <button type="submit">Add to bag</button>
      <output aria-live="polite">{shown} in bag</output>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

### `components/json-ld.tsx`

```tsx
// json-ld.tsx: structured data for product pages, safe to embed in HTML
export interface ProductJsonLd { '@context': 'https://schema.org'; '@type': 'Product'; name: string; sku: string; offers: { '@type': 'Offer'; price: string; priceCurrency: string; availability: string } }

/** JSON is not HTML-safe: a "</script>" inside any string value would end the script element. Escape <, > and &. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function ProductStructuredData({ data }: { data: ProductJsonLd }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
```

### `lib/catalogue.ts`

```ts
// lib/catalogue.ts: stands in for the catalogue and pricing services
export interface Product { sku: string; slug: string; name: string; description: string; image: string }
const products: Product[] = [
  { sku: 'LAMP-1', slug: 'desk-lamp', name: 'Desk lamp', description: 'A warm, dimmable desk lamp.', image: '/lamp.jpg' },
  { sku: 'CHAIR-2', slug: 'oak-chair', name: 'Oak chair', description: 'Solid oak, hand finished.', image: '/chair.jpg' },
];
export const catalogue = {
  async product(market: string, slug: string) { return products.find((p) => p.slug === slug) ?? null; },
  async popularSlugs() { return products.map((p) => p.slug); },
};
export const pricing = {
  async livePrice(market: string, sku: string) { return { amount: sku === 'LAMP-1' ? '49.00' : '189.00', currency: market === 'uk' ? 'GBP' : 'EUR', inStock: true }; },
};
```

### `test/cart.test.tsx`

```tsx
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AddToBag } from '../components/cart';

afterEach(cleanup);
const later = <T,>(fn: () => T, ms = 50) => new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, ms));

describe('optimistic add to bag', () => {
  it('shows the item immediately and keeps it when the server confirms', async () => {
    render(<AddToBag addItem={() => later(() => 1)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByText('1 in bag')).toBeTruthy();                     // before the server answered
    await act(() => later(() => undefined, 100));
    expect(screen.getByText('1 in bag')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rolls back and explains when the server refuses', async () => {
    render(<AddToBag addItem={() => later(() => { throw new Error('out of stock'); })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByText('1 in bag')).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('0 in bag')).toBeTruthy();                     // the optimistic value reverted
  });
});
```

### `test/json-ld.test.tsx`

```tsx
import { JSDOM } from 'jsdom';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductStructuredData, serializeJsonLd, type ProductJsonLd } from '../components/json-ld';

// A merchant-supplied product name: content the storefront doesn't control
const product: ProductJsonLd = {
  '@context': 'https://schema.org', '@type': 'Product', sku: 'LAMP-1',
  name: 'Desk lamp </script><script>window.pwned = true</script>',
  offers: { '@type': 'Offer', price: '49.00', priceCurrency: 'GBP', availability: 'https://schema.org/InStock' },
};

function load(html: string) {
  const dom = new JSDOM(`<!doctype html><html><head>${html}</head><body></body></html>`, { runScripts: 'dangerously' });
  const scripts = [...dom.window.document.querySelectorAll('script')];
  return { pwned: (dom.window as unknown as { pwned?: boolean }).pwned === true, scripts };
}

describe('JSON-LD in server-rendered HTML', () => {
  it('JSON.stringify inside dangerouslySetInnerHTML lets a product name run script', () => {
    const html = renderToString(<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }} />);
    const page = load(html);
    expect(page.pwned).toBe(true);
    expect(page.scripts).toHaveLength(2);                      // the name closed the element and opened a new one
  });

  it('escaping <, > and & keeps one inert script whose JSON round-trips exactly', () => {
    const page = load(renderToString(<ProductStructuredData data={product} />));
    expect(page.pwned).toBe(false);
    expect(page.scripts).toHaveLength(1);
    expect(JSON.parse(page.scripts[0].textContent!)).toEqual(product);
    expect(serializeJsonLd({ a: '<b>' })).toBe('{"a":"\\u003cb\\u003e"}');
  });

  it('a plain text child is also safe in React 19: React escapes "script" inside script text', () => {
    const html = renderToString(<script type="application/ld+json">{JSON.stringify(product)}</script>);
    expect(html).toContain('</\\u0073cript>');                              // "</script>" became "</\u0073cript>"
    const page = load(html);
    expect(page.pwned).toBe(false);
    expect(page.scripts).toHaveLength(1);
    expect(JSON.parse(page.scripts[0].textContent!)).toEqual(product);      // and the JSON still round-trips
  });
});
```

### `package.json`

```json
{
  "name": "handbook-68-case-study-ecommerce-storefront",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "dependencies": {
    "next": "16.4.6",
    "react": "19.3.1",
    "react-dom": "19.3.1"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.13",
    "@types/jsdom": "30.0.0",
    "@types/node": "22.20.6",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "jsdom": "31.0.1",
    "typescript": "6.0.3",
    "vitest": "5.1.2"
  }
}
```

### `.gitignore`

```text
.next
node_modules
*.tsbuildinfo
```

### `next-env.d.ts`

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";
import "./.next/types/root-params.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

### `next.config.ts`

```ts
import type { NextConfig } from 'next';
const config: NextConfig = { cacheComponents: true };
export default config;
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "allowJs": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "vitest.config.ts"
  ]
}
```

### `vitest.config.ts`

```ts

import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', include: ['test/**/*.test.tsx'] } });
```

---

[← Previous: E67 — Tenant-scoped server state](E67-case-study-enterprise-saas-dashboard.md) · [Chapter 68](68-case-study-ecommerce-storefront.md) · [Index](README.md) · [Next: E69 — A collaborative board on a CRDT →](E69-case-study-collaborative-project-management.md)
