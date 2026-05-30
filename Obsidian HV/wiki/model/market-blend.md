# Market-Blend Combiner (Phase 5)

The single largest predictive signal in racing is the **betting market** itself.
Until Phase 5 the model ignored it — odds were used only to flag value bets, never
to estimate who would win. That is why the 9-factor chain barely beat random.

This page documents the market-blend combiner that fixes it: a race-grouped
**conditional logit** (the method Bill Benter used to beat exactly these Hong
Kong races) that fuses the de-vigged market probability with the model's
log-factors.

## The result that motivated it

Walk-forward over the 204 most recent HV races (leak-free, train-before-meeting,
via `validate_blend.py`):

| Ranker | #1 win | #1 place (top-3) | top-3 precision | coverage |
|---|---|---|---|---|
| Old factor model | 13.7% | 34.3% | 34.2% | 36.8% |
| **Market-blend (live)** | 27.5% | ~60% | 50.3% | 59.3% |
| Market favourite (ceiling) | 27.9% | 61.3% | 51.0% | 58.8% |

Reading: *just using the market* lifts #1-place from 34% to ~61% and precision
from 34% to ~51%. The factor tilt on top adds well under a point.

## How it works

For race *r* with runners *i*, utility and win probability are:

```
u_i      = Σ_k  beta_k · log(feature_{i,k})
P(win_i) = softmax_i(u)         # normalised within the race
```

Features (`model_core.BLEND_FEATURES`, in order):

| feature | source | fitted beta |
|---|---|---|
| `log_mkt` | log de-vigged market win prob (1/odds, renormalised) | **1.026** |
| `log_jf` | jockey factor | 0.081 |
| `log_cf` | class-transition factor | 0.046 |
| `log_ff` | form factor | 0.021 |
| `log_wcf` | weight-change factor | 0.015 |
| `log_tf` | trainer factor | 0.004 |
| `log_biv` | barrier IV | −0.003 |
| `log_hf` | horse exact-trip factor | **0.000** |
| `log_rtf` | rating factor (Phase B) | 0.000 |
| `log_df` | days factor (Phase B) | 0.000 |

The win probabilities feed the existing Harville formula for place/show, and the
runners are ranked by show% exactly as before.

### Why these coefficients are the honest answer

- **`log_mkt` ≈ 1.0** — the market is taken at full strength (slightly >1 is a
  mild favourite-longshot sharpening: favourites win a touch more than priced).
- **`log_tf` ≈ 0** — this dissolves the old [[known-issues|jf×tf overconfidence]]
  bug automatically. Jockey and trainer are collinear (top jockeys ride for top
  trainers) and both collinear with the market, so fitting them jointly drives
  trainer to ~0. No more 7.6× phantom products.
- **`log_hf` = 0.000** — confirms the horse exact-trip factor is inert. Harmless
  but useless; a candidate for replacement with a richer trip model.

## Regularisation: ridge toward the market

`train_blend.py` fits by Newton-Raphson with an L2 penalty toward the prior
`[1, 0, 0, …]`: the **market coefficient is shrunk toward 1** (keep the market at
full strength) and the **factor coefficients toward 0** (they only survive if
they earn predictive weight beyond the market). Default `L2 = 25`. Because the
factors carry little orthogonal signal in the current data, strong shrinkage is
correct — at low L2 the factors overfit and *hurt* out-of-sample accuracy.

## The ceiling — why 60% top-3 precision is impossible here

If the market's de-vigged Harville show-probabilities were perfectly calibrated
*truth*, the expected fraction of the three likeliest placers that actually
finish top-3 is only **~52%** on HV's average 11.5-horse fields (oracle bound,
computed in `diagnose.py`/`/tmp/ceil.py`). Racing's irreducible variance caps it
there. So:

- **"Top pick lands top-3 ≥60%"** — *met*. The favourite places ~61%; the blend
  rides it to ~60%.
- **"Top-3 precision ≥60%"** — *above the physical ceiling*. The best achievable
  is the low-to-mid 50s. Chasing 60% by ranking harder cannot work; only better
  *features* (sectional times, official ratings, detailed form) that beat the
  market on **win** probability can push the ceiling up — and the historical DB
  currently lacks them (sectionals/margins 0% populated, ratings 4%).

## Files

| File | Role |
|---|---|
| `model_core.py` | `score_race(..., blend_coef=...)`, `_blend_win_probs`, `load_blend_coef`, `_devig_market`, `BLEND_FEATURES` |
| `train_blend.py` | fit coefficients on all history → `blend_coef.json` |
| `blend_coef.json` | persisted coefficients (features, beta, L2, n_races, date) |
| `validate_blend.py` | canonical leak-free walk-forward: model vs market vs blend |
| `benter_blend.py` | earlier experiment: blendA (market+model) vs blendB (full) |
| `diagnose.py` | market-vs-model benchmark + favourite-longshot calibration |

## Live wiring

`blend_coef="auto"` is passed in the live scoring paths — `export_data.py`
(PWA), `dashboard.py`, `phase6_importer.py`, `race_simulator.py`. When **every**
runner has odds the blend applies; otherwise it falls back to the pure factor
model (e.g. the Wednesday-morning racecard before odds are scraped).
`walkforward_test.py` deliberately does **not** blend — it stays a pure-factor
regression guard.

To retrain after new meetings: `python3 train_blend.py` then re-export.

## Operational note

The model did not get smarter at handicapping — it got smart enough to **trust
the market** and tilt only where a couple of factors have earned it. Real edge
beyond the market is the Phase 5+ project, and it needs richer data, not
cleverer ranking.
