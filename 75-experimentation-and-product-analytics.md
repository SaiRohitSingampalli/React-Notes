# 75 — Experimentation and Product Analytics

> An experiment platform is a measuring instrument. If nobody has calibrated it, every decision made with it is a guess with a p-value attached.

**Prerequisites:** [62 CI/CD, Release Engineering and Feature Flags](62-cicd-release-engineering-and-feature-flags.md), [39 Web Performance and Core Web Vitals](39-web-performance-and-core-web-vitals.md), [41 Observability and Diagnostics](41-observability-and-diagnostics.md) · **Related:** [05 Networking, Caching and Delivery](05-networking-caching-and-delivery.md) · [48 Next.js Rendering and Caching](48-nextjs-rendering-and-caching.md) · [78 Business Cases](78-business-cases-and-investment-arguments.md)

> [!NOTE]
> Results marked *verified* come from a small dependency-free library I wrote and tested for this chapter (six `node:test` tests): hashing-based assignment, sample-size and significance calculations, a sample-ratio-mismatch check and a simulation of 2,000 A/A tests.

---

## TL;DR

- **Experimentation is architecture.** Assignment, exposure logging, metric pipelines and performance guardrails are frontend platform concerns, and principal engineers are expected to own them.
- **Test your bucketing.** The first assignment function written for this chapter, plain FNV-1a over `experiment:user`, put 29% of users in *control of one experiment and treatment of another* but only 20% in both controls: two supposedly independent experiments were correlated. A 32-bit finalizer fixed it (*verified*).
- **Small effects need big samples.** At a 4% conversion rate, detecting a 5% relative lift needs about 154,000 users per arm; a 20% lift needs about 10,000 (*verified*).
- **Peeking breaks the statistics.** In 2,000 simulated A/A tests checked daily for 20 days, 25.5% looked "significant" at some point, against 5.1% with one planned look (*verified*).
- **Check the sample ratio before reading results.** A 50,000 / 49,000 split in a planned 50/50 test has p = 0.0015: something in the pipeline is broken, and the results can't be trusted (*verified*).
- **Frontend specifics decide trust:** assign on the server or at the edge (no flicker), log exposure when the variant renders, keep caches correct per variant, and treat INP, LCP, CLS and error rates as guardrails for every experiment.

---

## 1. Why this is a principal engineer's problem

Product teams own hypotheses and decisions. The platform underneath is engineering:

| Layer | Owner | What goes wrong without care |
|---|---|---|
| Assignment | Frontend platform | Correlated experiments, users switching variants, flicker |
| Exposure logging | Frontend platform | Diluted effects, biased samples |
| Delivery (SSR, CDN, bundles) | Frontend architecture | Wrong variant served from cache, both variants shipped to everyone |
| Event pipeline and schema | Data platform with frontend | Missing or duplicated events, PII in analytics |
| Metric definitions | Data science | Three definitions of "conversion" |
| Decision rules | Product and data science | Peeking, cherry-picked segments, no guardrails |

A principal frontend engineer doesn't need to be a statistician. They need to make the first three layers trustworthy, and to recognise when the last three are being misused.

---

## 2. Anatomy of a well-designed experiment

Write this before the experiment starts, and don't change it afterwards:

| Element | Example |
|---|---|
| Hypothesis | Showing delivery dates on product cards increases add-to-bag rate |
| Unit of randomisation | Logged-in user ID (anonymous ID for logged-out traffic) |
| Primary metric | Add-to-bag rate per user |
| Guardrails | Checkout conversion, INP and LCP p75, JavaScript error rate, revenue per user |
| Minimum detectable effect | 5% relative lift |
| Sample size and duration | From the calculation in section 5, rounded up to whole weeks |
| Decision rule | Ship if the primary metric improves at α = 0.05 and no guardrail degrades beyond its threshold |

The pre-registered decision rule is the part teams skip, and it's the part that prevents most bad decisions.

---

## 3. Assignment

Assignment must be **deterministic** (the same user always gets the same variant), **uniform** (the split matches the plan) and **independent across experiments** (being in one experiment's treatment says nothing about another's). Hashing the experiment key with the user ID provides all three, if the hash mixes its bits well:

```js
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
```

The finalizer is there because of a measured bug. Without it, 100,000 users assigned to two experiments, `checkout-cta` and `search-ranking`, landed like this (*verified*):

