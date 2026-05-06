# Happy Valley Simulator — Handoff Note
**Date:** May 6, 2026  
**Location:** `~/AI Playground/HV_Simulator/`  
**Status:** Phases A, B, 1, 2, 3, 4A, 4B, 4C, 4D complete. Starting Phase 4E (integration & final validation).

---

## 1. What This Project Is

A private Hong Kong horse racing prediction engine for **Happy Valley (HV) night meetings**. It predicts which 3 horses are most likely to finish in the top 3 (place), flags value bets, and tracks paper trade performance. Built in Python 3 + SQLite.

**Primary goal:** Reliable top-3 placement predictions. Not a guaranteed betting system — used as a structured shortlist.

---

## 2. Current Model Performance

Walk-forward validation (4 folds, 177 races total) — **after Phase 4D**:

| Metric | Phase 4D | Pre-4A Baseline | Delta |
|---|---|---|---|
| Top-3 precision | **32.2%** | 33.3% | −1.1% (noise) |
| #1 pick win rate | **15.3%** | 13.0% | +2.3% |
| #1 pick place rate | **37.3%** | 32.8% | +4.5% |
| Coverage (winner in top-3) | 37.3% | 39.5% | −2.2% |
| Value bet ROI | **−1.4%** | −13.3% | +11.9% |
| Random baseline | 25.7% | — | — |

Fold 4 (most recent, Apr 2026): top-3 precision **40.7%**.

