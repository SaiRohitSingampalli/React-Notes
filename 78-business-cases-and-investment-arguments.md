# 78 — Business Cases and Investment Arguments

> Leadership doesn't fund architecture. It funds outcomes, with a believable path from the money to the outcome. A business case is that path, written down, with the assumptions on show.

**Prerequisites:** [72 The Principal Frontend Engineer](72-the-principal-frontend-engineer.md) (§4 strategy, §5 influence) · **Related:** [70 Case Study: Prism](70-case-study-enterprise-design-system.md) · [71 Case Study: Legacy Modernization](71-case-study-legacy-react-modernization.md) · [75 Experimentation](75-experimentation-and-product-analytics.md) · [76 Cost and Capacity](76-frontend-cost-and-capacity-engineering.md)

> [!NOTE]
> The worked example uses fictional inputs for Prism, the design system from [70](70-case-study-enterprise-design-system.md). The arithmetic (net present value, payback, sensitivity and break-even) is *verified* by a small tested model; the inputs are the kind you'd gather in your own organisation.

---

## TL;DR

- **Write the case as a one-page memo:** the ask, the problem in numbers, the options including doing nothing, costs, benefits, risks, how you'll measure, and when you'd stop.
- **Translate outcomes into money in four ways:** time saved (discounted, because not all saved time becomes useful work), revenue measured by experiments, costs avoided, and risk reduced (probability × impact).
- **Lead with net present value and payback, not internal rate of return.** In the worked example, the design system's three-year NPV was $1.41 million with payback in month 16; its IRR came out at 201%, a number that impresses and informs nobody (*verified*).
- **Find the assumption the case lives or dies on.** For Prism it was adoption: at 50% instead of 80%, the NPV turned negative (−$132,000) and the investment never paid back in three years. So the plan funds adoption: codemods, migration help, office hours (*verified*).
- **Show what would have to be true.** Break-even was 0.91 hours saved per product engineer per week, against an estimate of 2.5 (*verified*). Executives trust a case more when they can see how wrong it can be and still work.
- **Sequence work by cost of delay divided by duration.** In a three-initiative example, doing the most valuable item first cost $540,000 more in delay than ordering by that ratio.

---

## 1. Why principal engineers write business cases

The largest technical decisions (a design system, a migration, a platform team, a rendering architecture) compete for the same budget as product features. Without a case in the organisation's language, they lose to whatever has a revenue number attached, or they're funded on trust and cancelled at the first budget review.

A good case also improves the engineering: writing down benefits forces you to define how you'll measure them, and listing risks forces you to plan for the likely failure.

---

## 2. Anatomy of a business case

A one-page memo, with an appendix for the model:

