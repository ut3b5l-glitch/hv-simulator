# Log

Append-only chronological record of all wiki operations.

Format: `## [YYYY-MM-DD] <operation> | <description>`

Grep shortcuts:
```bash
grep "^## \[" "Obsidian HV/wiki/log.md" | tail -10      # last 10 entries
grep "ingest" "Obsidian HV/wiki/log.md"                  # all race night ingests
grep "experiment" "Obsidian HV/wiki/log.md"              # all walk-forward tests
```

---

## [2026-05-28] ingest | HV Meeting 2026-05-27 — results & reconciliation

22.2% top-3 precision (6/27). 14 value bets flagged; 0 won, 3 placed, 11 lost. Worst live meeting to date.
4 complete misses (R1, R4, R6, R9). jf×tf overconfidence dominant failure mode — HONEST WITNESS 84.1% model win, finished out of frame.
Going updated to GOOD TO FIRM (was GOOD on early fetch). Standby runner parser bug fixed (16 reserves excluded).

Updated pages:
- `performance/live-meetings.md` — added full May 27 section with race-by-race and value bet breakdown
- `overview.md` — updated live performance table (2-meeting average now 37.1%)

---

## [2026-05-28] build | Mobile PWA shipped to hv-simulator.vercel.app

Next.js 14 PWA in `web/` with glass / Apple-native design — installable to iOS home screen. Three pages: Tonight's Races (race tab strip, value pills, tap-to-expand factor breakdown), Performance (lifetime ROI / hit rate / recent meetings), Profiles (searchable jockeys/trainers/horses with 60-day trailing form). Fed by `export_data.py` which converts `happy_valley.db` + `predictions_*.json` + `results_*.json` into static JSON snapshots committed to the repo. Deployed to Vercel Hobby (project `ut3b5l-3494s-projects/hv-simulator`). Created `wiki/web/pwa.md`, updated `overview.md` and `index.md`. Streamlit `dashboard.py` retained as local race-day cockpit.

---

## [2026-05-28] query | May 27 race day workflow — racecard, odds, dashboard, results

Racecard: 9 races via GraphQL fallback. Odds: 106 entries (14 value bets). Results: 9 races fetched, 22.2% precision.
Technical fixes made: Standby filter in wednesday_agent.py, edge/market_pct/public_odds added to build_predictions(), both committed to git.

---

## [2026-05-17] ingest | Project raw sources (baselines 4A–4D, predictions/results JSON, agent.log)

Updated pages:
- `performance/walkforward.md` — added full per-fold tables for all phases (previously summary only)
- `performance/live-meetings.md` — added full race-by-race picks vs actuals for May 13; added Apr 29 partial entry note
- `model/factors/class.md` — added empirical calibration table (325/4363/541 runs, actual place rates from DB)
- `model/factors/weight-change.md` — added empirical calibration table (5,229 transitions, actual place rates)
- `model/factors/going.md` — added precise walk-forward regression numbers (VB ROI −27.8% when active) and statistical reasoning

Raw sources ingested: `baseline_phase4a.txt`, `baseline_phase4b.txt`, `baseline_phase4c.txt`, `baseline_phase4d.txt`, `predictions_2026-05-13.json`, `results_2026-05-13.json`, `results_2026-04-29.json`, `agent.log`

---

## [2026-05-17] init | Wiki created from Handoff_May_2026.md and project memory

Initial wiki scaffolded from the May 13, 2026 handoff note. All pages synthesised from existing sources — no new knowledge added. Covers phases A through 4D. Live as of May 13, 2026.

Pages created:
- overview, model/architecture, all 8 factor pages
- performance/walkforward, performance/live-meetings (May 13 meeting)
- data/database, data/api
- workflow/operations
- issues/known-issues


## [2026-05-30] experiment | Phase 5 — market-blend combiner (Benter conditional logit)
Discovered the model ignored market odds entirely (used only for value bets).
Benchmarked: market favourite already places top-3 ~61% / wins ~28% vs the
factor model's 34% / 14%. Built a race-grouped conditional logit fusing the
de-vigged market prob with the log-factors (`train_blend.py` → `blend_coef.json`,
applied via `score_race(blend_coef="auto")`). Walk-forward (204 races,
`validate_blend.py`): #1-place 34%→~60%, top-3 precision 34%→50%. Established the
oracle top-3 precision ceiling ~52% (60% is physically unreachable on HV fields).
jf×tf overconfidence and inert hf both resolved by the joint fit. Live in
export_data/dashboard/phase6_importer/race_simulator. New page [[market-blend]].

