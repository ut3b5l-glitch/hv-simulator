# Database

**File:** `happy_valley.db` (project root)  
**Engine:** SQLite3  
**Stats as of June 6, 2026:** 1,921 races · 23,912 entries — **two venues (HV + ST)**

| Venue | Races | Entries | Date range | Odds coverage |
|---|---|---|---|---|
| HV (Happy Valley) | 614 | 7,079 | 2022-11-09 → 2026-06-03 | 100% |
| **ST (Sha Tin)** | **1,307** | **16,833** | **2024-01-01 → 2026-05-31** | **98.5%** |

ST was backfilled 2026-06-05/06 from the tianxi-database source (`tianxi_backfill.py`/`st_backfill`),
1,091 races / 14,083 entries inserted in this run, zero errors (auto-resumed once after an
overnight pause). All structural fields (barrier, jockey, trainer, weight) ~100% populated;
`public_odds` 98.5% and `finish_position` 98.3% — high enough for the market-blend to run on ST.
See [[performance/walkforward]] and [[model/market-blend]] for the ST validation results.

> **ST is turf + all-weather.** Course configs include `AWT` (the Sha Tin all-weather dirt
> track) alongside turf `A/B/C`, and distances extend to 2000m and 2400m — neither appears at
> HV. The barrier-IV factor keys on `(distance_m, course_config, barrier)`, so it absorbs the
> new track/distance combinations without code changes; stats are built per-venue.

---

## Table: `races`

```sql
race_id, race_date, venue, race_number, course_config, distance_m,
track_surface, going, race_class, prize_money_hkd, field_size
```

| Column | Notes |
|---|---|
| `venue` | `'HV'` (Happy Valley) or `'ST'` (Sha Tin) |
| `race_class` | Integer 1–5 (mostly Class 3–5) |
| `going` | `'GOOD'` (370), `'GOOD TO FIRM'` (163), `'GOOD TO YIELDING'` (37), `''`/NULL (8) |
| `course_config` | Track layout identifier (used in barrier IV key) |

---

## Table: `race_entries`

```sql
entry_id, race_id, horse_id, trainer_id, jockey_id, barrier, weight,
gear, public_odds, finish_position, finish_margin,
is_placed,                                -- GENERATED: 1 if finish_position <= 3
final_sectional_400m,
official_rating, rating_change, days_since_last_run, last_6_runs
```

| Column | Notes |
|---|---|
| `is_placed` | Computed column — no need to maintain manually |
| `final_sectional_400m` | Mostly empty, unused — future signal candidate |
| `official_rating` | **Phase B** — NULL for all historical rows |
| `rating_change` | **Phase B** — NULL for all historical rows |
| `days_since_last_run` | **Phase B** — NULL for all historical rows |
| `last_6_runs` | **Phase B** — NULL for all historical rows; HKJC positional string e.g. `"1-2-3-1-4-"` |
| `public_odds` | Populated by `hkjc_odds.py` on race day |
| `UNIQUE(race_id, horse_id)` | `INSERT OR REPLACE` safely refreshes entries |

---

## Table: `paper_trades`

```sql
trade_id, race_id, horse_id, trade_date,
model_win_pct, model_place_pct, model_show_pct,
edge, public_odds, stake (default 1.0),
result,           -- NULL=pending / 'WIN' / 'LOSS'
finish_position, profit, logged_at
```

---

## Table: `horses`

```sql
horse_id, horse_name, sex, origin, age, import_type
```

---

## Table: `jockeys`

```sql
jockey_id, jockey_name, jockey_code
```

---

## Table: `trainers`

```sql
trainer_id, trainer_name, trainer_code
```

---

## Table: `horse_form`

Detailed all-venue form history. Not yet used in the model — available for future improvement (e.g. cross-venue form, Sha Tin form for HV debutants).

---

## Phase B Column Status

All four Phase B columns (`official_rating`, `rating_change`, `days_since_last_run`, `last_6_runs`) are NULL for every historical row. Only Wednesday racecard imports via `wednesday_agent.py` populate them. This means walk-forward validation underestimates live model performance.

## Known Data Issues

- Race 587 (Apr 29 R1): no Phase B data — imported before Phase B was built. Re-run `phase6_importer.py` on the Apr 29 HTML to fix.
- Some Apr 22 races: `going = ''` (empty string) instead of NULL — cosmetic, no model impact.

## Related Pages

[[data/api]] · [[model/factors/rating-days]] · [[issues/known-issues]]
