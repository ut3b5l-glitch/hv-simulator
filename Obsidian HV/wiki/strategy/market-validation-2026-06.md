# Market Validation & Commercial Strategy (June 2026)

Strategy synthesis off the external **Market Demand Validation Report** (Manus AI, 7 Jun 2026, project root: `Market Demand Validation Report_ Hong Kong Horse-Racing Prediction iOS App.md`). Cross-referenced against what is actually built ([[web/pwa]], the consumer fork `web-consumer/`, and the live [[performance/live-meetings]] record). Context: investor + horse-owner meeting **Tuesday (week of 2026-06-08)**.

## The verdict in one line

The report independently **validates the pivot we already made**: don't sell profit, sell a transparent, compliance-first, HK-specific race-reading companion with an honest public scorecard. The consumer fork (`web-consumer/`) already implements ~70% of its product recommendations. The opportunity is rated **"moderately attractive but execution-sensitive"** — a niche paid-information product, not a mass app. Proceed to **commercial validation** (prove willingness to pay), not full-scale launch.

Price: **HKD $30–60/mo is credible**; anchor experiments at **HKD $48/mo**. Comparable paid tip services (RaceAlpha, HKHitman, Winning Edge) often charge more.

## What we're doing right (report validates)

- **Information/entertainment-only positioning** — the spine of the consumer fork ("not a tipping service. We never tell you to bet"). The report's #1 mandate.
- **HK-specific models for BOTH Happy Valley and Sha Tin** — the report's named defensible wedge ("not generic global racing tips"). We have it; most competitors don't.
- **Transparent public performance ledger** — the report's single most-emphasized trust feature. We've gone deeper than it imagines (calibration, Brier, win-edge, honest "no edge" messaging).
- **Honesty about not being a profit engine** — the report repeatedly warns against "guaranteed winners"; our whole story is the opposite. See [[performance/walkforward]] and the win-edge finding (model has real ranking skill, loses to the ~17.5% takeout — sellable as transparency, not profit).
- **Beautiful race-day UX with a natural cadence** — the Zokki rebrand, verdict pills, narratives, signal chips.
- **Removing betting P&L / value ROI / raw factor multipliers from the consumer app** — correct on two counts: compliance-cleaner (betting returns read as gambling facilitation) and our ROI is honestly negative anyway.

## Two things the report gets WRONG for us (we're better than it thinks)

1. **Our PWA is a compliance MOAT, not a limitation.** The report was briefed as an "iOS App" study, so it flags **App Store rejection (Medium-High)** and **Apple's 30% IAP cut** among its top non-gambling risks. Both evaporate because we ship a PWA with web payments: no Apple gambling review at all, and 100% of subscription revenue retained. **Do not rush a native iOS app.** PWA-first IS the mitigation.

