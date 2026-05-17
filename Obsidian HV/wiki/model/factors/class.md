# Class Factor

**Variable:** `cf`  
**Status:** Active (Phase 4B)

---

## What It Measures

Whether the horse is running in a higher, same, or lower class than its previous race. In HKJC, this is a momentum signal — the direction is **opposite to Western racing**.

## HKJC-Specific Direction

In Western racing, rising class is typically a negative signal (horse faces tougher opposition). In HKJC:

- **ROSE** (higher class than prior race) → **positive** signal. The handicapper raised the horse's official rating — it earned the step up.
- **SAME** → neutral.
- **DROPPED** (lower class) → **negative** signal. The handicapper lowered the rating — the horse has been disappointing.

## Empirical Calibration

Computed from 578 HV races in DB:

| Transition | Runs | Place rate | Factor |
|---|---|---|---|
| ROSE | 325 | 36.3% | **1.33** (36.3 / 27.3) |
| SAME | 4,363 | 27.3% | 1.00 (baseline) |
| DROPPED | 541 | 23.3% | **0.85** (23.3 / 27.3) |
| No prior data | — | — | 1.00 |

## Walk-Forward Result (Phase 4B)

| Metric | 4A baseline | 4B | Delta |
|---|---|---|---|
| #1 pick win rate | 13.6% | 14.1% | +0.5% |
| #1 pick place rate | 33.3% | 35.6% | **+2.3%** |
| Top-3 precision | 33.1% | 32.6% | −0.5% (noise) |
| VB ROI | −13.8% | −12.6% | +1.2% |

Assessment: the small precision regression is likely partial overlap with the form factor (both capture momentum). Net effect is clearly positive — #1 place rate improvement of +2.3pp is the primary use-case metric.

## Notes

- `cf = 1.00` (neutral) for horses with no prior HV run — no class comparison available.
- Class transition is determined by comparing `race_class` of the current race vs the horse's most recent completed race in the DB.
- Class 1 = top tier; Class 5 = bottom. ROSE means a lower class number.

## Related Pages

[[model/architecture]] · [[factors/weight-change]] · [[performance/walkforward]]
