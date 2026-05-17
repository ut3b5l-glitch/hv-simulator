# Live Meeting Results

Append a new section for each race night after ingesting results. Most recent first.

---

## 2026-05-13 — Happy Valley (9 races, first live meeting)

**DB state:** 596 races total (587 historical + 9 from this meeting)  
**Import path:** bet.hkjc.com GraphQL fallback (racing.hkjc.com Playwright blocked)

### Summary

| Metric | Result |
|---|---|
| Top-3 precision | **51.9%** (14/27 picks) |
| Value bet ROI | **+6.7%** (+1.2 units on 18 bets) |
| Random baseline | 25.7% |

51.9% vs 32.2% walk-forward average — substantial outperformance on debut night.

### Race-by-Race

| Race | Model Picks (top-3) | Actual Top-3 | Hits | Notes |
|---|---|---|---|---|
| R1 | PODIUM · NOBLE FANS · DRAGON SUNRISE | PODIUM / SETANTA / WAH MAY WAI WAI | 1/3 | PODIUM ✓ |
| R2 | WORLD HERO · NEBRASKAN · FORERUNNER | NEBRASKAN / FORERUNNER / WORLD HERO | 3/3 | Perfect — all 3 placed |
| R3 | ROMANTIC GLADIATOR · ALL ROUND WINNER · SUPER UNICORN | ROMANTIC GLADIATOR / FIVEFORTWO / ALL ROUND WINNER | 2/3 | SUPER UNICORN missed |
| R4 | DASHING MAURISON · ACE POWER · MEGA MASTERMIND | GENERAL REDWOOD / DASHING MAURISON / CAN'T GO WONG | 1/3 | DASHING MAURISON ✓ |
| R5 | ACE WAR · LIVEANDLETLIVE · THE AUSPICIOUS | LIVEANDLETLIVE / THE AUSPICIOUS / ACE WAR | 3/3 | Perfect — user was present betting |
| R6 | HARMONY GALAXY · TAKE ACTION · SHOOTING TO TOP | THE AZURE / TAKE ACTION / RUN RUN TIMING | 1/3 | jf×tf leverage failure |
| R7 | VIGOR EYE · TACTICAL COMMAND · LEADING AGILITY | LEADING AGILITY / AMAZING VICTORY / YOUNG ARROW | 1/3 | VIGOR EYE had 59.8% model win prob → finished P12 |
| R8 | AURIO · HARMONY N BLESSED · MATTERS MOST | MOTOR / SON PAK FU / AURIO | 1/3 | jf×tf leverage failure |
| R9 | HELENE FEELING · SOLEIL FIGHTER · SILVERY BREEZE | PACKING ANGEL / SOLEIL FIGHTER / BEAUTY ALLIANCE | 1/3 | jf×tf leverage failure |

**Total: 14/27 = 51.9%**. R2 and R5 perfect; R3 2/3; R1 and R4 partial; R6-R9 each 1/3.

### Post-Mortem

**What worked:** Form factor, class factor, weight-change factor, Harville formula, edge threshold.

**What failed:** R6-R9 were dominated by high `jf × tf` combinations. When the favoured jockey/trainer pairing underperformed, the model had severely over-allocated probability to those horses, leaving no credit for the actual top-3 finishers.

Root cause: jf×tf leverage. See [[model/factors/jockey-trainer#jf-tf-leverage]] and [[issues/known-issues]].

### Technical Notes

- 101 runners total (R3 and R5 had 1 scratch each); all odds applied via DOM scraper (`hkjc_odds.py`)
- `predictions_2026-05-13.json` and `results_2026-05-13.json` in project root
- Results settled by `results_agent.py` at 23:06 HKT
- No paper trades were logged or settled for this meeting
- Value bets: `predictions_2026-05-13.json` shows no `is_value_bet` flags — the pre-odds predictions file was saved; hkjc_odds.py may not have refreshed the JSON

---

## 2026-04-29 — Happy Valley (partial — R1 only)

**Note:** Only R1 result recorded. This meeting was ingested before `wednesday_agent.py` was operational — no predictions were run. Results were settled on 2026-05-06.

| Race | Actual Top-3 |
|---|---|
| R1 (race_id 587) | DASHING MAURISON / SPLENDID FORCE / FAMILY FORTUNE |

Race 587 also lacks Phase B data (`official_rating`, `days_since_last_run`, `last_6_runs` = NULL). Re-run `phase6_importer.py` on the Apr 29 HTML to backfill.

---

*Add new meetings above this line.*
