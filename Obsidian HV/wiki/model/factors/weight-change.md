# Weight-Change Factor

**Variable:** `wcf`  
**Status:** Active (Phase 4D)

---

## What It Measures

The change in allocated weight (lbs) versus the horse's previous race. In HKJC's handicap system, this is a proxy for rating momentum — also **opposite to Western convention**.

## HKJC-Specific Direction

In Western racing, gaining weight is a negative signal (heavier burden). In HKJC, weight is allocated by official rating — gaining weight means the handicapper assigned a higher rating (the horse ran well last time). Losing weight means the rating dropped.

## Empirical Calibration

Computed from 5,229 transitions with a prior weight in DB:

| Weight change | Place rate | Factor |
|---|---|---|
| Drop 5+ lbs | 26.4% | **1.00** (noise — no reliable signal) |
| Drop 1–4 lbs | 24.0% | **0.90** |
| Unchanged | 26.7% | 1.00 (baseline) |
| Add 1–4 lbs | 34.2% | **1.28** ← strongest signal |
| Add 5+ lbs | 28.3% | **1.06** |

Coverage: 79% of entries have a prior weight to compare against.

The non-monotonicity at large drops (returns to 1.00 rather than penalising further) reflects that a big weight concession sometimes signals deliberate class/distance targeting, not pure rating decline.

## Walk-Forward Result (Phase 4D)

| Metric | 4B/4C baseline | 4D | Delta |
|---|---|---|---|
| #1 pick win rate | 14.1% | 15.3% | **+1.2%** |
| #1 pick place rate | 35.6% | 37.3% | **+1.7%** |
| Top-3 precision | 32.6% | 32.2% | −0.4% (noise) |
| VB ROI | −12.6% | **−1.4%** | **+11.2%** |

The VB ROI jump is the standout result — from −12.6% to near break-even in one factor addition. The cumulative gain across all Phase 4 sub-phases vs original: +4.5pp place rate, +11.9pp VB ROI.

## Relationship to Class Factor

`cf` and `wcf` capture the same underlying signal (official rating direction) from different angles:
- `cf` captures class-threshold crossings (e.g. Class 3 → Class 2)
- `wcf` captures within-class rating micro-adjustments

They are not fully redundant — a horse can gain weight without changing class (small rating nudge within the class band) or change class without a large weight swing.

## Notes

- `wcf = 1.00` (neutral) for horses with no prior HV run.
- Weight delta is computed from `weight` in `race_entries` vs the most recent prior race.

## Related Pages

[[model/architecture]] · [[factors/class]] · [[performance/walkforward]]
