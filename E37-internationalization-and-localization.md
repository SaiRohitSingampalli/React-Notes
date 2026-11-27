# E37 — Cached Intl formatters and correct money

> Runnable code for [37 — Internationalization and Localization](37-internationalization-and-localization.md). 7 tests.

The chapter's formatter cache and `formatMoney`, which converts stored minor units with the ISO 4217 table and uses `Intl` only for display. `Intl`'s display digits differ from ISO's for HUF, IDR, COP and IQD, which is why they can't be used to convert.

`platform-outputs.test.ts` checks every row of the chapter's "real outputs" table against your Node's ICU data. A failure there means your ICU or CLDR version formats differently, not that the code is wrong: run `node -p process.versions` to see which versions you have.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 37    # writes examples/37-internationalization-and-localization/
cd examples/37-internationalization-and-localization
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/shared/i18n/format.ts` | 37, "4. Formatting with `Intl`" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/shared/i18n/format.ts`

```ts
// shared/i18n/format.ts: cache formatters (construction is the expensive part)
import type { Money } from '@/shared/money';

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = numberFormats.get(key);
  if (!f) { f = new Intl.NumberFormat(locale, options); numberFormats.set(key, f); }
  return f;
}

export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, options); dateFormats.set(key, f); }
  return f;
}

// ISO 4217 minor units: how amounts are stored. Intl's display digits differ for some currencies
// (HUF, IDR and COP display no decimals but are stored with two; IQD with three), so don't use them to convert.
const MINOR_UNITS: Record<string, number> = {
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3, CLF: 4, UYW: 4,
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
};
export const minorUnits = (currency: string) => MINOR_UNITS[currency] ?? 2;

export function formatMoney(locale: string, { amountMinor, currency }: Money): string {
  return numberFormat(locale, { style: 'currency', currency }).format(amountMinor / 10 ** minorUnits(currency));
}
```

### `src/shared/money.ts`

```ts

// Glue: the money type from chapter 33 (integer minor units plus an ISO 4217 code)
export type Money = { amountMinor: number; currency: string };
```

### `test/format.test.ts`

```ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateTimeFormat, formatMoney, minorUnits, numberFormat } from '../src/shared/i18n/format.ts';

const plain = (s: string) => s.replace(/\s/g, ' ');                       // Intl uses no-break spaces

test('money converts with ISO 4217 minor units and uses Intl only to display', () => {
  assert.equal(plain(formatMoney('en', { amountMinor: 1999, currency: 'EUR' })), '€19.99');
  assert.equal(plain(formatMoney('en', { amountMinor: 500, currency: 'JPY' })), '¥500');
  assert.equal(plain(formatMoney('en', { amountMinor: 1234, currency: 'KWD' })), 'KWD 1.234');
  // Intl displays no decimals for these, but they are stored with two: the old code was off by 100x
  assert.equal(plain(formatMoney('en', { amountMinor: 100_000, currency: 'HUF' })), 'HUF 1,000');
  assert.equal(plain(formatMoney('en', { amountMinor: 1_500_000, currency: 'IDR' })), 'IDR 15,000');
});

test('minor units default to 2 and follow ISO 4217 where they differ', () => {
  assert.deepEqual(['USD', 'JPY', 'KWD', 'CLF', 'IQD'].map(minorUnits), [2, 0, 3, 4, 3]);
});

test('formatters are cached per locale and options', () => {
  assert.equal(numberFormat('de-DE', { style: 'percent' }), numberFormat('de-DE', { style: 'percent' }));
  assert.notEqual(numberFormat('de-DE'), numberFormat('fr-FR'));
  const options = { dateStyle: 'medium', timeZone: 'UTC' } as const;
  assert.equal(dateTimeFormat('en-GB', options), dateTimeFormat('en-GB', options));
  assert.equal(dateTimeFormat('en-GB', options).format(new Date('2026-11-21T15:30:00Z')), '21 Nov 2026');
});
```

### `test/platform-outputs.test.ts`

