# Operations

Full live workflow for a Happy Valley Wednesday meeting.

---

## Cron Schedule

```
# Racecard agent — Wed 7am HKT
0 7 * * 3   python3 wednesday_agent.py --retry 3  >> agent.log

# Results agent — Wed 11pm HKT
0 23 * * 3  python3 results_agent.py               >> agent.log
```

Note: results cron was fixed from `0 15 * * 3` (3pm HKT — before races finish) to `0 23 * * 3` on 2026-05-06.

---

## Wednesday Morning (automated)

```bash
python3 wednesday_agent.py
```

- Tries `racing.hkjc.com` first; auto-falls back to `bet.hkjc.com` GraphQL
- Inserts racecard to DB, runs model (no odds yet)
- Writes `predictions_YYYY-MM-DD.json`

If automation fails, check `agent.log` and run manually.

---

## Race Day ~6pm HKT (manual — requires HK IP)

```bash
python3 hkjc_odds.py --date YYYY-MM-DD
```

- Opens each race page on `bet.hkjc.com`, captures live WIN odds from DOM
- Updates `race_entries.public_odds` in DB
- Re-runs model with market odds → refreshes predictions JSON with value bets

**Must be on HK IP** (or HK VPN). Run `--dry-run` first if uncertain about odds format.

---

## Dashboard

```bash
# On Mac:
streamlit run dashboard.py --server.address 0.0.0.0

# On iPad via Tailscale:
http://<mac-tailscale-ip>:8501
```

Dashboard has 5 pages: Race Predictions, Paper Trades, Model Health, Race Lookup, Race Simulation.

---

## Post-Race (automated)

```bash
python3 results_agent.py
```

- Fetches HKJC results, updates `finish_position` in DB
- Settles paper trades automatically

---

## Utilities

```bash
python3 paper_trades.py              # summary + open bets
python3 paper_trades.py --settle     # interactive settlement
python3 paper_trades.py --all        # full history

python3 race_simulator.py 2026-05-13 4   # look up any DB race by date + number
python3 race_simulator.py --mc           # Monte Carlo convergence check

python3 walkforward_test.py              # 4-fold walk-forward validation

python3 barrier_bias.py                  # barrier win rates by configuration
```

---

## Dependencies

```bash
pip install beautifulsoup4 streamlit plotly
pip install playwright && playwright install chromium
```

Python 3.x, SQLite3 (stdlib). No other external deps for the core model.

---

## If Things Break

| Symptom | Likely cause | Fix |
|---|---|---|
| `wednesday_agent.py` fails | racing.hkjc.com blocked | Already auto-falls back to GraphQL. Check `agent.log`. |
| GraphQL also fails | HKJC API change | Inspect `fetch_racecard_graphql()` and the `info.cld.hkjc.com/graphql/base/` endpoint structure |
| Odds look like integers (1,2,3…) | DOM layout changed | Run `--dry-run`, update token index in `hkjc_odds.py` |
| Dashboard missing columns | Stale factor display | Check "Factor breakdown" expander — Going F should not appear |

## Related Pages

[[data/api]] · [[issues/known-issues]]
