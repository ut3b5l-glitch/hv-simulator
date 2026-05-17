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
