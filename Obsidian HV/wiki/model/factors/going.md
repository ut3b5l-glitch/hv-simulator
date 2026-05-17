# Going Factor

**Variable:** `gf`  
**Status:** Built, inactive (Phase 4C)

---

## What It Measures

Each horse's historical win rate on the current going (track condition), relative to its overall win rate. The idea: some horses genuinely prefer firm or soft ground.

## Implementation

Infrastructure exists in `model_core.py`:
- `_going_factor()` method
- `horse_going` and `going_base_rate` populated in `build_stats()`
- `going` parameter accepted in `score_race()`
- All callers wired

Going strings from the DB are mapped internally:
- `'GOOD TO FIRM'` → FIRM
- `'GOOD'` → GOOD
- `'GOOD TO YIELDING'` → SOFT

`GOING_M = 5` phantom runs for Bayesian shrinkage (same pattern as horse factor).

## Why It's Inactive

Walk-forward test showed a severe regression when `gf` was active (Phase 4C):

| Metric | 4B baseline | With gf active | Delta |
|---|---|---|---|
| #1 win rate | 14.1% | 11.9% | −2.2% |
| #1 place rate | 35.6% | 35.0% | −0.6% |
| Coverage | 38.4% | 36.2% | −2.2% |
| Precision | 32.6% | 31.8% | −0.8% |
| VB ROI | −12.6% | **−27.8%** | **−15.2%** |

VB ROI collapse from −12.6% to −27.8% was the decisive signal. Root cause: **insufficient data per horse**.

- Field-level place rates by going are essentially flat: FIRM 25.8%, GOOD 26.0%, SOFT 25.1%
- The apparent horse-level signal (128 horses with >15% divergence across going groups) is sampling noise
- Binomial std dev for 10 FIRM runs at 25.8% base = ±13.8% — meaning >15% divergence is *expected by chance*
- Average horse has only 0.3 SOFT entries (437 entries across 1,416 horses)

## When to Reactivate

After 2+ full HV seasons of data accumulate (post-2026). At that point, re-run the walk-forward with `gf` active and evaluate. The infrastructure is ready — just need to add `gf` back into the multiplicative chain in `score_race()`.

## Going Distribution in DB (as of May 2026)

| Going | Race count |
|---|---|
| GOOD | ~370 |
| GOOD TO FIRM | ~163 |
| GOOD TO YIELDING | ~37 |
| Empty / NULL | ~8 |

## Related Pages

[[model/architecture]] · [[data/database]] · [[issues/known-issues]]