```ts

// The chapter's "What the platform gives you (real outputs)" table, checked against this Node's ICU.
// Exact output depends on the ICU and CLDR versions; these were recorded with ICU 78.3 and CLDR 48.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const plain = (s: string) => s.replace(/\s/g, ' ');
const nf = (locale: string, options: Intl.NumberFormatOptions, n: number) => plain(new Intl.NumberFormat(locale, options).format(n));

test('numbers and currencies', () => {
  assert.equal(nf('de-DE', { style: 'currency', currency: 'EUR' }, 1299.5), '1.299,50 €');
  assert.equal(nf('ja-JP', { style: 'currency', currency: 'JPY' }, 1299.5), '￥1,300');
  assert.equal(nf('en-IN', { style: 'currency', currency: 'INR' }, 1234567), '₹12,34,567.00');
  assert.equal(nf('ar-EG', {}, 1234567.89), '١٬٢٣٤٬٥٦٧٫٨٩');
  assert.equal(nf('en', { notation: 'compact' }, 1234567), '1.2M');
  assert.equal(nf('de', { notation: 'compact' }, 1234567), '1,2 Mio.');
  assert.equal(nf('en', { style: 'unit', unit: 'kilometer-per-hour' }, 88), '88 km/h');
  assert.equal(nf('fr-FR', { style: 'percent', maximumFractionDigits: 1 }, 0.256), '25,6 %');
  // The spaces differ: a no-break space before %, a narrow no-break space between thousands
  assert.equal(new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 }).format(0.256).at(-2), '\u00a0');
  assert.equal(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1299.5), '1\u202f299,50\u00a0€');
});

test('relative time, lists and display names', () => {
  assert.equal(new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day'), 'yesterday');
  assert.equal(new Intl.RelativeTimeFormat('de', { numeric: 'auto' }).format(2, 'day'), 'übermorgen');
  assert.equal(new Intl.ListFormat('en', { type: 'conjunction' }).format(['Ana', 'Ben', 'Chen']), 'Ana, Ben, and Chen');
  assert.equal(new Intl.ListFormat('es', { type: 'conjunction' }).format(['Ana', 'Ben', 'Chen']), 'Ana, Ben y Chen');
  assert.equal(new Intl.DisplayNames(['de'], { type: 'region' }).of('US'), 'Vereinigte Staaten');
  assert.equal(new Intl.DisplayNames(['en'], { type: 'language' }).of('pt-BR'), 'Brazilian Portuguese');
});

test('collation: German sorts Ä with A, Swedish after Z', () => {
  const words = ['Zebra', 'Äpfel', 'Apfel'];
  assert.deepEqual([...words].sort(new Intl.Collator('de').compare), ['Apfel', 'Äpfel', 'Zebra']);
  assert.deepEqual([...words].sort(new Intl.Collator('sv').compare), ['Apfel', 'Zebra', 'Äpfel']);
});

test('segmentation: one grapheme, eight UTF-16 code units', () => {
  const family = '\u{1F469}\u200D\u{1F469}\u200D\u{1F467}';            // woman, ZWJ, woman, ZWJ, girl: one family emoji
  assert.equal(family.length, 8);
  assert.equal([...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(family)].length, 1);
});
```

### `package.json`

```json
{
  "name": "handbook-37-internationalization-and-localization",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.ts\"",
    "typecheck": "tsc"
  },
  "devDependencies": {
    "@types/node": "22.20.6",
    "typescript": "6.0.3"
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
    "erasableSyntaxOnly": true,
    "noUncheckedIndexedAccess": false,
    "lib": [
      "es2024",
      "dom",
      "dom.iterable"
    ],
    "types": [
      "node"
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src",
    "test"
  ]
}
```

---

[← Previous: E33 — A production HTTP client](E33-api-integration-bff-and-contracts.md) · [Chapter 37](37-internationalization-and-localization.md) · [Index](README.md) · [Next: E40 — A client-side circuit breaker →](E40-resilience-and-reliability.md)
