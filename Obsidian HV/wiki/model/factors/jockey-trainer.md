# Jockey & Trainer Factors

**Variables:** `jf` (jockey), `tf` (trainer)  
**Status:** Active — known leverage issue, see below

---

## What They Measure

Historical win-rate advantage of the specific jockey/trainer relative to the overall base rate at Happy Valley.

## How They're Computed

**Career baseline:**
```
factor = (career_wins / career_rides) / base_win_rate
```

**Trailing override** — if the jockey/trainer has ≥ `TRAILING_MIN=10` rides in the last `TRAILING_DAYS=60` days, the trailing win rate replaces the career rate:
```
factor = (trailing_wins / trailing_rides) / base_win_rate
```

**Floor:** 0.20 (prevents a cold-streak zero from wiping out the horse's score entirely).

## Why Trailing Matters

Career stats bury current form. Example from May 13, 2026:
- Z Purton trailing (60-day): 11/36 = 30.6% win rate → factor **3.52×** (vs career 2.01×)
- K Teetan trailing (60-day): 0/24 = 0% win rate → factor **0.20×** (floor, vs career 1.08×)

## Known Issue: jf × tf Leverage {#jf-tf-leverage}

Top jockeys ride for top trainers — the factors are correlated in practice but the model treats them as independent. This creates `jf × tf` products up to **7.6×**, causing severe overconfidence in hot jockey/trainer combinations.

**Example (May 13 R7):** VIGOR EYE had 59.8% model win probability → finished P12.

**Recommended fixes (not yet implemented):**
1. Cap the combined product: `min(jf * tf, JT_CAP)` where `JT_CAP ≈ 3.0–4.0`
2. Geometric mean instead: `sqrt(jf * tf)` (halves the exponent effect)
3. Raise jockey/trainer floor from 0.20 to 0.40
4. Raise `TRAILING_MIN` from 10 to 20 (reduce noise in thin trailing windows)
5. Bayesian shrinkage on trailing factors toward career baseline

Each fix must be walk-forward tested independently before combining. See [[issues/known-issues]] for priority order.

## Side Effect: Horse Factor Inert

Because `jf × tf` dominates differentiation, `hf` (horse factor) is effectively 1.00 for most runners — it does no real work. Fixing leverage will allow `hf` and other factors to contribute meaningfully.

## Related Pages

[[model/architecture]] · [[factors/horse]] · [[issues/known-issues]]