| Cell (checkout-cta / search-ranking) | Without finalizer | With finalizer |
|---|---|---|
| control / control | 20,299 | 24,992 |
| control / treatment | 29,342 | 25,073 |
| treatment / control | 29,232 | 25,037 |
| treatment / treatment | 21,127 | 24,898 |

Without the finalizer, the high bits of FNV-1a's output depend on the experiment-key prefix in a correlated way, so experiments that share users interfere with each other, and neither one's result means what it claims. Any hash can have this class of problem in some configuration. The lesson isn't "use this hash"; it's **test assignment the way you'd test a measuring instrument:** split balance, stability and independence between experiments, before any experiment relies on it.

Where to assign:

| Where | Flicker | Cache-friendly | Notes |
|---|---|---|---|
| In the browser after load | Yes: the control renders, then swaps | Yes | Causes layout shift and biases early interactions; avoid for visible UI |
| At the edge or in the proxy | No | Yes, with the variant in the cache key | Set a cookie with the assignment; render the variant on the server |
| In the server render | No | Only if the cache varies by variant | Pass the assignment down; never re-assign on the client |
| In the API (server-side experiments) | No | — | For ranking, pricing and other logic changes |

Two identity details cause most "users saw both variants" bugs: logging in (an anonymous ID becomes a user ID) and multiple devices. Decide which ID is the unit before the experiment starts, and keep the anonymous assignment for the session in which someone logs in.

---

## 4. Exposure, not assignment

Log an exposure when the user actually sees the variant: the component rendered, the element became visible. Assigning everyone who loads the site, when only 10% reach the page that changed, dilutes the effect tenfold and makes the experiment ten times as expensive to detect.

```tsx
// Log exposure once per user and experiment, when the variant is actually on screen
function Experiment({ name, variant, children }: { name: string; variant: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { trackExposure(name, variant); observer.disconnect(); }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [name, variant]);
  return <div ref={ref} data-experiment={name} data-variant={variant}>{children}</div>;
}
```

The rule that keeps exposure logging unbiased: **both variants must log exposure under the same conditions.** If the treatment logs when visible and the control logs on load, the populations differ, and the sample-ratio check in section 7 will usually catch it.

---

## 5. Sample size and duration

```js
const Z_975 = 1.959963984540054, Z_80 = 0.8416212335729143;          // two-sided alpha 0.05, power 0.8

/** Users needed per arm to detect a relative lift in a conversion rate (two-proportion z-test). */
export function sampleSizePerArm(baseline, relativeLift, zAlpha = Z_975, zBeta = Z_80) {
  const p1 = baseline, p2 = baseline * (1 + relativeLift), pBar = (p1 + p2) / 2;
  const n = (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  return Math.ceil(n);
}
```

For a 4% baseline conversion rate (*verified*):

| Relative lift to detect | Users per arm | With 20,000 eligible users a day, split 50/50 |
|---|---|---|
| 20% (4.0% → 4.8%) | 10,317 | About 1 day; run a full week anyway |
| 10% (4.0% → 4.4%) | 39,475 | About 4 days; run one week |
| 5% (4.0% → 4.2%) | 154,304 | About 15.5 days; run three weeks |

Halving the effect you want to detect roughly quadruples the sample. That one fact settles many arguments: most UI changes have small effects, so most organisations can run fewer experiments than they think, on fewer pages. Run whole weeks, because weekday and weekend users differ, and decide the duration in advance.

---

## 6. Peeking

The tempting practice: check the dashboard every day and stop when it says "significant". The simulation: 2,000 A/A tests (both arms identical, 5% conversion, 1,000 users per arm per day), checked daily for 20 days (*verified*):

| Decision procedure | False positive rate |
|---|---|
| One look at the planned end | 5.1% |
| Stop at the first daily look with p < 0.05 | 25.5% |

A quarter of experiments with *no effect at all* would have shipped as wins. If teams need to monitor and stop early, use a method designed for it (sequential testing with always-valid confidence intervals, or group-sequential boundaries) and make the platform enforce it; don't rely on discipline.

Peeking for *harm* is different and good: guardrail checks that stop an experiment breaking checkout or INP should run continuously (section 8).

---

## 7. Sample ratio mismatch

Before reading any result, check that the split matches the plan:

