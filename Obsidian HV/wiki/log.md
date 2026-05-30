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
