# 76 — Frontend Cost and Capacity Engineering

> Nobody gets promoted for a smaller bill, but plenty of architectures get cancelled because of a bigger one. Know what your frontend costs before finance asks.

**Prerequisites:** [05 Networking, Caching and Delivery](05-networking-caching-and-delivery.md), [48 Next.js Rendering and Caching](48-nextjs-rendering-and-caching.md), [50 Next.js in Production](50-nextjs-in-production.md) · **Related:** [41 Observability and Diagnostics](41-observability-and-diagnostics.md) · [60 Monorepos and Build Tooling](60-monorepos-build-tooling-and-bundlers.md) · [68 Case Study: Storefront](68-case-study-ecommerce-storefront.md) · [78 Business Cases](78-business-cases-and-investment-arguments.md)

> [!NOTE]
> The cost model in this chapter uses **illustrative unit prices, not vendor quotes**; replace them with your contracts. Results marked *verified* are measurements I ran: React 19.3.1 server rendering in Node 22, and a Next.js 16.4.6 production server under load on a 2-vCPU machine, plus the model's own arithmetic, checked by tests.

---

## TL;DR

- **Know the bill's shape.** For a cached, server-rendered storefront, the model's biggest lines were session replay, CDN egress and requests, and real-user monitoring. Origin compute was a rounding error at about $146 of a $58,886 month.
- **Sampling and bytes are the big levers.** Recording 1% of sessions instead of 10% saved $27,000 a month; cutting page weight from 1.0 to 0.65 MB saved $5,250. All four optimizations together took the month from $58,886 to $21,149, 64% less (*verified* arithmetic, illustrative prices).
- **The cache hit ratio is a capacity lever more than a cost lever.** Going from 95% to 99% barely changed the bill, but it cut peak origin load fivefold. A full purge at peak needs **20 times** the normal origin capacity (13.9 against 0.69 busy vCPUs).
- **React's render is rarely the cost.** Rendering a 500-row page took a median 0.46 ms; a whole Next.js request for a small product page used 6.2 ms of server CPU (*verified*). Frameworks, data fetching and I/O dominate. Measure your real routes.
- **Don't serve static files from Node.** A 229 KB chunk compressed on the fly cost 8.3 ms of CPU per request (*verified*). Precompress at build time and serve assets from a CDN.
- **Plan capacity with Little's law:** busy workers = arrival rate × time per request. Provision for peak with headroom, not for the average.

---

## 1. What a frontend costs

| Cost line | Driver | Main levers |
|---|---|---|
| CDN egress | Bytes per page view × page views | Image formats and sizes, fewer and smaller scripts, compression |
| CDN requests | Requests per page view | Fewer assets, longer cache lifetimes, sprites and inlining where sensible |
| Origin compute (SSR, RSC, API routes) | Cache misses × CPU per request, provisioned for peak | Cache hit ratio, cheaper renders, static generation |
| Edge functions | Invocations × duration | Keep edge work small: assignment, redirects, headers |
| Image optimization | Transformations × CPU | Cache transformed images; limit sizes and formats |
| Observability | RUM events, session replays, logs, traces, metric cardinality | Sampling, retention tiers, cardinality limits |
| CI and previews | Build minutes, preview environments | Remote caching, affected-only builds, preview expiry |
| Third-party SaaS | Seats, monthly active users, events | Contract tiers, event volume, consolidation |

Two habits make this manageable: **a unit cost** (dollars per thousand page views, or per monthly active user), so growth and efficiency are distinguishable, and **an owner per line**, so someone notices when it moves.

---

## 2. A cost model you can run

```js
// cost-model.mjs: a monthly cost and capacity model for a server-rendered storefront.
// Unit prices are ILLUSTRATIVE ASSUMPTIONS, not quotes: replace them with your own contracts.
export const ASSUMED_PRICES = {
  cdnEgressPerGB: 0.05,
  cdnRequestsPerMillion: 0.75,
  vcpuHour: 0.05,
  rumEventsPerMillion: 2.0,
  replaySessionsPerThousand: 3.0,
  logsPerGB: 0.5,
};

const HOURS_PER_MONTH = 730, SECONDS_PER_MONTH = 30 * 86_400;

export function model(s, price = ASSUMED_PRICES) {
  const avgViewsPerSecond = s.pageViews / SECONDS_PER_MONTH;
  const peakViewsPerSecond = avgViewsPerSecond * s.peakToAverage;
  const renders = s.pageViews * (1 - s.htmlHitRatio);                 // cache misses reach the origin
  const peakRendersPerSecond = peakViewsPerSecond * (1 - s.htmlHitRatio);
  // Little's law: busy vCPUs = arrival rate × CPU time per request. Provision for peak, with headroom.
  const peakBusyVcpus = peakRendersPerSecond * (s.cpuMsPerRender / 1000);
  const provisionedVcpus = Math.max(s.minVcpus, Math.ceil(peakBusyVcpus * s.headroom));
  const cost = {
    cdnEgress: (s.pageViews * s.mbPerView / 1000) * price.cdnEgressPerGB,
    cdnRequests: (s.pageViews * s.requestsPerView / 1e6) * price.cdnRequestsPerMillion,
    origin: provisionedVcpus * HOURS_PER_MONTH * price.vcpuHour,
    rum: (s.pageViews * s.rumEventsPerView / 1e6) * price.rumEventsPerMillion,
    replay: (s.sessions * s.replaySampleRate / 1000) * price.replaySessionsPerThousand,
    logs: (renders / 1e6) * s.logGBPerMillionRenders * price.logsPerGB,
  };
  const total = Object.values(cost).reduce((a, b) => a + b, 0);
  return { avgViewsPerSecond, peakViewsPerSecond, peakRendersPerSecond, peakBusyVcpus, provisionedVcpus, cost, total };
}
```

