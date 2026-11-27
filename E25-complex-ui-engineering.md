# E25 — A virtualised grid on TanStack Table 9

> Runnable code for [25 — Complex UI Engineering: Overlays, Menus, Grids, Trees, Editors, Drag-and-Drop and Canvas](25-complex-ui-engineering.md). 2 tests.

The chapter's grid: TanStack Table 9 (`useTable`, `tableFeatures`, `FlexRender`) for the model and TanStack Virtual for rendering. The tests render 10,000 rows and check that only a window of them reaches the DOM, that ARIA row counts and indexes describe the whole table, and that cells render through the column definitions.

jsdom has no layout, so the test gives the scroll container the 600 px height the grid's style asks for.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 25    # writes examples/25-complex-ui-engineering/
cd examples/25-complex-ui-engineering
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/OrdersGrid.tsx` | 25, "3.2 Architecture of a large grid" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/OrdersGrid.tsx`

```tsx
import { FlexRender, tableFeatures, useTable, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

type Order = { id: string; number: string; customer: string; totalMinor: number };

const features = tableFeatures({}); // register sorting, filtering and so on as the grid needs them (TanStack Table 9)

export function OrdersGrid({ rows, columns }: { rows: Order[]; columns: ColumnDef<typeof features, Order>[] }) {
  const table = useTable({ features, columns, data: rows, getRowId: (row) => row.id });
  const parentRef = useRef<HTMLDivElement>(null);
  const model = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: model.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ blockSize: 600, overflow: 'auto' }}>
      <table aria-rowcount={model.length + 1}>
        <thead style={{ position: 'sticky', top: 0 }}>{/* headers… */}</thead>
        <tbody style={{ position: 'relative', blockSize: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = model[v.index];
            return (
              <tr key={row.id} aria-rowindex={v.index + 2} style={{ position: 'absolute', transform: `translateY(${v.start}px)` }}>
                {row.getAllCells().map((cell) => <td key={cell.id}><FlexRender cell={cell} /></td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

### `test/OrdersGrid.test.tsx`

```tsx

import { cleanup, render, screen } from '@testing-library/react';
import { createColumnHelper, tableFeatures } from '@tanstack/react-table';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { OrdersGrid } from '../src/OrdersGrid.tsx';

type Order = { id: string; number: string; customer: string; totalMinor: number };
const features = tableFeatures({});                                  // the same (empty) feature set as the grid
const column = createColumnHelper<typeof features, Order>();
// columns([...]) keeps each column's value type; a plain array of mixed accessors won't type-check
const columns = column.columns([
  column.accessor('number', { header: 'Number' }),
  column.accessor('customer', { header: 'Customer' }),
  column.accessor('totalMinor', { header: 'Total', cell: (info) => (info.getValue() / 100).toFixed(2) }),
]);
const rows: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `ord_${i}`, number: `INV-${String(i).padStart(5, '0')}`, customer: `Customer ${i}`, totalMinor: 1000 + i,
}));

beforeAll(() => {
  // jsdom has no layout: give the scroll container the 600 px the grid's style asks for
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
});
afterEach(cleanup);

it('renders only a window of 10,000 rows, with row positions for assistive technology', () => {
  render(<OrdersGrid rows={rows} columns={columns} />);
  const table = screen.getByRole('table');
  expect(table.getAttribute('aria-rowcount')).toBe('10001');          // all rows, plus the header row
  const rendered = screen.getAllByRole('row');
  expect(rendered.length).toBeGreaterThan(10);
  expect(rendered.length).toBeLessThan(40);                            // 600 / 40 px rows, plus overscan
  expect(rendered[0].getAttribute('aria-rowindex')).toBe('2');
});

it('renders cells through the column definitions, keyed by domain IDs', () => {
  render(<OrdersGrid rows={rows} columns={columns} />);
  const first = screen.getAllByRole('row')[0];
  expect([...first.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['INV-00000', 'Customer 0', '10.00']);
});
```

### `package.json`

```json
{
  "name": "handbook-25-complex-ui-engineering",
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
    "@tanstack/react-table": "9.3.1",
    "@tanstack/react-virtual": "3.14.28",
    "react": "19.3.1",
    "react-dom": "19.3.1"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
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

[← Previous: E12 — useLocalStorageState: an external store done right](E12-hooks-in-depth.md) · [Chapter 25](25-complex-ui-engineering.md) · [Index](README.md) · [Next: E26 — useAutosave: debounced saves with optimistic concurrency →](E26-forms-and-validation.md)
