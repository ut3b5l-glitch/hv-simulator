# Barrier Factor

**Variable:** `bf`  
**Status:** Active

---

## What It Measures

Win-rate advantage (or penalty) for a given barrier (gate) position, conditioned on the specific race configuration. Different tracks and distances have markedly different barrier biases.

## How It's Computed

Computed as an index (observed win rate ÷ base win rate) for the combination:

```
key = (distance_m, course_config, barrier)
```

`build_stats()` aggregates historical results grouped by this triple. At score time, the horse's draw is looked up and the index value is applied as `bf`.

## Why It Matters

At Happy Valley, the inside draw is strongly favoured at short distances on the tight circuit. The outer barriers face longer trips around the bend at certain distances. The effect is course-config specific — a barrier 1 advantage at 1000m doesn't translate identically to 1650m.

## Notes

- If a (distance, config, barrier) combination has insufficient history, the factor defaults to neutral (1.00).
- Use `barrier_bias.py` to inspect raw barrier win rates by configuration.

## Related Pages

[[model/architecture]] · [[issues/known-issues]]