The scenario is the storefront from [68](68-case-study-ecommerce-storefront.md): 300 million page views and 100 million sessions a month, a peak three times the average, and 40 ms of CPU per origin render (an assumption for a data-heavy page; section 4 shows how to measure yours).

| Input | Baseline | Optimized |
|---|---|---|
| Page weight per view | 1.0 MB | 0.65 MB (modern image formats, right-sized images, smaller scripts) |
| Requests per view | 45 | 30 |
| HTML cache hit ratio | 95% | 99% (tag-based invalidation instead of short TTLs) |
| RUM events per view | 6 | 2.5 (Web Vitals for everyone; other events sampled) |
| Session replay sampling | 10% | 1% (plus sessions with errors) |

Results (*verified* arithmetic):

| Monthly cost | Baseline | Optimized |
|---|---|---|
| CDN egress | $15,000 | $9,750 |
| CDN requests | $10,125 | $6,750 |
| Origin compute (minimum 4 vCPUs) | $146 | $146 |
| Real-user monitoring | $3,600 | $1,500 |
| Session replay | $30,000 | $3,000 |
| Logs | $15 | $3 |
| **Total** | **$58,886** | **$21,149** |

And each change on its own, to see which levers matter:

| Change alone | Monthly saving |
|---|---|
| Session replay 10% → 1% | $27,000 |
| Page weight 1.0 → 0.65 MB | $5,250 |
| Requests per view 45 → 30 | $3,375 |
| RUM events per view 6 → 2.5 | $2,100 |
| Cache hit ratio 95% → 99% | $12 |

With your prices the ranking may differ, which is the point of having a model: it turns "observability is expensive" into "this line is 51% of the bill, and here's the lever".

---

## 3. What the model teaches

1. **Origin compute is small for a well-cached site.** You provision a floor for redundancy, and at a 95% hit ratio the peak uses less than one vCPU. Arguments about which server framework is cheaper rarely matter at this scale; bytes and observability do.
2. **You pay for provisioned peak, not for average use.** Capacity sits idle most of the month. Serverless pricing changes that trade-off (pay per request, but per-request prices are higher and cold starts add latency); model both before choosing.
3. **The cache hit ratio is a resilience number.** It barely moved the bill, but it determines how much origin capacity a cache failure or a purge suddenly needs (section 5).
4. **Unit costs reveal waste that totals hide.** $58,886 for 300 million views is about $0.20 per thousand page views. If that number rises while traffic is flat, something changed in what each page costs.

---

## 4. Capacity planning

**Little's law:** the average number of requests in a system equals the arrival rate multiplied by the average time each spends in it. For CPU-bound rendering, the time that matters is CPU time:

| Quantity | Formula | Storefront at peak |
|---|---|---|
| Peak page views per second | monthly views ÷ seconds per month × peak-to-average | 115.7 × 3 = 347 |
| Origin renders per second | views per second × (1 − hit ratio) | 17.4 at 95%; 3.5 at 99% |
| Busy vCPUs | renders per second × CPU seconds per render | 17.4 × 0.040 = 0.69 |
| Provisioned vCPUs | busy vCPUs × headroom, at least the redundancy floor | max(4, 0.69 × 2) = 4 |

The input that matters is **CPU per request for your real route**, and it isn't React's render time. Two measurements (*verified*, on a 2-vCPU Xeon at 2.1 GHz):

| What was measured | Result |
|---|---|
| `renderToString` of a 500-row page, React 19.3.1 | Median 0.46 ms, p95 1.36 ms (33 KB of HTML) |
| A complete Next.js 16.4.6 request for a small product page (partially prerendered, price streamed) | 6.2 ms of server CPU per request; 173 requests per second with 16 concurrent clients |