```js
/** Sample-ratio-mismatch check: chi-square with one degree of freedom against the planned split. */
export function srmP(countA, countB, expectedShareA = 0.5) {
  const total = countA + countB, eA = total * expectedShareA, eB = total - eA;
  const chi2 = (countA - eA) ** 2 / eA + (countB - eB) ** 2 / eB;
  return erfc(Math.sqrt(chi2 / 2));
}
```

A 50,000 / 49,000 split looks close to 50/50, but its p-value is 0.0015 (*verified*). With that much traffic, a 1% imbalance is very unlikely to be chance, and it means some users are missing from one arm for a reason: exactly the users whose absence biases the result. Common causes in frontends:

- The treatment crashes or redirects before exposure is logged.
- Bot filtering or ad blockers affect one variant's code path more than the other's.
- A cached page serves one variant to users assigned to the other.
- Exposure is logged under different conditions in each variant (section 4).

Platforms should check sample ratios automatically and hide results until the check passes.

---

## 8. Performance guardrails

Every experiment changes code, and some changes slow the page down. Tag real-user monitoring with the active variants and treat Web Vitals as guardrail metrics:

| Guardrail | Threshold example | Action |
|---|---|---|
| INP p75 in the treatment | > 10% worse than control | Alert; stop if sustained for 24 hours |
| LCP p75 | > 10% worse | Alert; stop if sustained |
| CLS p75 | > 0.05 worse | Stop: usually flicker or late-loading variant content |
| JavaScript errors per session | Any significant increase | Stop automatically through the flag ([62](62-cicd-release-engineering-and-feature-flags.md)) |
| Initial JavaScript | Larger than control by > 5 kB gzip | Fix before launch: code-split the variant |

Shipping both variants to everyone doubles the code for the experiment's surface. Load the variant's code on demand, and remove the losing variant and its flag within a sprint of the decision; experiment flags are the fastest-growing kind of flag debt.

---

## 9. Caching and rendering with experiments

Variants and caches interact badly by default:

- **`Vary: Cookie` destroys a CDN's hit rate,** because every cookie combination becomes its own cache entry. Instead, assign at the edge and put only the variant in the cache key, or route to variant-specific cached paths.
- **A cached server render can serve the wrong variant.** If a page is cached for everyone, its variant must be chosen after the cache (in a client component that already has the assignment cookie, or in an edge function), not inside the cached render.
- **Never re-assign on the client after server rendering.** Hydration with a different variant is a mismatch, a flicker and an SRM in one bug.
- **Experiments on cached Next.js pages** need the variant outside the `'use cache'` scope or as part of its arguments, so it becomes part of the cache key ([48](48-nextjs-rendering-and-caching.md)).

---

## 10. Product analytics architecture

| Concern | Practice |
|---|---|
| Event schema | Typed and versioned events (`checkout_started` v3), generated into TypeScript so instrumentation can't drift from the schema |
| One source of metric definitions | A semantic layer or metrics catalogue; dashboards and experiments read the same definitions |
| Consent | Analytics that needs consent waits for it; experiments still assign, but only consented users are measured, and that's part of the design |
| Privacy | No personal data in event properties; user IDs pseudonymous; retention limits |
| Delivery | Batch events, send them with `sendBeacon` or `fetch` with `keepalive` on page hide, and deduplicate on the server with event IDs |
| Data quality | Monitors for volume drops, schema violations and duplicate rates, per release |

---

## 11. Traps that statistics alone won't catch

- **Network effects.** In marketplaces and collaborative products, treated users affect control users. Randomise by cluster (a team, a market) instead of by user.
- **Novelty and primacy effects.** New things get clicked because they're new. Look at the effect over time, not only the total.
- **Multiple comparisons.** Twenty metrics at α = 0.05 will produce a "significant" one by chance. Name one primary metric in advance.
- **Segment fishing.** "It won for Safari users in Germany" is a hypothesis for the next experiment, not a result.
- **Long-term effects.** Keep a small, long-lived holdout group for major features, so you can measure what a year of changes added up to.

---

## Decision framework

**Problem:** deciding whether, and how, to test a change.

**Constraints:** traffic on the affected surface, the size of effect that would matter, the risk of the change, and whether it's reversible.

| Situation | Approach |
|---|---|
| A risky change with enough traffic to detect a meaningful effect | A/B test with guardrails |
| A risky change without enough traffic | Ship behind a flag with a staged rollout and guardrails; measure before and after, and treat the result as weak evidence |
| A bug fix or an accessibility fix | Ship it; don't test whether fixing things is good |
| A change whose effect would be too small to detect | Decide on judgement, or test a bolder version of the idea |
| Ranking, pricing or recommendation logic | Server-side experiment, often with clustered randomisation |

