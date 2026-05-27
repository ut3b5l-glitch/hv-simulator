# HV Simulator — Wiki Schema

This file is the operating schema for the LLM Wiki embedded in this project. It tells Claude Code how to maintain the `Obsidian HV/wiki/` directory as a persistent, compounding knowledge base for the Happy Valley horse racing simulator.

## Three-Layer Architecture

**Raw sources** — immutable. Claude reads but never modifies. HTML race cards, JSON predictions/results, baseline TXT files, handoff notes — all in the project root. Source of truth.

**Wiki** (`Obsidian HV/wiki/`) — Claude-maintained markdown. All knowledge synthesis lives here. Claude writes and updates it; the human reads and browses it in Obsidian (open `Obsidian HV/` as the vault).

**Schema** (this file) — defines structure, conventions, and workflows. Co-evolve with Claude as the project grows.

**Web app** (`web/`) — Next.js 14 PWA deployed to https://hv-simulator.vercel.app. Read-only mobile dashboard fed by JSON snapshots in `web/public/data/` produced by `export_data.py`. See [[web/pwa]] for details.

## Directory Structure

```
Obsidian HV/wiki/
  index.md               ← master catalog (update on every operation)
  log.md                 ← append-only timeline (update on every operation)
  overview.md            ← project status, goals, live performance headline
  model/
    architecture.md      ← 9-factor engine, constants, value bet criteria, public API
    factors/
      barrier.md
      jockey-trainer.md
      horse.md
      form.md
      rating-days.md     ← Rating Factor + Days Factor (Phase B, live only)
      class.md
      weight-change.md
      going.md           ← built but inactive
  performance/
    walkforward.md       ← phase-by-phase walk-forward results table
    live-meetings.md     ← per-meeting race night results
  data/
    database.md          ← DB schema, current stats, column notes
    api.md               ← HKJC scraper/API notes, confirmed endpoints
  workflow/
    operations.md        ← cron schedule, manual race-day commands
  issues/
    known-issues.md      ← bugs, gaps, todos, with status
  web/
    pwa.md               ← Vercel PWA architecture, refresh workflow, deploy notes
```

## Raw Source Locations

| Type | Location |
|---|---|
| Race card HTML | `raw_race_*.html`, named HTML files (project root) |
| Results HTML | Named `*results*.html` files (project root) |
| Predictions JSON | `predictions_YYYY-MM-DD.json` (project root) |
| Results JSON | `results_YYYY-MM-DD.json` (project root) |
| Phase baselines | `baseline_phase4*.txt` (project root) |
| Handoff notes | `Handoff_May_2026.md` (project root) |

---

## Operations

### Ingest — After a Race Meeting

Trigger: user says "ingest [date] meeting" or shares results data.

1. Read `results_YYYY-MM-DD.json` and `predictions_YYYY-MM-DD.json` for the date.
2. Add a new dated section to `wiki/performance/live-meetings.md` — races, picks, top-3 hits, value bets flagged, ROI.
3. Update `wiki/overview.md` — refresh live performance stats, note standout results or failures.
4. If any new issues or post-mortems emerge, update `wiki/issues/known-issues.md`.
5. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | HV Meeting YYYY-MM-DD`
6. Update `wiki/index.md` if new pages were created.
7. **Refresh the mobile PWA** — run `python export_data.py`, then `git add web/public/data && git commit -m "data: YYYY-MM-DD" && git push`. Vercel auto-deploys. See [[web/pwa]].

### Experiment — After a Walk-Forward Test

Trigger: user runs `walkforward_test.py` or introduces a new phase.

1. Add the new results row to `wiki/performance/walkforward.md` cumulative table.
2. If factor logic changed (new factor, calibration, removal): update the relevant `wiki/model/factors/*.md` page and `wiki/model/architecture.md`.
3. Update `wiki/overview.md` performance headline.
4. If a new issue surfaced, update `wiki/issues/known-issues.md`.
5. Append to `wiki/log.md`: `## [YYYY-MM-DD] experiment | Phase X — description`

### Query — Research / Synthesis

Trigger: user asks a question requiring cross-page synthesis.

1. Read `wiki/index.md` to find relevant pages, then read them.
2. Synthesize an answer with citations to wiki pages.
3. If the answer is non-trivial (comparison, discovery, analysis), file it back into the wiki as a new page or section — don't let good synthesis disappear into chat history.
4. Append to `wiki/log.md`: `## [YYYY-MM-DD] query | <question summary>`

### Lint — Wiki Health Check

Trigger: user says "lint the wiki".

Check for:
- Stale numbers: does `overview.md` match `walkforward.md` and `live-meetings.md`?
- Orphaned pages: anything not listed in `index.md`?
- Resolved issues still listed as open in `known-issues.md`?
- Factor pages out of sync with `model_core.py` constants?
- Missing cross-references between related pages?

---

## Page Format Conventions

- First heading is `# Title` (one per page)
- Sections use `## ` and `### `
- Cross-references use `[[page-name]]` Obsidian wikilinks
- Code and constants in backtick inline code
- Tables for structured data (metrics, factor values, schema columns)
- Every page must have an entry in `index.md`

## Log Entry Format

```
## [YYYY-MM-DD] <operation> | <description>
```

Grep shortcuts:
```bash
grep "^## \[" "Obsidian HV/wiki/log.md" | tail -10      # last 10 entries
grep "ingest" "Obsidian HV/wiki/log.md"                  # all race meetings
grep "experiment" "Obsidian HV/wiki/log.md"              # all phase tests
```

---

## Domain Notes (Read in Every Session)

- **HKJC-specific:** Class and weight-change factors are **opposite** to Western racing. Rising class / gaining weight = positive HKJC momentum signal (official rating went up).
- **Harville formula:** Converts normalised win probabilities to place/show probabilities.
- **Trailing override:** Jockey/trainer 60-day trailing stats override career stats when ≥ `TRAILING_MIN=10` rides in window. Floor = 0.20.
- **Phase B columns:** `official_rating`, `rating_change`, `days_since_last_run`, `last_6_runs` are NULL for all historical rows. Only live racecard imports populate them.
- **Single source of truth:** ALL factor logic lives in `model_core.py`. Never duplicate in other files.
- **Phase 5 (ML):** Do not start before November 2026. Needs ~26 live meetings of Phase B data.
- **jf × tf leverage:** Known issue — jockey and trainer factors are correlated but treated as independent, causing overconfidence. See `wiki/issues/known-issues.md`.
