# E75 — Experiment arithmetic: assignment, sample sizes, SRM and peeking

> Runnable code for [75 — Experimentation and Product Analytics](75-experimentation-and-product-analytics.md). 6 tests.

Deterministic assignment, sample sizes, the sample-ratio-mismatch check and an A/A simulation of peeking, with no dependencies. The tests reproduce the chapter's figures: correlated assignments without the hash finalizer, sample sizes for a 4% baseline, and the false-positive rate that daily peeking produces.

Run `npm test -- --test-reporter=spec` to see the printed figures next to each test.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 75    # writes examples/75-experimentation-and-product-analytics/
cd examples/75-experimentation-and-product-analytics
npm test
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/experiment.mjs` | 75, "3. Assignment" |
| `src/experiment.mjs` | 75, "5. Sample size and duration" |
| `src/experiment.mjs` | 75, "7. Sample ratio mismatch" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The project has no dependencies, so there is no lockfile and nothing to install.

### `src/experiment.mjs`

```js
// experiment.mjs: the arithmetic behind trustworthy A/B tests, with no dependencies

// ── From chapter 75, "3. Assignment" ──
/** FNV-1a 32-bit: fast, synchronous and identical in every browser and server. */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Murmur3's 32-bit finalizer: spreads every input bit across the output (FNV-1a alone doesn't). */
export function mix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic assignment: the same user always gets the same variant of the same experiment. */
export function assign(userId, experimentKey, variants = ['control', 'treatment'], weights = [0.5, 0.5]) {
  const point = mix32(fnv1a(`${experimentKey}:${userId}`)) / 2 ** 32;
  let edge = 0;
  for (let i = 0; i < variants.length; i++) { edge += weights[i]; if (point < edge) return variants[i]; }
  return variants.at(-1);
}

// ── Companion code (not in the chapter) ──
/** The first version, without the finalizer, kept to show the correlation bug the tests reproduce. */
export function assignUnmixed(userId, experimentKey, variants = ['control', 'treatment'], weights = [0.5, 0.5]) {
  const point = fnv1a(`${experimentKey}:${userId}`) / 2 ** 32;
  let edge = 0;
  for (let i = 0; i < variants.length; i++) { edge += weights[i]; if (point < edge) return variants[i]; }
  return variants.at(-1);
}

// ── From chapter 75, "5. Sample size and duration" ──
const Z_975 = 1.959963984540054, Z_80 = 0.8416212335729143;          // two-sided alpha 0.05, power 0.8

