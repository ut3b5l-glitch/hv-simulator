# Rating Factor & Days Factor

**Variables:** `rf` (rating), `df` (days since last run)  
**Status:** Active — live racecards only (Phase B columns, NULL for all historical rows)

---

## Rating Factor (`rf`)

### What It Measures

The horse's official HKJC rating relative to the field average. A horse rated above the field average gets a boost; below average gets a penalty.

### Formula

```python
rf = exp(RATING_K × (official_rating − field_avg_rating))
```

`RATING_K = 0.02` → a 10-point rating advantage gives `exp(0.02 × 10) ≈ 1.22×` boost.

**Clamp:** `[0.30, 3.00]` to prevent extreme outliers.

### Notes

- `official_rating` is populated only from live racecard imports via `wednesday_agent.py`.
- All historical rows have `official_rating = NULL` → `rf = 1.00` (neutral).
- The rating is HKJC's handicap rating, not a speed figure. It encodes the handicapper's view of each horse's ability.

---

## Days Factor (`df`)

### What It Measures

Freshness — how long since the horse last raced. HKJC horses at optimal freshness windows tend to run better.

### Piecewise Values

| Days since last run | Factor |
|---|---|
| < 7 days | 0.88 (too soon — fatigue) |
| 7–28 days | 1.06 (optimal fresh window) |
| 28–42 days | 1.00 (neutral) |
| 42–70 days | 0.95 (slight rust) |
| > 70 days | 0.88 (long layoff) |

### Notes

- `days_since_last_run` is populated only from live racecard imports.
- All historical rows have `days_since_last_run = NULL` → `df = 1.00` (neutral).
- The breakpoints were calibrated on HKJC data, not transferred from another market.

---

## Combined Note

Both `rf` and `df` are Phase B factors. They activate for live meetings (Wednesday racecard imports) but contribute nothing to walk-forward validation on historical data — all historical Phase B columns are NULL. This means walk-forward numbers **understate** the model's live predictive power.

See [[data/database]] for column details.

## Related Pages

[[model/architecture]] · [[data/database]] · [[performance/walkforward]]