## [2026-05-30] experiment | Visual Uplift Phase 2 — PWA design-system pass (type scale, layered glass + accent tokens, ProbBar/WPSMeter probability viz, diverging factor bars, finishing-position distribution heatmap+histogram in simulator, SVG nav icons, motion). next build 7/7 green. See [[web/pwa]].

## [2026-05-31] build | PWA Phase 3 — Race Date dropdown portal fix (backdrop-filter z-order), loading skeletons + empty states, incremental rAF Monte Carlo (live convergence + draw progress), pull-to-refresh, offline service worker (prod-only), full light/dark toggle (CSS-var tokens + `light:` variant, no-flash). next build 7/7 green. Committed fd13fc7, pushed, vercel deploy --prod → hv-simulator.vercel.app (verified 200). See [[web/pwa]].

## [2026-06-03] query | Feasibility + plan — in-app dynamic race-day pull + 11pm auto-reconcile. Verdict: feasible via Mac-as-backend (FastAPI over Tailscale) + cron loop closure; cloud rewrite rejected (HK-IP geo-block, serverless Playwright, Python model/DB). New plan page [[web/dynamic-pull-plan]]. Triggered by today's silent 7am racecard-cron failure on a meeting day.

## [2026-06-03] ingest | HV Meeting 2026-06-03 (special between-week, 9 races). Top-3 51.9% (14/27); #1 win 44.4% (4/9), place 55.6% (5/9); R5 perfect, only R4 0/3; no value bets. First true live blend run — ties best night, #1 win well above market. 7am racecard cron failed silently (manual post-hoc pull). 3-meeting avg 42.0% (34/81). See [[performance/live-meetings#2026-06-03]].

## [2026-06-03] build | Weekly automation BUILT (`hv_auto.sh`) — cron pull (11:00/17:30/19:30) + reconcile (23:00/23:30) on Wednesdays, each running scrape → export_data → git → `vercel deploy --prod`. No-ops if no meeting (catches special weeks); Mac-unattended, no laptop/Tailscale needed. Also FIXED a GraphQL bug: bet.hkjc.com serves the NEAREST meeting for a non-meeting date → `_parse_graphql_racecard` now filters by requested date + HV venue (caught during no-op testing; had briefly imported a bogus 2026-06-04 = June-3 data — cleaned up). See [[workflow/operations]], [[web/dynamic-pull-plan]].

## [2026-06-03] build | Betting P&L now a final reconciliation step. `results_agent` scrapes the dividend table (WIN/PLACE/QUINELLA/QUINELLA PLACE) into results JSON; new `bet_report.py` computes flat-$10 P&L on the model top-3 (Win on #1, Place box, Quinella box, Quinella Place box) and prints + saves `bet_report_<date>.json`. Runs after every reconcile (manual + cron). 2026-06-03: Win +$31, QPL +$29, Place −$25.50, Quinella −$134.50. See [[workflow/operations]].

## [2026-06-03] build | PWA Performance page now shows Betting Returns (bet_report → export_data.build_betting → performance.json.betting → BettingReturns.tsx). Lifetime flat-$10 P&L on model top-3: Win-on-#1 +$23.50 (+8.7%, only profitable), Place −$253, Q-Place −$318, Quinella −$493 over 3 mtgs. Backfilled May 13/27 dividends. Verified mobile preview + live (commit 70a745f, vercel deploy, 200). See [[web/pwa]].

## [2026-06-06] build | PWA rebranded **HV Simulator → Zokki** + Synthex-inspired visual overhaul (commit `b79d93d`, deployed live, verified 200). Single LIGHT theme (dark mode + toggle removed): pale mint→blue gradient, frosted near-white glass, #163144 navy text, **Urbanist** font. Palette → navy(#1B405B)+mint(#DFF3EB); gold/green/red kept semantic but retuned to honey/sea-green/coral in that family; all raw Tailwind colors rewired to tokens. Signature navy→teal gradient hero + Zokki wordmark + crisp white active nav pill. New "Z" app icon (PNGs via qlmanage). Deploy also shipped the parked Sha Tin expansion (WinEdge + 2024-11-09 ST demo). User decisions: light-only, near-monochrome navy+mint keeping the 3 functional accents. See [[web/pwa]].

