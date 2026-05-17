# Wiki Index

Master catalog of all pages. Updated on every ingest, experiment, or new page creation.

## Overview

| Page | Summary |
|---|---|
| [[overview]] | Project status, goals, live performance headline, what's next |

## Model

| Page | Summary |
|---|---|
| [[model/architecture]] | 9-factor multiplicative engine, key constants, value bet criteria, public API |
| [[model/factors/barrier]] | Barrier IV — win-rate index per (distance, course config, barrier) |
| [[model/factors/jockey-trainer]] | Jockey and trainer factors, 60-day trailing override, floor, known leverage issue |
| [[model/factors/horse]] | Horse exact-trip Bayesian factor, m=10 phantom runs, class-specific prior |
| [[model/factors/form]] | Form factor — recency-weighted last-5 DB runs, decay=0.60, last_6_runs override |
| [[model/factors/rating-days]] | Rating Factor + Days Factor (Phase B, live racecards only) |
| [[model/factors/class]] | Class Factor (Phase 4B) — HKJC class transition signal |
| [[model/factors/weight-change]] | Weight-Change Factor (Phase 4D) — HKJC weight delta signal |
| [[model/factors/going]] | Going Factor (Phase 4C) — built but inactive, insufficient data |

## Performance

| Page | Summary |
|---|---|
| [[performance/walkforward]] | Phase-by-phase walk-forward results, cumulative delta table |
| [[performance/live-meetings]] | Race night results per meeting date |

## Data

| Page | Summary |
|---|---|
| [[data/database]] | DB schema (races, race_entries, paper_trades, horses, jockeys, trainers), current stats |
| [[data/api]] | HKJC racecard and odds endpoints, confirmed scraper notes |

## Workflow

| Page | Summary |
|---|---|
| [[workflow/operations]] | Full live workflow — cron schedule, manual race-day commands, utilities |

## Issues

| Page | Summary |
|---|---|
| [[issues/known-issues]] | Open bugs, inactive features, data gaps, todos |
