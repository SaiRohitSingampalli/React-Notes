# E78 — The Prism business case, as a model

> Runnable code for [78 — Business Cases and Investment Arguments](78-business-cases-and-investment-arguments.md). 3 tests.

NPV, payback and IRR for a monthly cash-flow model, and the chapter's worked example: funding the Prism design system. The tests check the finance functions against hand-computable cases, reproduce the base case, and find what would have to be true (the break-even hours saved per week) for the investment to pay back.

Change the inputs in `PRISM` to argue your own case, and keep the sensitivity test: the conclusion should survive pessimistic inputs.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 78    # writes examples/78-business-cases-and-investment-arguments/
cd examples/78-business-cases-and-investment-arguments
npm test
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/business-case.mjs` | 78, "4. A worked example: funding Prism" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The project has no dependencies, so there is no lockfile and nothing to install.

### `src/business-case.mjs`

```js
// business-case.mjs: net present value, payback and internal rate of return for a monthly cash-flow model

// ── From chapter 78, "4. A worked example: funding Prism" ──
/** NPV of monthly net cash flows (month 1 first), discounted at an annual rate. */
export function npv(annualRate, monthly) {
  const r = (1 + annualRate) ** (1 / 12) - 1;
  return monthly.reduce((sum, cash, i) => sum + cash / (1 + r) ** (i + 1), 0);
}

/** A design-system investment: build for a year, then run it; benefits grow with adoption. */
export function designSystemCase(a) {
  const months = 36, monthly = [];
  for (let m = 1; m <= months; m++) {
    const cost = (m <= 12 ? a.buildEngineers : a.runEngineers) * a.loadedCostPerEngineerYear / 12;
    const adoption = Math.min(a.targetAdoption, a.targetAdoption * (m / a.monthsToTargetAdoption));
    const hoursSaved = a.productEngineers * adoption * a.hoursSavedPerWeek * 52 / 12 * a.captureRate;
    const benefit = hoursSaved * a.loadedCostPerHour
      + adoption * (a.remediationAvoidedPerMonthAtFullAdoption + a.riskReductionPerMonthAtFullAdoption);
    monthly.push(benefit - cost);
  }
  return { monthly, npv: npv(a.discountRate, monthly), payback: paybackMonth(monthly), irr: irr(monthly) };
}

// ── Companion code (not in the chapter) ──
/** First month in which cumulative net cash flow turns non-negative (null if never). */
export function paybackMonth(monthly) {
  let total = 0;
  for (let i = 0; i < monthly.length; i++) { total += monthly[i]; if (total >= 0) return i + 1; }
  return null;
}

/** Annual internal rate of return by bisection: the rate at which NPV is zero. */
export function irr(monthly, lo = -0.99, hi = 100) {
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid, monthly) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Companion code (not in the chapter) ──
/** The worked example's inputs (section 4). */
export const PRISM = {
  buildEngineers: 6, runEngineers: 4, loadedCostPerEngineerYear: 220_000, loadedCostPerHour: 110,
  productEngineers: 180, hoursSavedPerWeek: 2.5, captureRate: 0.5,   // only half of saved time becomes useful work
  targetAdoption: 0.8, monthsToTargetAdoption: 12,
  remediationAvoidedPerMonthAtFullAdoption: 50_000,                  // accessibility fixes no longer needed per product
  riskReductionPerMonthAtFullAdoption: 0.25 * 2_000_000 / 12,        // a 25% yearly chance of losing $2M of deals, removed
  discountRate: 0.10,
};
```

### `test/business-case.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRISM, designSystemCase, irr, npv, paybackMonth } from '../src/business-case.mjs';

const usd = (n) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

test('the finance functions agree with hand-checkable cases', () => {
  assert.ok(Math.abs(npv(0, [100, 100]) - 200) < 1e-9);
  assert.equal(paybackMonth([-100, 50, 50]), 3);
  const flat = [-1000, ...Array(11).fill(0), 1100];                   // +10% after exactly one year
  assert.ok(Math.abs(irr(flat) - 0.1) < 1e-6);
});

test('the Prism case: base, and what would have to be true', () => {
  const base = designSystemCase(PRISM);
  console.log(`base: NPV ${usd(base.npv)}, payback month ${base.payback}, IRR ${(base.irr * 100).toFixed(0)}%`);
  for (const [label, change] of [
    ['adoption only 50%', { targetAdoption: 0.5 }],
    ['1 hour saved per week', { hoursSavedPerWeek: 1 }],
    ['adoption takes 24 months', { monthsToTargetAdoption: 24 }],
    ['no risk reduction counted', { riskReductionPerMonthAtFullAdoption: 0 }],
    ['50% adoption, 1 hour, 24 months, no risk', { targetAdoption: 0.5, hoursSavedPerWeek: 1, monthsToTargetAdoption: 24, riskReductionPerMonthAtFullAdoption: 0 }],
  ]) {
    const r = designSystemCase({ ...PRISM, ...change });
    console.log(`${label}: NPV ${usd(r.npv)}, payback ${r.payback ?? 'never (36 months)'}`);
  }
  const first12 = base.monthly.slice(0, 12).reduce((a, b) => a + b, 0);
  console.log(`year-1 net: ${usd(first12)}; monthly net at month 13: ${usd(base.monthly[12])}`);
  assert.ok(base.npv > 0);
});

test('break-even hours saved per week, everything else at base', () => {
  let lo = 0, hi = 5;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (designSystemCase({ ...PRISM, hoursSavedPerWeek: mid }).npv > 0) hi = mid; else lo = mid; }
  console.log(`break-even: ${hi.toFixed(2)} hours saved per product engineer per week`);
  assert.ok(hi < PRISM.hoursSavedPerWeek);
});
```

### `package.json`

```json
{
  "name": "handbook-78-business-cases-and-investment-arguments",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.mjs\""
  }
}
```

---

[← Previous: E76 — A cost and capacity model you can change](E76-frontend-cost-and-capacity-engineering.md) · [Chapter 78](78-business-cases-and-investment-arguments.md) · [Index](README.md) · [Next: E79 — Token buckets and consistent hashing →](E79-distributed-systems-design-for-frontend-architects.md)
