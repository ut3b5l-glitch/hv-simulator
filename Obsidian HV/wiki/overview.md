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
| 2026-06-07 **(ST)** | **36.4%** (12/33) | none flagged | **First live Sha Tin meeting** (11 races); #1 win 18.2%, place 45.5% — on ST baselines; all 4 bet strategies lost (short-priced winners). Surfaced 3 automation bugs (now fixed). See [[performance/live-meetings#2026-06-07]] |
| 2026-06-10 | **48.1%** (13/27) | none flagged | Strong HV night; #1 win 33.3% (3/9), place 55.6%; R8 perfect 1-2-3 sweep; R9 TARGET AUDIENCE WIN @ $43. First green betting night (Win +60%, Quinella box +22%). 23:00 cron truncated at R8 (R9 not yet posted) — re-run pulled all 9. See [[performance/live-meetings#2026-06-10]] |
| 2026-06-13 **(ST)** | **54.5%** (18/33) | none flagged | Best top-3 night of the live era; two perfect sweeps (R1, R7). But #1 win only 18.2% (2/11) — both winners short → Win-on-#1 −70%; only Q-Place box green (+11.4%). Card half-settled on the night (R1–R5); R6–R11 pulled 2026-06-19. See [[performance/live-meetings#2026-06-13]] |
| 2026-06-24 | **44.4%** (12/27) | none flagged | Longshot-heavy card (6/9 winners ≥ $42, incl. $151.5 + $133.5 bombs); weakest live HV top-3 but #1 win 3/9 (33.3%) all well-priced → **Win-on-#1 +61.7%**, Place +13.3% (2nd straight green HV WIN night); Quinella box −44.6%. R9 truncation recurred (3rd time) — manual re-run pulled all 9. See [[performance/live-meetings#2026-06-24]] |

**HV 5-meeting average: 43.7%** (59/135); **ST 2-meeting average: 45.5%** (30/66). Both vs 32.2% walk-forward and 25.7% random baseline. Honest consumer headline across all 7 live meetings: **44.3%** (89/201).

> **Reconciliation note (2026-06-19):** the raw `predictions_*.json` for 2026-05-13, 2026-05-27 and 2026-06-07 had been overwritten by post-meeting re-scores against closing odds (the May meetings batch-regenerated 2026-05-30; June 7 during same-night bug-recovery), inflating their app-reported top-3 to 59.3% / 40.7% / 45.5%. The figures in this table are the **contemporaneous live records** and are now what the PWA + Zokki consumer app publish — `export_data.py` re-ranks those three meetings to the live picks at export time (raw sources untouched). The honest consumer headline is **44.3%** (77/174) over 6 live meetings. See [[issues/known-issues]].

June 3 was the **first genuinely live outing for the Phase 5 market-blend** (May 13/27 were blend-scored retroactively) and it tied the best night to date — #1-pick win 44.4% vs the ~28% market-favourite expectation. The blend has dissolved the old jf×tf overconfidence (it anchors to de-vigged market prob). Standing operational risk: the 7am racecard cron **failed silently** on this meeting day — see [[web/dynamic-pull-plan]] for the unattended-pull fix.

**June 7 — first live Sha Tin meeting.** The venue-aware weekend pipeline (built 2026-06-06) ran its first real card. Model accuracy landed exactly on ST backtest baselines (#1 win 18.2% vs 19.8%, place 45.5% vs 45.3%), confirming the ST integration scores correctly live — but every bet strategy lost because both winners were short favourites. The first cron fire also exposed three bugs (zsh word-split silently no-opping all runs; `results_agent` off-by-one dropping R11; reconcile slots too early for a Sunday card) — all fixed same-day; meeting recovered manually. See [[issues/known-issues]] and [[performance/live-meetings#2026-06-07]].

**June 10 — best HV night of the live era** (top-3 48.1%, #1 win 33.3%). R8 returned a perfect 1-2-3 sweep and R9's TARGET AUDIENCE won at a $43 dividend, giving the first clearly profitable betting night (Win-on-#1 +60%, Quinella box +22%) — and two of the three winning #1 picks were not the shortest favourite, so the model beat the market, not just rode it. Operational note: the 23:00 auto-reconcile stopped at R8 because R9 (last race) had not posted results yet; the probe `break`s on the first missing race, so a delayed final race truncates the card. Recovered by a manual re-run. See [[issues/known-issues]] and [[performance/live-meetings#2026-06-10]].

**June 24 — weak precision, strong WIN payout.** A chalk-unfriendly card (top-3 just 44.4%, the softest live HV night) where the model's three #1 winners — ROSEWOOD FLEETFOOT $32, ALL ARE MINE $42, SKY CAP $71.5 — were all generously priced, so flat Win-on-#1 returned +61.7% (a second consecutive green HV WIN night) and Place was also green (+13.3%). The card's two bombs (BLOSSOMY $151.5, DEFINITIVE $133.5) and four other ≥$42 winners broke the Quinella box (−44.6%). No value bets flagged. The R9-truncation bug recurred for the **third** time (also 06-10, 06-13) — the fix is now overdue. See [[issues/known-issues#reconcile-before-last-race-posts]] and [[performance/live-meetings#2026-06-24]].

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