/** Users needed per arm to detect a relative lift in a conversion rate (two-proportion z-test). */
export function sampleSizePerArm(baseline, relativeLift, zAlpha = Z_975, zBeta = Z_80) {
  const p1 = baseline, p2 = baseline * (1 + relativeLift), pBar = (p1 + p2) / 2;
  const n = (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  return Math.ceil(n);
}

// ── Companion code (not in the chapter) ──
/** Two-sided p-value for a difference in proportions (pooled z-test). */
export function twoProportionP(convA, nA, convB, nB) {
  const pool = (convA + convB) / (nA + nB);
  const se = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
  const z = Math.abs(convA / nA - convB / nB) / se;
  return erfc(z / Math.SQRT2);
}

// ── From chapter 75, "7. Sample ratio mismatch" ──
/** Sample-ratio-mismatch check: chi-square with one degree of freedom against the planned split. */
export function srmP(countA, countB, expectedShareA = 0.5) {
  const total = countA + countB, eA = total * expectedShareA, eB = total - eA;
  const chi2 = (countA - eA) ** 2 / eA + (countB - eB) ** 2 / eB;
  return erfc(Math.sqrt(chi2 / 2));
}

// ── Companion code (not in the chapter) ──
/** Complementary error function (Numerical Recipes erfcc; fractional error < 1.2e-7). */
export function erfc(x) {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

export function prng(seed) {                                          // mulberry32, for reproducible simulations
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A/A tests (no real difference) checked once per day: how often does someone see "significant"? */
export function peekingFalsePositiveRate({ runs = 2000, days = 20, usersPerDayPerArm = 1000, rate = 0.05, seed = 7 } = {}) {
  const rand = prng(seed);
  let peekedPositives = 0, finalPositives = 0;
  for (let r = 0; r < runs; r++) {
    let cA = 0, cB = 0, n = 0, flagged = false;
    for (let d = 0; d < days; d++) {
      for (let u = 0; u < usersPerDayPerArm; u++) { if (rand() < rate) cA++; if (rand() < rate) cB++; }
      n += usersPerDayPerArm;
      if (!flagged && twoProportionP(cA, n, cB, n) < 0.05) flagged = true;  // "it's significant, ship it"
    }
    if (flagged) peekedPositives++;
    if (twoProportionP(cA, n, cB, n) < 0.05) finalPositives++;          // one look, at the planned end
  }
  return { peeking: peekedPositives / runs, singleLook: finalPositives / runs };
}
```

### `test/experiment.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assign, assignUnmixed, erfc, peekingFalsePositiveRate, sampleSizePerArm, srmP, twoProportionP } from '../src/experiment.mjs';

const cells = (fn) => {
  const split = { control: 0, treatment: 0 }, both = {};
  for (let i = 0; i < 100_000; i++) {
    const a = fn(`user-${i}`, 'checkout-cta'), b = fn(`user-${i}`, 'search-ranking');
    split[a]++;
    both[`${a}/${b}`] = (both[`${a}/${b}`] ?? 0) + 1;
  }
  return { split, both };
};

test('without a finalizer, FNV-1a assignments in two experiments are correlated', () => {
  const { both } = cells(assignUnmixed);
  console.log('unmixed cells', JSON.stringify(both));
  assert.ok(Object.values(both).some((n) => Math.abs(n / 100_000 - 0.25) > 0.03));
});

test('with the finalizer: stable, balanced, and independent across experiments', () => {
  const { split, both } = cells(assign);
  console.log('mixed split', JSON.stringify(split), 'cells', JSON.stringify(both), 'SRM p', srmP(split.control, split.treatment).toFixed(3));
  assert.equal(assign('user-42', 'checkout-cta'), assign('user-42', 'checkout-cta'));
  assert.ok(srmP(split.control, split.treatment) > 0.001);
  for (const n of Object.values(both)) assert.ok(Math.abs(n / 100_000 - 0.25) < 0.01);
});

test('sample sizes for a 4% baseline conversion rate', () => {
  const five = sampleSizePerArm(0.04, 0.05), ten = sampleSizePerArm(0.04, 0.10), twenty = sampleSizePerArm(0.04, 0.20);
  console.log(`per arm: 5% lift ${five}, 10% lift ${ten}, 20% lift ${twenty}`);
  assert.ok(five > 3.5 * ten && ten > 3.5 * twenty);                    // halving the effect roughly quadruples n
});

test('erfc and the z-test agree with reference values', () => {
  assert.ok(Math.abs(erfc(1.959963984540054 / Math.SQRT2) - 0.05) < 1e-6);
  assert.ok(Math.abs(twoProportionP(500, 10_000, 500, 10_000) - 1) < 1e-6);
});

test('a 50,000 / 49,000 split is a sample ratio mismatch', () => {
  const p = srmP(50_000, 49_000);
  console.log('SRM p for 50,000 vs 49,000:', p.toExponential(2));
  assert.ok(p < 0.01);
});

test('peeking every day inflates false positives in A/A tests', () => {
  const { peeking, singleLook } = peekingFalsePositiveRate();
  console.log(`A/A tests: daily peeking ${(peeking * 100).toFixed(1)}% false positives; single planned look ${(singleLook * 100).toFixed(1)}%`);
  assert.ok(peeking > 3 * singleLook);
  assert.ok(Math.abs(singleLook - 0.05) < 0.015);
});
```

### `package.json`

```json
{
  "name": "handbook-75-experimentation-and-product-analytics",
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

[← Previous: E74 — Machine-coding drills, with their tests](E74-machine-coding-drills.md) · [Chapter 75](75-experimentation-and-product-analytics.md) · [Index](README.md) · [Next: E76 — A cost and capacity model you can change →](E76-frontend-cost-and-capacity-engineering.md)
