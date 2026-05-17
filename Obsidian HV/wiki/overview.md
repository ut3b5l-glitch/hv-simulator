# Overview

A private Hong Kong horse racing prediction engine for **Happy Valley (HV) night meetings**. Predicts the top-3 finishers, flags value bets, and tracks paper trade performance.

**Stack:** Python 3 + SQLite. No external ML libraries in the core model.  
**Primary goal:** Reliable top-3 placement predictions — a structured shortlist, not a guaranteed system.  
**Live since:** May 13, 2026.

---

## Current Status

**Phases complete:** A, B, 1, 2, 3, 4A, 4B, 4C, 4D  
**In progress:** Phase 4E (integration & final validation)  
**Next major phase:** Phase 5 (ML) — not before November 2026

---

## Walk-Forward Performance (Phase 4D, 177 races)

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

### May 13, 2026 (9 races, first live meeting)

| Metric | Result |
|---|---|
| Top-3 precision | **51.9%** (14/27) — well above walk-forward avg |
| Value bet ROI | **+6.7%** (+1.2 units on 18 bets) |
| Perfect calls | R2 (3/3), R5 (3/3) |
| Weak calls | R6-R9 (1/3 each) |

Post-mortem: jf×tf leverage failures in R6-R9. See [[issues/known-issues#jf-tf-leverage]].

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

1. **jf×tf multiplicative leverage** — jockey and trainer factors are correlated but treated as independent. Products up to 7.6× cause overconfidence in top picks. Priority fix. See [[issues/known-issues]].
2. **Going factor inactive** — re-enable after 2+ full seasons of data.
3. **racing.hkjc.com Playwright blocked** — wednesday_agent auto-falls back to GraphQL via bet.hkjc.com.

See [[issues/known-issues]] for full list.