2. **The report's legal section is incomplete for us.** It worries about gambling-facilitation and Apple. But our actual #1 legal blocker is **HKJC data rights** — we scrape racecards, odds, results. That's a database-right / ToS / copyright exposure the report never mentions (it didn't know we scrape). Its reassuring "information-only app is defensible" can give false comfort. **The legal review must lead with data-sourcing, then gambling.** This is the real September-launch blocker.

## The single biggest credibility risk: the "63%" rests on 3 live meetings

The report is emphatic: an accuracy claim must specify **sample size, date range, exclusions, and a baseline comparison**, and the public ledger needs **~6–8 meetings** to earn trust.

- Our "top pick top-3 ≈ 63%" headline rests on **3 live HV meetings / 27 races** (2026-05-13, -05-27, -06-03). The ST cards in the PWA (2024-11-09, 2026-05-31) are **backtests/demos**.
- **Inconsistency to fix:** demo meetings are excluded from the consumer headline but still feed the **lifetime aggregates** elsewhere — exactly the ambiguity the report says "invites skepticism."
- The consumer Track Record shows sample size (good) but **dropped the baseline comparison** (vs favourite, vs random) when WinEdge was stripped — and baseline-vs-claim is precisely what makes a number credible.

**Strategic implication:** the highest-leverage credibility lever is **time** — accumulate live meetings. Until the live sample is ~6–8, **lead marketing with transparency, not the number** ("every pick, wins and misses, nothing hidden" — which the Track Record already does). The first genuinely-live Sha Tin meeting (2026-06-07, weekend cron's first fire) starts compounding the credible sample.

## Pricing & product tiering — the two apps ARE the tiers

The report recommends Free / Starter $38 / Pro $68–88 / Race-day pass $8–18. **We have already built the two paid tiers as two apps** — this is a strong investor story (the upsell path exists in code today):

| Tier | Price (anchor) | Product | Audience |
|---|---|---|---|
| Free | $0 | One race/meeting + public Track Record | Awareness, trust-building |
| **Starter** | **~$48/mo** | **The consumer fork** (`web-consumer/`) — verdicts, narratives, signal chips, full Track Record | Casual fans, light punters |
| **Pro** | **~$88/mo** | **The heavy-analytic app** (`web/`) — calibration, win-edge, betting returns, value bets, factor internals, deep simulator | Serious handicappers, data-driven bettors |
| Race-day pass | $8–18/day | Single-meeting access | Subscription-reluctant / occasional |

**Decision (user, 2026-06-07):** keeping the heavy-analytic version is important — unlock it as the **premium (Pro) tier** for serious bettors willing to pay more. This is a roadmap item (post-Tuesday), not a Tuesday deliverable. The architecture already supports it (two separate Next apps, shared design system, shared data pipeline `export_data.py` → `export_consumer.py`).

## Build / Remove / Defer

**BUILD (before Tuesday):**
1. **Fix the credibility hole** (B) — lock one metric definition; exclude demos from ALL aggregates (or separate them everywhere); add date-range + "excludes scratches/incomplete data" wording; **restore a consumer-grade baseline line** ("top pick beats backing the favourite by X; vs random Y%") from existing `win_edge.json` / `edge_backtest.py` numbers, in plain English.
2. **Landing page + waitlist** (the report's literal #1 validation experiment) — bilingual-ready, sample race cards, **HKD $48/mo anchor**, email capture, "reserve beta access." Built on the existing brand kit + real-app screenshots. This is the actual gate between "promising" and "proven."

**KEEP REMOVED / DON'T BUILD YET:**
- Betting P&L / value ROI out of the consumer app (compliance + honestly negative).
- **No native iOS app** — PWA is the compliance moat.

**DEFER (post-Tuesday, per user):**
- **Premium (Pro) tier unlock** of the heavy-analytic app — roadmap.
- **Bilingual TC + EN** — the report's one hard product requirement; the consumer fork is currently English-only (verified: zero i18n). Largest single build; scope right after the landing page proves a paying audience.
- **Thin compliance layer** — 18+ age gate, formal disclaimer, responsible-gambling resource (Ping Wo Fund), "not affiliated with HKJC" notice. Cheap; removes two Medium-High risks. (Bring forward if it can land before Tuesday cheaply.)
- **In-app subscriptions / Stripe / paywall** — validate the $48 anchor via waitlist FIRST.
- **GTM content engine** — YouTube race previews + post-race accuracy reviews, Telegram community, landing-page SEO/ASO. The report's main acquisition channels; follows the landing-page test.
- **Legal review** scoped data-rights-first.

## Tuesday execution sequence (this session)

- **A** — this strategy note + log + index (DONE on commit).
- **B** — credibility fix on the consumer Track Record (metric lock + demo exclusion + baseline line).
- **C** — landing-page spec → build the bilingual-ready waitlist landing page (the investor centerpiece). Design direction: **existing `Zokki · Logo — Print.pdf` brand kit is sufficient** — no new kit; hero = real-app screenshots + navy→mint gradient treatment + OG image.

## Sources

- External report: `Market Demand Validation Report_ Hong Kong Horse-Racing Prediction iOS App.md` (project root).
- Live record: [[performance/live-meetings]], [[performance/walkforward]], [[overview]].
- Honest-edge finding: win-edge backtest (model ranks above the favourite, loses to takeout) — see [[overview]] and `edge_backtest.py` / `win_edge.json`.
