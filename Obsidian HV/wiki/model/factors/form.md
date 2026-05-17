# Form Factor

**Variable:** `ff`  
**Status:** Active

---

## What It Measures

Recency-weighted finishing position across the horse's last `FORM_RUNS=5` races. More recent runs carry more weight; better finishes (lower position numbers) produce a higher factor.

## How It's Computed

Exponential decay applied to finish positions, most recent first:

```
weight_i = FORM_DECAY ^ i          # i=0 most recent, i=4 oldest
score    = Σ (weight_i × place_score_i) / Σ weight_i
ff       = score / field_average_score
```

`place_score` is a function that converts finish position to a 0–1 value (1st = best).

**`FORM_DECAY = 0.60`** — each prior run is worth 60% of the one after it.

## Live Racecard Override

When `last_6_runs` is available from the HTML racecard (live imports only), it replaces the DB-derived form score. This column contains HKJC's own positional string (e.g. `"1-2-3-1-4-"`) and is more complete than what's in the local DB, especially for horses with recent runs at Sha Tin or abroad.

## Notes

- Historical rows have `last_6_runs = NULL` — form is computed from DB finish positions.
- Form factor is one of the better-performing individual factors. Decay=0.60 was chosen empirically.
- With only `FORM_RUNS=5`, older form at very different class levels may still pollute the score. Future consideration: class-stratified form.

## Related Pages

[[model/architecture]] · [[data/database]]
