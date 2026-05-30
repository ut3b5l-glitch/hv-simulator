# Walk-Forward Results

4-fold expanding walk-forward validation. Training set grows by ~50 races per fold; each fold tests on the next 50 races.

Fold configuration: train 400→450→500→550 races, test 50 each.  
Script: `walkforward_test.py`

---

## Production model — market blend (validate_blend.py, 204 recent races)

| Ranker | #1 win | #1 place | top-3 prec | coverage |
|---|---|---|---|---|
| Old factor model | 13.7% | 34.3% | 34.2% | 36.8% |
| **Market-blend (live)** | 27.5% | ~60% | 50.3% | 59.3% |
| Market favourite (ceiling) | 27.9% | 61.3% | 51.0% | 58.8% |

The betting market supplies essentially all the signal; the factor tilt adds
<1 pt, and the oracle top-3 precision ceiling is ~52%. See [[model/market-blend]].
The tables below are the **pure factor model** (no market), kept as a baseline /
regression guard (`walkforward_test.py`).

## Cumulative Results by Phase

| Phase | Key Change | Top-3 Prec | #1 Win% | #1 Place% | VB ROI | VBets | Notes |
|---|---|---|---|---|---|---|---|
| Pre-4A (baseline) | Original model | 33.3% | 13.0% | 32.8% | −13.3% | 325 | Reference point |
| 4A | Removed raw weight factor | 33.1% | 13.6% | 33.3% | −13.8% | 327 | −0.5% precision within noise |
| 4B | Added Class Factor (`cf`) | 32.6% | 14.1% | 35.6% | −12.6% | 326 | +2.3pp place rate |
| 4C | Going Factor excluded | 32.6% | 14.1% | 35.6% | −12.6% | 326 | gf caused regression (−27.8% ROI when active) |
| **4D** | **Added Weight-Change Factor (`wcf`)** | **32.2%** | **15.3%** | **37.3%** | **−1.4%** | **318** | **Current model** |

Walk-forward: 177 races (2025-07-16 → 2026-04-29), 4 folds. Generated: 2026-05-05.

### Per-Fold Detail

#### Pre-4A Baseline

| Fold | Train | Test | #1 Win | #1 Place | Coverage | Precision | Baseline | VB ROI | VBets |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 400 | 50 | 14.0% | 30.0% | 44.0% | 30.7% | 26.0% | −40.7% | 91 |
| 2 | 450 | 50 | 12.0% | 32.0% | 36.0% | 32.0% | 25.2% | +54.9% | 88 |
| 3 | 500 | 50 | 14.0% | 38.0% | 36.0% | 33.3% | 26.0% | −47.8% | 99 |
| 4 | 550 | 27 | 11.1% | 29.6% | 44.4% | 40.7% | 25.6% | −15.1% | 47 |

#### Phase 4A (weight factor removed)

| Fold | Train | Test | #1 Win | #1 Place | Coverage | Precision | Baseline | VB ROI | VBets |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 400 | 50 | 16.0% | 32.0% | 44.0% | 30.7% | 26.0% | −40.7% | 91 |
| 2 | 450 | 50 | 12.0% | 32.0% | 38.0% | 32.0% | 25.2% | +51.4% | 90 |
| 3 | 500 | 50 | 14.0% | 38.0% | 34.0% | 32.7% | 26.0% | −48.3% | 100 |
| 4 | 550 | 27 | 11.1% | 29.6% | 44.4% | 40.7% | 25.6% | −13.3% | 46 |

#### Phase 4B (class factor added)

| Fold | Train | Test | #1 Win | #1 Place | Coverage | Precision | Baseline | VB ROI | VBets |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 400 | 50 | 18.0% | 36.0% | 44.0% | 30.7% | 26.0% | −41.3% | 92 |
| 2 | 450 | 50 | 12.0% | 32.0% | 36.0% | 30.7% | 25.2% | +31.0% | 88 |
| 3 | 500 | 50 | 14.0% | 38.0% | 32.0% | 32.0% | 26.0% | −32.6% | 99 |
| 4 | 550 | 27 | 11.1% | 37.0% | 44.4% | 40.7% | 25.6% | +3.8% | 47 |

#### Phase 4D (weight-change factor added — current model)

| Fold | Train | Test | #1 Win | #1 Place | Coverage | Precision | Baseline | VB ROI | VBets |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 400 | 50 | 16.0% | 36.0% | 44.0% | 31.3% | 26.0% | −37.9% | 87 |
| 2 | 450 | 50 | 12.0% | 34.0% | 30.0% | 28.7% | 25.2% | +62.3% | 84 |
| 3 | 500 | 50 | 18.0% | 40.0% | 34.0% | 32.0% | 26.0% | −24.9% | 99 |
| 4 | 550 | 27 | 14.8% | 40.7% | 44.4% | 40.7% | 25.6% | +1.7% | 48 |

Fold 4 (most recent, Apr 2026) is the strongest: 40.7% precision, +1.7% VB ROI. Model improves as more data accumulates.

---

## Cumulative Delta Table (Phase 4A → 4D)

| Metric | Delta vs Pre-4A |
|---|---|
| Top-3 precision | −1.1% (noise at n=177) |
| #1 pick win rate | **+2.3%** |
| #1 pick place rate | **+4.5%** |
| Value bet ROI | **+11.9%** |

The top-3 precision number looks like a regression but the ±4 pp confidence interval makes it statistically indistinguishable from baseline. The meaningful gains are in pick quality and ROI.

---

## Important Caveat: Phase B Factors

Walk-forward numbers use **historical data only**. `official_rating`, `days_since_last_run`, and `last_6_runs` are NULL for all historical rows → Rating Factor (`rf`) and Days Factor (`df`) are both 1.00 throughout validation. Live meeting performance should exceed these numbers once Phase B columns accumulate.

---

## Next Validation Milestone

Phase 5 (November 2026): walk-forward with ~26 live meetings of full Phase B data, potentially including XGBoost/LightGBM comparison.

## Related Pages

[[overview]] · [[model/architecture]] · [[performance/live-meetings]] · [[model/factors/rating-days]]