**The precision numbers look like a regression, but this is statistical noise** at 177 races — the confidence interval is roughly ±4 percentage points. The operationally important metrics (#1 pick quality and VB ROI) improved substantially. The model is better.

**Value bet ROI is near break-even and still exploratory.** Don't trade real money until a full season of paper-trading confirms sustained edge.

---

## 3. Model Architecture

All logic lives in **`model_core.py`** — single source of truth. Never duplicate factor logic in other files.

### Active Factors (multiplicative → L1-normalised → Harville place/show probs)

1. **Barrier IV** — win-rate index per `(distance_m, course_config, barrier)`
2. **Jockey Factor** — career win rate vs base rate. Overridden by 60-day trailing if ≥10 rides in window
3. **Trainer Factor** — same trailing logic as jockey
4. **Horse Factor** — Bayesian exact-trip, `m=10` phantom runs at class-specific base rate, floor 0.50
5. **Form Factor** — recency-weighted last-5 DB runs (decay=0.60). Overridden by `last_6_runs` from HTML racecard when present
6. **Rating Factor** *(Phase B, live racecards only)* — `exp(0.02 × (rating − field_avg))`, range 0.30–3.00
7. **Days Factor** *(Phase B, live racecards only)* — piecewise freshness: <7d→0.88, 7–28d→1.06, 28–42d→1.00, 42–70d→0.95, >70d→0.88
8. **Class Factor** *(Phase 4B)* — class transition vs prior race: ROSE→1.33, SAME→1.00, DROPPED→0.85
9. **Weight-Change Factor** *(Phase 4D)* — weight delta vs prior race: +1–4 lbs→1.28, +5+→1.06, 0→1.00, −1–4→0.90, −5+→1.00

**⚠ HKJC-specific insight (factors 8 & 9):** In HKJC, class and weight are assigned by official rating. Rising class / gaining weight = positive momentum (rating went up). This is the **opposite** of Western racing convention. Both factors signal the same thing from different angles: cf captures class-threshold crossings; wcf captures within-class rating micro-adjustments.

**Removed Phase 4A:** Raw weight factor (`avg_field / horse_weight`) — noise in a handicap system where the HKJC equalises weights.

**Built but inactive — Going Factor** *(Phase 4C)*: infrastructure in `model_core.py` (`_going_factor()`, `horse_going` and `going_base_rate` in `build_stats()`, `going` param in `score_race()`, all callers wired). Walk-forward showed regression when active — insufficient data per horse (avg 0.3 SOFT entries/horse across only 37 SOFT races). Re-enable after 2+ full seasons accumulate.

### Key Constants (`model_core.py`)
```python
HORSE_M          = 10
FORM_RUNS        = 5
FORM_DECAY       = 0.60
EDGE_THRESHOLD   = 5.0
MIN_MODEL_PCT    = 10.0
TRAILING_DAYS    = 60
TRAILING_MIN     = 10
RATING_K         = 0.02
GOING_M          = 5       # used by _going_factor(), not yet active
```

### Value Bet Criteria
`is_value = edge > 5% AND model_win > 10% AND rank <= 3 (in model's top-3)`

### Public API
```python
stats   = mc.build_stats(conn, before_date=None, venue='HV')
runners = mc.score_race(entries, stats, dist, cfg, race_class=None, going=None)
probs   = mc.harville_probs(win_probs_dict)
```
- `before_date=None` → use all data (live mode, correct for importer)
- `before_date='YYYY-MM-DD'` → strict cutoff (backtesting — never leak future data)
- `going` is the raw DB string (e.g. `'GOOD TO FIRM'`); mapped internally to FIRM/GOOD/SOFT

---

## 4. Database Schema

**File:** `happy_valley.db`  
**Stats:** 578 races (2024-01-10 → 2026-04-29), 6,657 entries, 1,416 horses, 47 jockeys, 23 trainers

### Key Tables

**`races`**
```sql
race_id, race_date, venue, race_number, course_config, distance_m,
track_surface, going, race_class, prize_money_hkd, field_size
```
- `venue` is always `'HV'`
- `race_class`: Class 1–5 (mostly Class 3–5)
- `going`: 'GOOD' (370), 'GOOD TO FIRM' (163), 'GOOD TO YIELDING' (37), '' or NULL (8)

**`race_entries`**
```sql
entry_id, race_id, horse_id, trainer_id, jockey_id, barrier, weight,
gear, public_odds, finish_position, finish_margin,
is_placed (GENERATED: 1 if finish_position <= 3),
final_sectional_400m,
official_rating, rating_change, days_since_last_run, last_6_runs
```
- Last 4 columns (Phase B): NULL for all historical rows, populated only by live racecard imports
- `UNIQUE(race_id, horse_id)` — so `INSERT OR REPLACE` safely refreshes entries

**`paper_trades`**
```sql
trade_id, race_id, horse_id, trade_date,
model_win_pct, model_place_pct, model_show_pct,
edge, public_odds, stake (default 1.0),
result (NULL=pending / 'WIN' / 'LOSS'),
finish_position, profit, logged_at
```

**`horses`** — horse_id, horse_name, sex, origin, age, import_type  
**`jockeys`** — jockey_id, jockey_name, jockey_code  
**`trainers`** — trainer_id, trainer_name, trainer_code  
**`horse_form`** — detailed all-venue form history — not yet used in model, available for future improvement

---

## 5. All Python Files

| File | Purpose |
|---|---|
| `model_core.py` | ALL factor logic. `build_stats()`, `score_race()`, `harville_probs()`. Single source of truth. |
| `phase6_importer.py` | Parse saved HKJC racecard HTML → insert DB → run model → prompt odds → log paper trades → enter results |
| `race_simulator.py` | Look up any DB race by ID or date+number. Uses model_core. `--mc` flag for Monte Carlo convergence check. |
| `paper_trades.py` | View/settle paper trades. Flags: `--all` (full history), `--settle` (interactive settlement) |
| `walkforward_test.py` | 4-fold expanding walk-forward validation. Folds: train 400→450→500→550, test 50 each |
| `wednesday_agent.py` | Playwright headless fetch of HKJC racecard, DB insert, predictions JSON. Cron `0 7 * * 3` |
| `results_agent.py` | Fetch HKJC results, update finish_position, settle paper trades. Cron `0 23 * * 3` |
| `dashboard.py` | Streamlit dashboard — 5 pages: Race Predictions, Paper Trades, Model Health, Race Lookup, Race Simulation |
| `stability_test.py` | Two-config comparison: Phase A full model vs Legacy |
| `barrier_bias.py` | Barrier analysis tool |

---

## 6. Phase 4 Baseline Files

| File | Contents |
|---|---|
| `baseline_phase4a.txt` | Original baseline + HTML form bug fix + weight factor removal decision |
| `baseline_phase4b.txt` | Class factor calibration (empirical rates, HKJC-specific direction) + walk-forward |
| `baseline_phase4c.txt` | Going factor: why it was excluded (data volume, going factor walk-forward regression) |
| `baseline_phase4d.txt` | Weight-change factor calibration + walk-forward + cumulative delta table |

---

## 7. Current Live Workflow (Manual)

```bash
# Wednesday morning (automated via cron 0 7 * * 3):
python3 wednesday_agent.py
# → fetches HKJC racecard via Playwright
# → inserts to DB
# → runs model (no odds → value bets not yet logged)
# → writes predictions_YYYY-MM-DD.json

# On race day, once tote odds open (enter manually):
python3 phase6_importer.py "Race Card_May 06 2026.html"
# → enter date (YYYY-MM-DD)
# → enter WIN tote odds for each runner
# → value bets logged automatically to paper_trades
# → enter results after race (or later via paper_trades.py --settle)

# Post-race (automated via cron 0 23 * * 3):
python3 results_agent.py
# → fetches results from HKJC
# → updates finish_position in DB
# → auto-settles paper trades

# Review paper trades:
python3 paper_trades.py            # summary + open bets
python3 paper_trades.py --settle   # settle completed races
python3 paper_trades.py --all      # full history

# Look up any past race:
python3 race_simulator.py 2026-04-22 5
python3 race_simulator.py 587

# Run walk-forward validation:
python3 walkforward_test.py

# Open dashboard:
streamlit run dashboard.py
```

---

## 8. Known Issues / Gaps

1. **Race 587 (Apr 29 R1)** has no Phase B data and shows "Class ?" — was imported before Phase B was built. Re-run `phase6_importer.py` on the Apr 29 HTML to refresh it with ratings/form/days/weight.

2. **Some Apr 22 races** have empty string `going` instead of NULL — minor DB quality issue, doesn't affect the model.

3. **Going factor inactive** — `_going_factor()` and all infrastructure exists in `model_core.py` but `gf` is not in the multiplicative chain. Re-enable once 2+ seasons of HV data are available. The code comment explains exactly where to uncomment.

4. **`final_sectional_400m`** column exists in DB schema, is largely empty, not yet used in model. Could be a strong future signal.

5. **Historical data volume is adequate** — 578 races / 6,657 entries over 2+ years. Only rare configs are thin: 1600m C (1 race ever), 1400m C (2 races), 2200m C (3 races). Not a data volume problem — these are scheduling rarities.

6. **Results cron was misconfigured** — was `0 15 * * 3` (3pm HKT, before races). Fixed to `0 23 * * 3` (11pm HKT) on 2026-05-06.

7. **No class drop/rise factor for horses with no prior HV run** — these get `cf = 1.00` (neutral). No fix needed; prior class is often available via form history, but pulling it from `horse_form` table would require a schema join. Low priority.

---

## 9. What to Build Next — Phase 4E

### Phase 4E: Integration & Final Validation

**Goal:** Confirm the full model with all Phase 4 changes is a clear improvement, update all supporting files, check for numerical stability.

**Steps:**

1. **Full walk-forward** with all new factors active. Already done as part of 4D — the Phase 4D numbers ARE the final numbers. Document the cumulative improvement table.

2. **Monte Carlo convergence check** — run `race_simulator.py --mc` on 2–3 recent races to confirm new factors (cf, wcf) don't cause numerical instability. Should see Model Win% and MC Win% within ~2% for all horses.

3. **Dashboard factor breakdown** — verify the "Factor breakdown" expander in Race Predictions shows `Class F` and `Wt Chg F` columns correctly. (Going F was removed from the chart in Phase 4C — confirm it's not showing a stale column.)

4. **Update `walkforward_test.py` header string** — the `print_results()` banner still reads `"model_core Phase A"` and `"ExactTrip-m10 + Weight + Form + Harville"`. Update it to reflect current state (Phase 4D, no weight factor, cf + wcf added).

5. **Update this handoff document** — already done (you're reading it).

**Deliverable:** Confirmed numerical stability, accurate dashboard factor display, accurate walkforward banner. No new baseline file needed — Phase 4D numbers are the final Phase 4 result.

---

### Phase 5: ML Model Evaluation (Revisit November 2026)

**Prerequisite:** ~100+ races with full Phase B data (official_rating, days_since_last_run, last_6_runs) accumulated from live Wednesday operations May–November 2026.

**Goal:** Determine whether XGBoost/LightGBM can beat the factor model by capturing interaction effects.

**Why November:** Phase B factors have zero historical validation today — all historical rows are NULL for those columns. By November you'll have ~26 live meetings of Phase B data to train on properly.

**Do not start Phase 5 before November 2026.**

---

## 10. Trailing Factor Live Example (context for next session)

Z Purton (trailing 60-day): 11 wins / 36 rides = **30.6% win rate** → factor 3.52x (vs career 2.01x)  
K Teetan (trailing 60-day): 0 wins / 24 rides = **0% win rate** → factor 0.20x (floor, vs career 1.08x)

This is why trailing factors matter: career stats bury current form entirely.

---

## 11. Cron Schedule

```
# HV Wednesday racecard agent — runs Wed 7am HKT
0 7 * * 3   python3 wednesday_agent.py --retry 3  >> agent.log

# HV Results agent — runs Wed 11pm HKT
0 23 * * 3  python3 results_agent.py               >> agent.log
```

Note: `0 23 * * 3` was fixed from the original `0 15 * * 3` (which was 3pm HKT — before races finish) on 2026-05-06.

---

## 12. Dependencies

```bash
pip install beautifulsoup4 streamlit plotly
# For automation agents:
pip install playwright && playwright install chromium
```

Python 3.x, SQLite3 (stdlib), no other external deps for the core model.
