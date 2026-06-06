# Operations

Full live workflow for a race meeting — **Happy Valley (Wed nights)** and
**Sha Tin (weekend afternoons)**. `hv_auto.sh` is venue-aware (since 2026-06-06):
it probes each venue in `VENUES` (default `"HV ST"`) for the given date and
processes whichever is actually racing. HKJC runs one fixture per day, so at most
one venue produces a card; the rest no-op.

---

## Cron Schedule (automation — `hv_auto.sh`)

```
# ── Happy Valley — Wednesday nights (HKT) ──────────────────────────────────
0 11 * * 3   hv_auto.sh pull       # catch the card early / detect special meetings
30 17 * * 3  hv_auto.sh pull       # pre-track: predictions + live odds in the app
30 19 * * 3  hv_auto.sh pull       # mid-card odds refresh
0 23 * * 3   hv_auto.sh reconcile
30 23 * * 3  hv_auto.sh reconcile  # catches the late nightcap (R9)

# ── Sha Tin — weekend afternoons (Sat=6, Sun=0; first race ~13:00, last ~17:30) ──
0 9 * * 6,0    hv_auto.sh pull       # card early
30 11 * * 6,0  hv_auto.sh pull       # odds firming
30 12 * * 6,0  hv_auto.sh pull       # final pre-off odds
0 15 * * 6,0   hv_auto.sh pull       # mid-card odds refresh
0 18 * * 6,0   hv_auto.sh reconcile
30 18 * * 6,0  hv_auto.sh reconcile  # after the last
```

The weekend lines use default `VENUES="HV ST"`, so they also catch the rare
weekend HV fixture; the Wednesday lines likewise catch a rare midweek ST card.
**Status: INSTALLED 2026-06-06** in the live crontab (the weekend block above
is live; first run is the 2026-06-07 Sunday ST meeting). The ST live-fetch path
was validated the day before via `wednesday_agent.py --venue ST --date 2026-06-07
--dry-run` (pulled the 11-race card cleanly). Public-holiday meetings on other
weekdays are still not scheduled — run manually (`./hv_auto.sh pull YYYY-MM-DD`)
for those. A crontab backup is in `/tmp/zokki_brand/crontab_backup_*.txt`.

`hv_auto.sh` (project root) is the single orchestrator. Each run **no-ops cleanly when there is no meeting**, so it fires on every scheduled day and still catches irregular *special* meetings automatically. It runs the full chain (scrape → `export_data.py` → commit/push → `vercel deploy --prod --yes`) so the PWA self-updates with **no manual step and no laptop access required** — the Mac is the unattended worker.

**Hard requirements:**
- **Mac must be awake** at those times (set to never sleep, incl. lid closed). Cron does not wake a sleeping Mac.
- `vercel` is a Node CLI under nvm — `hv_auto.sh` puts `~/.nvm/.../bin` on PATH and uses absolute paths for `python3`/`git`. Vercel CLI must stay logged in (GitHub→Vercel auto-deploy is NOT connected).

**Why the old crons were replaced:** the 7am racecard cron **failed silently** on the 2026-06-03 special meeting, and the 11pm results cron only ran `results_agent.py` (it never refreshed/deployed the PWA). History: results cron was earlier fixed from `0 15 * * 3` to `0 23 * * 3` on 2026-05-06.

**Manual / on-demand** (special meeting, or backup if the Mac was asleep):
```bash
./hv_auto.sh pull 2026-06-03            # probe HV+ST for a date (auto-detects venue)
./hv_auto.sh reconcile 2026-06-03
./hv_auto.sh pull 2026-06-13 ST         # restrict to a single venue (3rd arg)
```
Each underlying agent also takes `--venue {HV,ST}` directly:
`python3 wednesday_agent.py --venue ST --date 2026-06-13`,
`python3 hkjc_odds.py --venue ST --date 2026-06-13`,
`python3 results_agent.py --venue ST --date 2026-06-13`.
Or drive it from your phone via Claude Code **Remote Control** (`claude remote-control` on the Mac). See [[web/dynamic-pull-plan]].

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
- Scrapes the official **dividend table** (WIN / PLACE / QUINELLA / QUINELLA PLACE / …) into `results_<date>.json` via `parse_dividends()`
- Settles paper trades automatically
- **Final step — Betting P&L** (`bet_report.py`): prints flat-stake HK$10 P&L for four strategies on the model's top-3 picks (Win on #1, Place box, Quinella box, Quinella Place box) using the official dividends, and writes `bet_report_<date>.json`. Runs after every reconciliation (manual or cron).

```bash
python3 bet_report.py 2026-06-03   # re-print the P&L for a date (reads existing JSONs)
```

Dividends are per HK$10 and include the stake. Place = top-3 (fields of 7+).
Example (2026-06-03): Win on #1 **+$31.00** (+34.4%), Quinella Place box **+$29.00** (+10.7%), Place box −$25.50, Quinella box −$134.50.

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