The framework request cost thirteen times as much CPU as React's render of a far bigger page, before any real data fetching. Measure with a load test against a production build, and count server CPU time per request rather than trusting latency alone:

```js
// load.mjs (excerpt): closed-loop load, with the server's CPU time read from /proc
const before = cpuTicks(), t0 = Date.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (Date.now() < end) {
    const t = performance.now();
    const r = await fetch(url); await r.arrayBuffer();
    latencies.push(performance.now() - t);
  }
}));
const cpuSeconds = (cpuTicks() - before) / 100;                   // 100 ticks per second on Linux
console.log({ rps: latencies.length / ((Date.now() - t0) / 1000), cpuMsPerRequest: cpuSeconds * 1000 / latencies.length });
```

Rules of thumb for the plan:

- **Headroom of at least 2×** at the expected peak, more for launches and sales you can't predict.
- **N+1 or more instances per region,** so losing one doesn't overload the rest.
- **Model the events that change the hit ratio:** deploys that change cache keys, purges, new markets and flash sales of uncached products.
- **Load-test the slowest route,** not the home page.

---

## 5. The thundering herd

When a cache empties, every request becomes an origin request at once. In the model, a full purge at peak takes the origin from 17.4 to 347 renders per second: 13.9 busy vCPUs against 0.69, **twenty times the normal load**, on infrastructure provisioned with 4.

Mitigations, roughly in order of value:

1. **Purge by tag, not everything** ([48](48-nextjs-rendering-and-caching.md)). One product's change should invalidate one product's pages.
2. **`stale-while-revalidate`.** Serve the stale copy while one request refreshes it, so the origin sees one revalidation per URL instead of one request per user.
3. **Request coalescing at the CDN or origin shield,** so concurrent misses for the same URL wait for one origin response.
4. **Staggered or rate-limited purges** when a large purge is unavoidable.
5. **Pre-warming** the most popular pages after a deploy that changes cache keys.
6. **Load shedding** at the origin: return a cached or simplified page instead of queueing until everything times out.

---

## 6. Static assets and compression

The second measurement in section 4 has a twin: a 229 KB JavaScript chunk served by the Next.js server, compressed on the fly to 71.8 KB, cost **8.3 ms of CPU per request**, more than the dynamic page (*verified*).

