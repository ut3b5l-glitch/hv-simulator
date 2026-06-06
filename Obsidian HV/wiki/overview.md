# Overview

A private Hong Kong horse racing prediction engine for **Happy Valley (HV) night meetings**. Predicts the top-3 finishers, flags value bets, and tracks paper trade performance.

**Stack:** Python 3 + SQLite core. Next.js / Vercel PWA for mobile.  
**Primary goal:** Reliable top-3 placement predictions — a structured shortlist, not a guaranteed system.  
**Live since:** May 13, 2026.  
**Mobile PWA — "Zokki" (since 2026-05-28; rebranded + light visual overhaul 2026-06-06):** https://hv-simulator.vercel.app — see [[web/pwa]]

---

## Current Status

**Phases complete:** A, B, 1, 2, 3, 4A, 4B, 4C, 4D, **5 (market blend — live)**, **ST venue (Sha Tin — backtested & integrated 2026-06-06)**  
**In progress:** Phase 4E (integration & final validation)  
**Next major phase:** Phase 5 (ML) — not before November 2026

### Second venue: Sha Tin (ST)

The DB is now **two-venue** — 614 HV + 1,307 ST races (see [[data/database]]).
The same engine validates on Sha Tin with a *larger* edge over the market than
HV (#1-WIN ROI gap **+3.24 pts** vs +1.79; disagree-with-favourite pocket
**+14.5%** ROI). Per-venue blend coefficients (`blend_coef_ST.json`) and the ST
`win_edge` block are live in the PWA Win-Edge panel. ST historical predictions
are backtested only — there is **no live ST racecard/odds automation yet**
(weekend Sha Tin meetings are not on the Wednesday HV cron). See
[[performance/walkforward#sha-tin-st-second-venue-validated-2026-06-06]].

---

## Performance — Market Blend (Phase 5, live)

The model now **anchors to the betting market** (see [[model/market-blend]]) —
the single biggest accuracy lift in the project. Walk-forward over the 204 most
recent races (leak-free, train-before-each-meeting, `validate_blend.py`):

| Ranker | #1 win | #1 place (top-3) | top-3 precision | coverage |
|---|---|---|---|---|
| Old factor model | 13.7% | 34.3% | 34.2% | 36.8% |
| **Market-blend (live)** | 27.5% | **~60%** | 50.3% | 59.3% |
| Market favourite (ceiling) | 27.9% | 61.3% | 51.0% | 58.8% |

- "Top pick lands top-3 >=60%": **met** (~60%; market ceiling 61%).
- "Top-3 precision >=60%": **above the ~52% mathematical ceiling** for HV's
  ~11.5-horse fields — unreachable even with perfect probabilities. See
  [[model/market-blend]].

## Walk-Forward Performance — pure factor baseline (Phase 4D, 177 races)

| Metric | Phase 4D | Pre-4A Baseline | Delta |
|---|---|---|---|
| Top-3 precision | 32.2% | 33.3% | −1.1% (noise) |
| #1 pick win rate | **15.3%** | 13.0% | **+2.3%** |
| #1 pick place rate | **37.3%** | 32.8% | **+4.5%** |
| Coverage (winner in top-3) | 37.3% | 39.5% | −2.2% |
| Value bet ROI | **−1.4%** | −13.3% | **+11.9%** |
| Random baseline | 25.7% | — | — |

Fold 4 (most recent, Apr 2026): top-3 precision **40.7%**.

The top-3 precision regression vs baseline is statistical noise (±4 pp at 177 races). The operationally important metrics — #1 pick quality and value bet ROI — improved substantially.

---

## Live Meeting Performance

| Meeting | Top-3 Precision | Value Bets | Notes |
|---|---|---|---|
| 2026-05-13 | **51.9%** (14/27) | +6.7% ROI | Debut; R2+R5 perfect; jf×tf failures R6-R9 |
| 2026-05-27 | **22.2%** (6/27) | 0/14 won, 3 placed | Worst night; 4 complete misses; extreme jf×tf overconfidence |
| 2026-06-03 | **51.9%** (14/27) | none flagged | Special between-week mtg; first true live blend run; #1 win 44.4%, place 55.6%; R5 perfect; only R4 0/3. See [[performance/live-meetings#2026-06-03]] |

**3-meeting average: 42.0%** (34/81) vs 32.2% walk-forward and 25.7% random baseline.

June 3 was the **first genuinely live outing for the Phase 5 market-blend** (May 13/27 were blend-scored retroactively) and it tied the best night to date — #1-pick win 44.4% vs the ~28% market-favourite expectation. The blend has dissolved the old jf×tf overconfidence (it anchors to de-vigged market prob). Standing operational risk: the 7am racecard cron **failed silently** on this meeting day — see [[web/dynamic-pull-plan]] for the unattended-pull fix.

May 27 post-mortem (pre-blend-era failure mode): HONEST WITNESS was 84.1% model win vs 3.5 market odds (~28%). 4 races went 0/3. jf×tf leverage produced epistemically unjustified certainty. See [[issues/known-issues#jf-tf-leverage]] and [[performance/live-meetings#2026-05-27]].

---

## What's Next

### Phase 4E (immediate)
1. Monte Carlo convergence check on 2–3 recent races (`race_simulator.py --mc`)
2. Dashboard factor breakdown verification — confirm Class F and Wt Chg F display correctly
3. Update `walkforward_test.py` header string (still reads "Phase A")

### Phase 5 (November 2026)
XGBoost/LightGBM evaluation. Prerequisite: ~26 live meetings of Phase B data (official_rating, days_since_last_run, last_6_runs). Do not start earlier.

### Ongoing (each Wednesday meeting)
- Wednesday morning: `python3 wednesday_agent.py` (auto via cron)
- Race day ~6pm HKT: `python3 hkjc_odds.py --date YYYY-MM-DD` (manual, HK IP required)
- Post-race: `python3 results_agent.py` (auto via cron)

See [[workflow/operations]] for full commands.

---

## Critical Known Issues

1. **jf x tf leverage** — **RESOLVED (Phase 5)**: the market-blend logit fits jockey+trainer jointly with the market, driving the trainer coefficient to ~0 so the correlated pair is no longer double-counted. See [[issues/known-issues]] and [[model/market-blend]].
2. **Going factor inactive** — re-enable after 2+ full seasons of data.
3. **racing.hkjc.com Playwright blocked** — wednesday_agent auto-falls back to GraphQL via bet.hkjc.com.

See [[issues/known-issues]] for full list.