## [2026-06-06] ingest | ST historical backfill COMPLETE — 1,307 Sha Tin races / 16,833 entries now in `happy_valley.db` (2024-01-01 → 2026-05-31, from tianxi-database via `st_backfill`). This run inserted 1,091 races / 14,083 entries, zero errors, auto-resumed once after an overnight pause. Odds 98.5%, finish 98.3%, structural fields ~100%. DB is now two-venue (HV 614 + ST 1,307 = 1,921 races). ST adds `AWT` (Sha Tin all-weather dirt) config + 2000m/2400m distances. See [[data/database]].

## [2026-06-06] experiment | ST market-blend VALIDATED + integrated. Pure-factor walk-forward (`walkforward_test.py --venue ST`, 906 races): #1 win 19.8%, #1 place 45.3%, precision 36.7% vs 23.4% random — on par with HV. Edge backtest (`edge_backtest.py --venue ST`, 716 leak-free test races): blend #1 ROI −12.28% vs market −15.52%, **edge gap +3.24 pts → real edge** (bigger than HV's +1.79); disagree-with-fav pocket n=47 ROI **+14.5%**. Trained `blend_coef_ST.json` (`log_mkt` β=1.117). Made `model_core.load_blend_coef(venue=…)` venue-aware (score_race passes `stats["venue"]`, falls back to HV file) — HV path byte-identical. Merged ST + refreshed HV blocks into `win_edge.json`. PWA frontend already venue-aware (WinEdge.tsx VenueBlock per venue). See [[performance/walkforward]], [[model/market-blend]].

## [2026-06-06] build | Live Sha Tin automation BUILT (venue-aware pipeline). Generalized the HV-Wednesday automation to handle weekend ST meetings: `wednesday_agent.py` + `results_agent.py` gain `--venue {HV,ST}` (parameterized racecard/results URLs, bet.hkjc GraphQL venue filter, `build_stats(venue=)`, and a `venue` field now written into predictions/results JSON); `phase6_importer.insert_race_day(…, venue=)`; `hkjc_odds.py` was already venue-aware. `hv_auto.sh` now probes both venues per date (`VENUES="HV ST"`, default) and processes whichever is racing, attributing the date-keyed JSON by its `venue` tag (`file_is_venue`). Validated the ST live-scoring path on real DB races: ST stats + `blend_coef_ST.json` resolve via `load_blend_coef(venue=…)`, and the market-blend engages on complete-odds ST races (pure-factor 65.5% win → blend 30.7%, anchored to market 35.7%). Weekend ST cron block documented in [[workflow/operations]] but NOT yet installed (activation enables auto prod-deploy). Network fetch layer mirrors the proven HV path but is not yet exercised against a live ST card. See [[workflow/operations]], [[overview]].

## [2026-06-06] build | Weekend Sha Tin cron INSTALLED + ST live-fetch validated + 2nd ST demo added. Installed the weekend block in the live crontab (Sat=6/Sun=0: pull 09:00/11:30/12:30/15:00, reconcile 18:00/18:30; default VENUES="HV ST"), first fire = 2026-06-07 Sunday ST meeting. Validated the previously-untested ST network path: `wednesday_agent.py --venue ST --date 2026-06-07 --dry-run` pulled tomorrow's 11-race Sha Tin card cleanly (distances/classes/runners/going) — the venue-parameterized scraper + GraphQL fallback work for ST. Added a recent ST demo meeting to the PWA: `regen_predictions.py 2026-05-31 --venue ST --with-results` (11 races, blended, settled) → export_data → snapshot now has 5 meetings (2× ST demo: 2026-05-31 + 2024-11-09). Verified in preview: header "SHA TIN · Sun 31 May · 11 races · settled", blended picks, picker lists both ST + HV. See [[workflow/operations]].
