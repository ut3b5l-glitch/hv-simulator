# Horse Factor

**Variable:** `hf`  
**Status:** Active — currently inert in practice (see note)

---

## What It Measures

The horse's historical win rate in this exact trip configuration (distance + course + class tier), with Bayesian shrinkage toward a class-specific prior.

## How It's Computed

Bayesian estimate with `HORSE_M=10` phantom runs at the class-specific base rate:

```
observed_wins  = actual wins in (distance_m, course_config, race_class)
observed_rides = actual rides in same config
prior_rate     = base win rate for this race_class

hf = (observed_wins + HORSE_M × prior_rate) / (observed_rides + HORSE_M)
     / base_win_rate
```

**Floor:** 0.50 (prevents horses with bad exact-trip records from being penalised too harshly relative to the base).

## Why Bayesian

New horses or horses racing at an unusual distance have very few exact-trip observations. The phantom runs pull the estimate toward the class prior until enough real data accumulates, preventing over-reaction to a single bad result.

## Current State: Effectively Inert

In practice, `hf ≈ 1.00` for most runners because `jf × tf` products dominate the score and dwarf the variation in `hf`. This is not a bug in the horse factor — it's a symptom of the leverage problem in [[factors/jockey-trainer]].

Once `jf × tf` leverage is capped, `hf` should contribute meaningfully to differentiation.

## Related Pages

[[model/architecture]] · [[factors/jockey-trainer]] · [[issues/known-issues]]