- **Precompress at build time** (Brotli and gzip) and serve the precompressed files.
- **Serve `/_next/static` (or your build's asset folder) from a CDN** with `Cache-Control: public, max-age=31536000, immutable`; the origin should see each asset once per CDN location.
- **Turn off on-the-fly compression in the Node server** when a CDN or reverse proxy in front of it compresses responses.

---

## 7. Images

Image optimization is CPU-heavy and, as 2026's advisories showed, security-sensitive: four Next.js advisories that year involved image handling ([A3](A3-security-advisories-timeline.md)).

- Cache transformed images at the CDN with long lifetimes, keyed by width, format and quality.
- Limit the widths and formats you generate, so the cache isn't fragmented into thousands of variants.
- Restrict remote image sources to an allowlist.
- At scale, move image transformation to a dedicated image service or CDN feature rather than the application server.

---

## 8. Observability costs

| Signal | Cost driver | Practice |
|---|---|---|
| RUM | Events per view | Keep Web Vitals for every page view (they're what you're judged on); sample the rest |
| Session replay | Sessions recorded | Sample a small percentage, and capture sessions with errors or rage clicks on demand |
| Traces | Spans per request | Tail-based sampling: keep slow and failed traces, sample the healthy ones |
| Metrics | Cardinality (label combinations) | Never put user IDs, URLs with IDs or free text in metric labels |
| Logs | Volume and retention | Structured logs, levels that mean something, short retention for debug logs |

Sampling changes what you can see, so decide it with the people who debug production: they need every error and every slow request, not every healthy one.

---

## 9. CI and preview environments

- **Remote caching** of builds and tests (Turborepo or Nx, [60](60-monorepos-build-tooling-and-bundlers.md)) cuts both minutes and waiting.
- **Affected-only runs** in a monorepo: test what a change can break.
- **Preview environments expire** after the pull request closes, or after a few days of inactivity.
- **Track CI minutes per team** the same way as production costs; they grow quietly.

---

## 10. Cost as an engineering practice

- **Unit economics** on a dashboard: cost per thousand page views, per monthly active user and per deploy, next to traffic.
- **Tags on every resource** (team, product, environment), so costs can be attributed.
- **Budgets with alerts** per line, and a monthly review of the top movers.
- **Cost in design reviews:** an ADR that adds a server-rendered route, a new region or a new observability tool includes its expected monthly cost and its unit cost ([63](63-architecture-governance-and-adrs.md)).
- **Showback before chargeback:** show teams their costs for a few months before billing them, so they can act on the data first.

---

## Decision framework

**Problem:** choosing where and how to render and deliver, with cost and capacity in mind.

**Constraints:** traffic and its peaks, freshness and personalisation requirements, the team's ability to operate servers, and existing contracts.

| Option | Cost profile | Capacity profile | Fits |
|---|---|---|---|
| Static generation behind a CDN | Egress and requests only | Almost unlimited | Content that changes rarely |
| Cached server rendering (tags, stale-while-revalidate) | Small origin, mostly CDN | Sensitive to hit ratio and purges | Storefronts, content sites |
| Uncached server rendering per request | Origin scales with traffic | Provision for peak | Personalised pages, dashboards |
| Edge rendering | Per-invocation pricing | Scales out, limited runtime | Light personalisation near users |
| Client-side rendering from a CDN | Egress, plus API costs | API capacity is the limit | Authenticated apps without SEO needs |

**Criteria:** unit cost at your traffic, behaviour under a cache failure, operational burden.

**Failure modes:** provisioning for the average; purge-all invalidation; static assets served by Node; unsampled session replay; high-cardinality metrics; nobody owning the bill.

**Migration path:** measure first (unit costs and the model), then take the levers in order of saving per unit of effort: sampling, bytes, cache strategy, then compute.

---

## Pitfalls and anti-patterns

- **Optimizing the smallest line.** Server framework debates while replay costs half the bill.
- **Average-based capacity.** Peaks, purges and launches are what take sites down.
- **`purge all` as the invalidation strategy.** A self-inflicted thundering herd.
- **Static assets through the application server.** CPU spent compressing the same file again and again.
- **User IDs in metric labels.** Cardinality explodes, and so does the bill.
- **Preview environments that never die.**
- **Unit prices copied from a blog post.** Use your contracts; prices and discounts vary widely.

---

## Architect's checklist

- [ ] A cost model with our real prices, updated quarterly.
- [ ] Unit costs (per thousand views, per active user) on a dashboard next to traffic.
- [ ] Every cost line has an owner and a budget alert.
- [ ] CPU per request measured for the slowest routes, under load, on production builds.
- [ ] Capacity provisioned for peak with headroom and N+1; purge and launch scenarios modelled.
- [ ] Tag-based invalidation, stale-while-revalidate and request coalescing in place.
- [ ] Static assets precompressed and served from a CDN with immutable caching.
- [ ] Observability sampling and cardinality limits agreed with the people who debug production.
- [ ] Expected cost included in ADRs that add infrastructure.

---

## Interview angles

**Q: How would you estimate the infrastructure cost of a new server-rendered storefront?**
A: Build a small model: page views, sessions and peak-to-average; bytes and requests per view for CDN costs; cache hit ratio and CPU per render for origin capacity, provisioned for peak with headroom; and event volumes for observability. Then plug in our contract prices and look at which line dominates. In my model for 300 million monthly views, origin compute was under 1% of the bill and session replay was half of it.

**Q: What happens if someone purges the whole CDN cache at peak?**
A: Every request becomes an origin request. In the model, origin renders went from 17 to 347 per second, twenty times the busy CPU, on capacity provisioned for a fraction of that. Prevent it with tag-based purges, stale-while-revalidate, request coalescing at the CDN, staggered purges and load shedding.

**Q: How do you measure server capacity for a React framework?**
A: Load-test the slowest real route on a production build and measure server CPU time per request, not just latency. React's own render is usually a small part of it: a 500-row page rendered in under half a millisecond, while a complete Next.js request for a small page cost about 6 ms of CPU. Then apply Little's law: busy CPUs equal requests per second times CPU seconds per request.

**Q: Where would you look first to cut a frontend's observability bill?**
A: Session replay sampling, high-cardinality metric labels, and debug log retention, in that order for most teams. Keep Web Vitals and errors for every user, sample healthy sessions and traces, and agree the sampling with the people who are on call.

**Q: Serverless or long-running servers for server rendering?**
A: It depends on the traffic shape and the cache. Serverless suits spiky, low-average traffic and removes capacity planning; long-running servers are cheaper for steady load and avoid cold starts. With a high cache hit ratio the origin is small either way, so I'd decide on latency, operations and the cost model rather than on principle.

---

## Further reading

- [FinOps Foundation: the FinOps Framework](https://www.finops.org/framework/).
- [MDN: `Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control), including `stale-while-revalidate` and `immutable`.
- [Next.js: self-hosting](https://nextjs.org/docs/app/guides/self-hosting): caching, image optimization and the build output.
- [web.dev: image performance](https://web.dev/learn/performance/image-performance).
- John D. C. Little, "A Proof for the Queuing Formula: L = λW" (1961).

---

[← Previous: 75 — Experimentation and Product Analytics](75-experimentation-and-product-analytics.md) · [Index](README.md) · [Next: 77 — Hiring, Leveling and Org Design →](77-hiring-leveling-and-org-design.md)