**Criteria:** detectable effect at your traffic, reversibility, and the cost of being wrong.

**Failure modes:** client-side assignment with flicker, exposure logged differently per variant, peeking, ignoring SRM, results without guardrails, and experiments nobody ever cleans up.

**Migration path:** build trust first. Run A/A tests on the platform, check SRM automatically, add Web Vitals guardrails, and only then scale the number of experiments.

---

## Pitfalls and anti-patterns

- **A bucketing function nobody has tested.** Ours correlated two experiments until a finalizer was added.
- **Assigning everyone, exposing a few.** Dilution makes experiments slower and less sensitive.
- **Stopping when it looks significant.** A quarter of no-effect tests "win" with daily peeking.
- **Reading results with a sample ratio mismatch.** The result is biased by whatever caused the mismatch.
- **Client-side swaps of visible UI.** Flicker, layout shift and biased early behaviour.
- **`Vary: Cookie` on cached pages.** The CDN effectively stops caching.
- **Both variants in everyone's bundle, forever.** Code-split variants and delete losers promptly.

---

## Architect's checklist

- [ ] Assignment is deterministic, tested for balance, stability and independence, and runs on the server or at the edge.
- [ ] Exposure is logged when the variant renders, under the same conditions in every variant.
- [ ] Every experiment has a written hypothesis, primary metric, guardrails, sample size, duration and decision rule.
- [ ] SRM is checked automatically and blocks results.
- [ ] RUM is tagged with variants; INP, LCP, CLS and errors are guardrails with automatic stops.
- [ ] Caches key on the variant, never on whole cookies.
- [ ] Variant code is split; losing variants and their flags are removed within a sprint.
- [ ] A/A tests run on the platform at least quarterly.

---

## Interview angles

**Q: How would you design the frontend side of an experimentation platform?**
A: Deterministic assignment at the edge or on the server, hashed from the experiment key and user ID with a hash I've tested for balance and cross-experiment independence; the assignment passed to the server render and stored in a cookie so the client never re-assigns; exposure logged when the variant renders; variants code-split; RUM tagged with variants so Web Vitals are guardrails; and automatic SRM checks before anyone sees results.

**Q: The treatment won by 2% after three days. Ship it?**
A: Not yet. I'd check whether three days was the planned duration and whether the sample was sized to detect 2%, check the sample ratio, look at the guardrails, and see whether the effect is stable or front-loaded by novelty. If people looked daily and stopped when it went green, the false positive rate is closer to 25% than 5%.

**Q: What's a sample ratio mismatch, and why does it matter?**
A: The arms' sizes differ from the planned split by more than chance allows: 50,000 against 49,000 has p ≈ 0.0015. It means users are missing from one arm for a reason, often a crash, a redirect, a cache or different exposure logging, and those missing users bias the result. Fix the cause before reading any metric.

**Q: How do experiments interact with CDN caching and server rendering?**
A: Badly, unless designed for. Varying on cookies destroys hit rates, and a cached render can serve the wrong variant. Assign at the edge, put only the variant in the cache key, keep the variant out of cached server scopes or make it part of their key, and never re-assign during hydration.

**Q: How do you protect performance while running many experiments?**
A: Treat Web Vitals and error rates as guardrails on every experiment, with automatic stops through the flag system; code-split variant code; budget the bundle per variant; and delete losing variants quickly, because experiment flags accumulate faster than any other kind.

---

## Further reading

- Ron Kohavi, Diane Tang and Ya Xu, *Trustworthy Online Controlled Experiments* (2020): the standard reference.
- Aleksander Fabijan and others, "Diagnosing Sample Ratio Mismatch in Online Controlled Experiments" (KDD 2019).
- Evan Miller, ["How Not To Run an A/B Test"](https://www.evanmiller.org/how-not-to-run-an-ab-test.html): the peeking problem.
- [OpenFeature](https://openfeature.dev/): the flag API that experiments can build on.

---

[← Previous: 74 — Machine-Coding Drills](74-machine-coding-drills.md) · [Index](README.md) · [Next: 76 — Frontend Cost and Capacity Engineering →](76-frontend-cost-and-capacity-engineering.md)
