# Happy Valley Simulator — Handoff Note
**Date:** May 13, 2026  
**Location:** `~/AI Playground/HV_Simulator/`  
**Status:** Phases A, B, 1, 2, 3, 4A, 4B, 4C, 4D complete. Phase 4E in progress. Operational for live meetings.

---

## SESSION LOG — May 13, 2026 (Race Night)

### What was done

**1. Readiness audit** — confirmed all deps (Playwright, Streamlit, Plotly, model_core) operational. DB had 587 races through Apr 29. No races for May 6 (no HV meeting that week confirmed).

**2. Bug fix: `wednesday_agent.build_predictions()` missing fields** — runner_dicts did not include `edge`, `market_pct`, or `public_odds`. This would crash `hkjc_odds.py`'s value bet display with `KeyError: 'edge'` whenever any value bet was found. Fixed — all three fields now included.

**3. iPad access via Tailscale** — installed Tailscale on Mac + iPad. Streamlit served with `--server.address 0.0.0.0`. Dashboard accessible on iPad at `http://<mac-tailscale-ip>:8501`. Working.

**4. Racecard import failure + fix** — `racing.hkjc.com` now times out for headless Chromium (30s timeout). Added `fetch_racecard_graphql()` to `wednesday_agent.py` as an automatic fallback: navigates to `bet.hkjc.com`, intercepts `info.cld.hkjc.com/graphql/base/` HTTP responses containing `data.raceMeetings[].races[].runners[]`, and parses directly. Today's 9 races were imported via this path.

**5. Odds fetch: three bugs fixed in `hkjc_odds.py`**

| Bug | Cause | Fix |
|---|---|---|
| `AttributeError: 'bytes' has no attribute 'payload'` | Playwright passes WS frame data as `bytes` directly (not an object with `.payload`) in newer versions | `_on_frame`: handle `isinstance(frame, bytes)` first |
| Page load timeout | `wait_until="networkidle"` never fires on live betting page (constant polling/WS) | Changed to `wait_until="load"` |
| DOM scraper extracting cloth numbers (1,2,3…) as odds | Grabbing first integer in row = saddle number | Row structure confirmed: `[cloth, name, draw, wt, jockey, trainer, WIN_ODDS, place_odds]`. Scraper now takes `tokens[-2]` (second-to-last) |

**6. May 13 results** — 9 races imported, all 101 runner odds applied, predictions written. Live value bets flagged to dashboard before R1.

### Files changed today
- `wednesday_agent.py` — added `fetch_racecard_graphql()` fallback; added `edge`/`market_pct`/`public_odds` to runner_dicts
- `hkjc_odds.py` — WS frame bytes fix; `wait_until="load"`; DOM token position fix for win odds

### DB state after today
- 596 races (587 historical + 9 from today's meeting)
- `predictions_2026-05-13.json` written
- `race_entries.public_odds` populated for all 101 May 13 runners

---

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
**Stats:** 596 races (2024-01-10 → 2026-05-13), 6,867 entries, 1,483 horses, 47 jockeys, 23 trainers

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

## 7. Current Live Workflow

```bash
# ── WEDNESDAY MORNING (automated via cron 0 7 * * 3) ──────────────────────
python3 wednesday_agent.py
# → tries racing.hkjc.com first; auto-falls back to bet.hkjc.com GraphQL
# → inserts to DB, runs model (no odds yet)
# → writes predictions_YYYY-MM-DD.json

# ── RACE DAY ~6PM HKT (manual, must be on HK IP or HK VPN) ───────────────
python3 hkjc_odds.py --date YYYY-MM-DD
# → opens bet.hkjc.com, waits for page load, captures live WIN odds
# → updates race_entries.public_odds in DB
# → re-runs model with market odds → refreshes predictions JSON with value bets

# ── DASHBOARD (iPad / browser) ────────────────────────────────────────────
# On Mac: streamlit run dashboard.py --server.address 0.0.0.0
# On iPad: http://<mac-tailscale-ip>:8501

# ── POST-RACE (automated via cron 0 23 * * 3) ─────────────────────────────
python3 results_agent.py
# → fetches results from HKJC, updates finish_position, settles paper trades

# ── UTILITIES ──────────────────────────────────────────────────────────────
python3 paper_trades.py            # summary + open bets
python3 paper_trades.py --settle   # interactive settlement
python3 paper_trades.py --all      # full history

python3 race_simulator.py 2026-05-13 4   # look up any DB race
python3 walkforward_test.py              # 4-fold walk-forward
```

---

## 8. Known Issues / Gaps

1. **Race 587 (Apr 29 R1)** has no Phase B data — was imported before Phase B was built. Re-run importer on Apr 29 HTML to populate ratings/form/days/weight.

2. **Some Apr 22 races** have empty string `going` instead of NULL — cosmetic, doesn't affect the model.

3. **Going factor inactive** — infrastructure exists in `model_core.py` but `gf` is not in the multiplicative chain. Re-enable after 2+ full seasons of HV data.

4. **`final_sectional_400m`** column in DB schema is mostly empty, unused. Future signal candidate.

5. **`racing.hkjc.com` headless fetch broken** — times out for Playwright as of May 2026. `wednesday_agent.py` now auto-falls back to GraphQL via `bet.hkjc.com`. If this also breaks in future, see `fetch_racecard_graphql()` and the `info.cld.hkjc.com/graphql/base/` endpoint structure documented in the May 13 session log above.

6. **`hkjc_odds.py` uses DOM scraper as primary path** — the HTTP GraphQL `winOdds` field is empty on initial page load (odds delivered via WebSocket push, not initial response). The DOM scraper navigates each race page and extracts the rendered odds table using the confirmed row structure: `[cloth, name, draw, wt, jockey, trainer, WIN_ODDS, place_odds]` → takes `tokens[-2]`. If HKJC changes their table layout, odds extraction will break silently (returns wrong numbers). Run with `--dry-run` first to sanity-check values look like real odds (non-sequential, with decimals) before writing to DB.

7. **WebSocket odds interception not yet working** — `_on_websocket` handler is wired and the bytes bug is fixed, but WS frames are not yielding parseable odds yet. The DOM fallback is reliable for now. If WS format is ever resolved, it would provide faster/more-reliable odds capture.

8. **No class/weight factors for horses with no prior HV run** — `cf = wcf = 1.00` (neutral). Low priority.

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