| Section | Content |
|---|---|
| The ask | What you want, how much, and by when a decision is needed |
| The problem | What it costs today, in numbers: hours, incidents, conversion, deals, risk |
| Options | At least three, including doing nothing and a cheaper partial option |
| Costs | People, tools, infrastructure, opportunity cost (what won't be built instead) |
| Benefits | Each with its mechanism, its estimate and how it will be measured |
| Risks | What could make the benefits smaller or later, and the mitigations |
| Sensitivity | The assumptions the case depends on, and what would have to be true |
| Measures and kill criteria | Leading indicators, review dates, and the result that would make you stop |

The memo's first paragraph should stand alone: the recommendation, the cost, the expected return and the main risk. Many readers stop there.

---

## 3. Turning engineering outcomes into money

| Benefit type | How to estimate | How to keep it honest |
|---|---|---|
| Time saved | Hours saved per engineer per week × engineers × loaded hourly cost | Apply a capture rate (half is a common, defensible choice): saved time doesn't all become useful work |
| Revenue | Conversion or retention lift × traffic × value per conversion | Measure the lift with an experiment ([75](75-experimentation-and-product-analytics.md)) and use the lower end of its confidence interval |
| Cost avoided | Infrastructure, licences, vendor fees, incident costs no longer incurred | Use your own bills ([76](76-frontend-cost-and-capacity-engineering.md)), not list prices |
| Risk reduced | Probability of a loss × its impact, before and after | State both numbers and where they came from (audits, past incidents, legal advice) |
| Hiring and retention | Time to fill roles, attrition in affected teams | Usually supporting evidence, not the core of the case |

Two warnings. Don't borrow conversion uplift figures from other companies' case studies: their products, users and baselines aren't yours. And don't count the same benefit twice, for example counting both "faster delivery" and "engineering hours saved" when one causes the other.

---

## 4. A worked example: funding Prism

The inputs, gathered the way you would in your own organisation:

| Input | Value | Source |
|---|---|---|
| Build team, first year | 6 engineers | The plan |
| Run team, years two and three | 4 engineers | The plan |
| Loaded cost | $220,000 per engineer per year ($110 per hour) | Finance |
| Product engineers who'd use it | 180 | Org chart |
| UI time saved | 2.5 hours per engineer per week, half of it captured | A two-week time study in three teams |
| Adoption | Rising to 80% over 12 months | Comparable internal platform rollouts |
| Accessibility remediation avoided | $50,000 a month at full adoption | Last year's audit fix costs |
| Risk reduced | A 25% yearly chance of losing $2 million of deals, removed at full adoption | Sales: two deals blocked last year |
| Horizon and discount rate | 36 months, 10% a year | Finance's standard |

The model computes monthly net cash flow (benefits minus costs), then discounts it:

```js
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
```

The result (*verified*): a **three-year NPV of $1,411,966**, **payback in month 16**, a first-year net of −$285,633, and $85,800 of net benefit a month from month 13.

The internal rate of return came out at 201%. That's arithmetically correct and practically useless: IRR exaggerates when the early losses are small relative to later gains, and it invites the question "if it's that good, why are you only asking for six engineers?". Lead with NPV and payback.

### 4.1 What would have to be true

| Scenario | NPV (3 years) | Payback |
|---|---|---|
| Base case | $1,411,966 | Month 16 |
| Adoption only reaches 50% | −$131,906 | Not within 36 months |
| Only 1 hour saved per week | $80,110 | Month 31 |
| Adoption takes 24 months, not 12 | $543,313 | Month 27 |
| No risk reduction counted | $549,588 | Month 22 |
| All four pessimistic at once | −$1,756,856 | Never |

Break-even, with everything else at the base case: **0.91 hours saved per product engineer per week** (*verified*), against an estimate of 2.5.

Three conclusions go into the memo:

1. **The case survives a much smaller time saving.** Break-even needs a little over a third of the estimate.
2. **It doesn't survive low adoption.** At 50%, it loses money. Adoption is the real risk, so the plan funds it: codemods for every migration, Prism engineers opening pull requests for small teams, office hours and a usage scanner ([70](70-case-study-enterprise-design-system.md) §4.7).
3. **The risk reduction is a bonus, not the foundation.** Without it, the case still pays back in month 22.

Kill criteria follow from the same table: if adoption is below 30% at month 9, or the measured time saved is below one hour a week at month 12, the programme is reviewed and scaled back.

---

## 5. Sequencing: cost of delay

When several worthwhile initiatives compete for the same people, the order matters as much as the selection. Cost of delay is what each week without the outcome costs; dividing it by duration (sometimes called CD3) gives an order that minimises total delay cost:

| Initiative | Cost of delay per week | Duration | Cost of delay ÷ duration |
|---|---|---|---|
| A: Skew protection (support tickets and failed checkouts after deploys) | $30,000 | 4 weeks | 7.5 |
| B: Design system migration | $50,000 | 20 weeks | 2.5 |
| C: Image pipeline (CDN cost and LCP) | $12,000 | 2 weeks | 6.0 |

| Order | Delay cost until all three are done |
|---|---|
| A, C, B (by the ratio) | $1,492,000 |
| B, A, C (biggest first) | $2,032,000 |

Starting with the most valuable initiative costs $540,000 more, because two quicker wins wait twenty weeks behind it. Estimates of cost of delay are rough; the ordering is usually robust to that roughness, which is what makes the method useful.

---

## 6. Presenting it

- **Talk to the decision-makers before the meeting** ([72](72-the-principal-frontend-engineer.md) §5). The meeting should confirm a decision, not hold the first debate.
- **Lead with the ask and the one number to remember:** "six engineers for a year; pays back in month 16; the risk is adoption, and here's how we're managing it".
- **Show ranges, not false precision.** "$0.5–1.4 million over three years if adoption reaches 80%, and a loss if it stalls at 50%" is more credible than "$1,411,966".
- **Include the option you didn't choose,** and why: it shows the recommendation survived comparison.
- **Say what won't be built,** because someone in the room is already thinking it.
- **Offer a smaller first step** when the organisation is unsure: a three-month pilot with two teams and explicit success criteria.

---

## 7. After approval

- **Track the benefits you promised,** with the measures in the memo, and report them on the dates you set.
- **Report bad news early.** A case that's tracking behind with a credible recovery plan keeps its funding more often than one that surprises people at the annual review.
- **Use the kill criteria.** Stopping a programme that isn't working is a sign of good judgement, and it makes the next case easier to fund.
- **Write a short retrospective** comparing the case with what happened. It's the best way to calibrate your next estimates.

---

## Decision framework

**Problem:** deciding how much rigour a technical investment's case needs.

**Constraints:** the size of the investment, how reversible it is, how measurable its benefits are, and the organisation's habits.

| Investment | Case needed |
|---|---|
| Small and reversible (a tool, a spike, under a few engineer-weeks) | A paragraph in the RFC |
| Medium (a quarter of a team) | A one-page memo with the main assumptions |
| Large or hard to reverse (a platform team, a migration, a new architecture) | The full memo, a model, sensitivity analysis and kill criteria |
| Mandatory (security, legal) | The cost and the plan; the benefit is compliance, so focus on doing it efficiently |

**Criteria:** size × irreversibility × uncertainty.

**Failure modes:** a case with only a best case; benefits nobody will measure; borrowed industry figures; double counting; IRR as the headline; no kill criteria.

**Migration path:** start by attaching expected costs and measures to ADRs ([63](63-architecture-governance-and-adrs.md)), then write full cases for the two or three largest initiatives each year.

---

## Pitfalls and anti-patterns

- **The 100% capture assumption.** Saved hours don't all become output; discount them and say so.
- **Other companies' numbers.** Measure your own conversion effects with experiments.
- **Only a best case.** Show what would have to be true, and the scenario that breaks the case.
- **Precision theatre.** Ranges are more honest and more persuasive than seven-digit totals.
- **Forgetting adoption.** Platform benefits arrive only as fast as teams adopt the platform.
- **No kill criteria.** Programmes that can't fail can't be evaluated, and keep their budgets too long.
- **Biggest-first sequencing.** It maximises total delay when big items are slow.

---

## Architect's checklist

- [ ] The memo's first paragraph states the ask, cost, return and main risk.
- [ ] At least three options, including doing nothing.
- [ ] Every benefit has a mechanism, an estimate, a source and a measure.
- [ ] Time savings are discounted by a capture rate; revenue effects come from our own experiments.
- [ ] NPV and payback lead; sensitivity shows which assumption matters most.
- [ ] The plan funds the riskiest assumption (often adoption).
- [ ] Kill criteria and review dates are agreed before approval.
- [ ] Benefits are tracked and reported against the case afterwards.

---

## Interview angles

**Q: How would you get funding for a design system?**
A: A one-page memo with a model behind it: the cost of the team, and benefits from engineering time saved (discounted, since not all saved time becomes output), accessibility remediation avoided and deal risk reduced. Then sensitivity. In my model, the case survived a time saving of under one hour a week but failed at 50% adoption, so the plan funded adoption directly with codemods and migration help, and set kill criteria on adoption at month nine.

**Q: How do you put a value on performance work?**
A: Measure it on our own users. Run an experiment that changes performance alone, or analyse the relationship between performance and conversion in our RUM data, and use the lower end of the confidence interval for the case. I wouldn't use another company's published uplift; their baseline and users aren't ours.

**Q: Your platform programme is six months in and adoption is half the plan. What do you do?**
A: Report it now with the cause and a recovery plan, rather than at the annual review. Find out why teams aren't adopting (migration cost, missing features, trust), fund the fix, and if adoption still misses the kill criterion at the next review, scale the programme back. Stopping well is part of the job.

**Q: Three teams want your platform team's time for three different initiatives. How do you order them?**
A: By cost of delay divided by duration, after a rough estimate of each. Quick wins with high weekly cost go first; long initiatives, even valuable ones, wait. In one example, putting the biggest initiative first cost $540,000 more in total delay than ordering by the ratio.

**Q: Why not lead with ROI or IRR?**
A: They can mislead. IRR exaggerates when the early losses are small: our design system case had an IRR of 201%, which made it look like a typo. Net present value over an agreed horizon and the payback month are easier to compare and harder to misread, and the sensitivity table matters more than either.

---

## Further reading

- Donald Reinertsen, *The Principles of Product Development Flow* (2009): cost of delay and sequencing.
- Douglas Hubbard, *How to Measure Anything* (third edition, 2014): estimating "intangible" benefits.
- Nicole Forsgren, Jez Humble and Gene Kim, *Accelerate* (2018): delivery metrics that connect engineering to outcomes.
- Richard Rumelt, *Good Strategy/Bad Strategy* (2011): the strategy a case should serve.

---

[← Previous: 77 — Hiring, Leveling and Org Design](77-hiring-leveling-and-org-design.md) · [Index](README.md) · [Next: 79 — Distributed Systems Design for Frontend Architects →](79-distributed-systems-design-for-frontend-architects.md)
