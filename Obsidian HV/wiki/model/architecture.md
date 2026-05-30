# Model Architecture

All factor logic lives in `model_core.py` — single source of truth. Never duplicate in other files.

---

## How It Works

Nine multiplicative factors produce a raw score for each horse. Scores are L1-normalised to win probabilities, then fed into the Harville formula to derive place and show probabilities.

```
raw_score = bf × jf × tf × hf × ff × rf × df × cf × wcf
win_probs = L1_normalise(raw_scores)
place/show = harville(win_probs)
```

---

## Active Factors

| # | Factor | Variable | Description | Page |
|---|---|---|---|---|
| 1 | Barrier IV | `bf` | Win-rate index per (distance_m, course_config, barrier) | [[factors/barrier]] |
| 2 | Jockey | `jf` | Career win rate ÷ base rate; trailing 60-day override if ≥10 rides | [[factors/jockey-trainer]] |
| 3 | Trainer | `tf` | Same trailing logic as jockey | [[factors/jockey-trainer]] |
| 4 | Horse | `hf` | Bayesian exact-trip, m=10 phantom runs, class-specific prior, floor 0.50 | [[factors/horse]] |
| 5 | Form | `ff` | Recency-weighted last-5 DB runs (decay=0.60); overridden by `last_6_runs` HTML | [[factors/form]] |
| 6 | Rating | `rf` | `exp(0.02 × Δrating)`; live racecards only | [[factors/rating-days]] |
| 7 | Days | `df` | Piecewise freshness by days since last run; live racecards only | [[factors/rating-days]] |
| 8 | Class | `cf` | Class transition vs prior race: ROSE/SAME/DROPPED | [[factors/class]] |
| 9 | Weight-Change | `wcf` | Weight delta vs prior race | [[factors/weight-change]] |

### Removed / Inactive

| Factor | Status | Reason |
|---|---|---|
| Raw weight (`avg_field / horse_weight`) | Removed Phase 4A | Noise — HKJC handicap system equalises weights |
| Going | Built, inactive (Phase 4C) | Insufficient data (avg 0.3 SOFT entries/horse across 37 SOFT races). Re-enable post-2026. |

---

## Key Constants

```python
HORSE_M        = 10      # phantom runs for Bayesian horse factor
FORM_RUNS      = 5       # last N runs for form factor
FORM_DECAY     = 0.60    # exponential recency decay
EDGE_THRESHOLD = 5.0     # minimum edge % for value bet
MIN_MODEL_PCT  = 10.0    # minimum model win % for value bet
TRAILING_DAYS  = 60      # trailing window for jockey/trainer
TRAILING_MIN   = 10      # minimum rides to use trailing stats
RATING_K       = 0.02    # exponent coefficient for rating factor
GOING_M        = 5       # phantom runs for going factor (inactive)
```

---

## Value Bet Criteria

A horse is flagged as a value bet when all three conditions hold:

```python
is_value = (edge > EDGE_THRESHOLD          # model_win > public_implied
            and model_win_pct > MIN_MODEL_PCT
            and rank <= 3)                 # within model's top-3
```

`edge = model_win_pct − public_implied_pct`  
`public_implied_pct = 100 / (public_odds + 1)`

---

## Public API (`model_core.py`)

```python
stats   = mc.build_stats(conn, before_date=None, venue='HV')
runners = mc.score_race(entries, stats, dist, cfg, race_class=None, going=None)
probs   = mc.harville_probs(win_probs_dict)
```

- `before_date=None` → use all data (live mode — correct for importer)
- `before_date='YYYY-MM-DD'` → strict cutoff (walk-forward — never leak future data)
- `going` is the raw DB string (e.g. `'GOOD TO FIRM'`); mapped internally to FIRM/GOOD/SOFT

---

## HKJC-Specific Notes

Factors 8 (class) and 9 (weight-change) behave **opposite to Western racing conventions**:
- Rising class → positive signal (HKJC assigned higher rating → more competitive)
- Gaining weight → positive signal (handicapper rewarded the horse)

Both signals reflect the same underlying momentum: the horse's official rating went up. Class factor captures class-threshold crossings; weight-change factor captures within-class rating micro-adjustments.

See [[factors/class]] and [[factors/weight-change]] for calibration details.


## Market blend (Phase 5)

`score_race` accepts `blend_coef`. When coefficients are supplied (live paths pass
`"auto"`, loading `blend_coef.json`) and every runner has odds, the factor-only
win probabilities are replaced by a race-grouped conditional-logit blend of the
de-vigged market probability and the log-factors, then fed to Harville as usual.
The market dominates (coef ≈1.0); jockey and class add a small tilt; everything
else ≈0. This is the production ranking. Full detail: [[market-blend]].
