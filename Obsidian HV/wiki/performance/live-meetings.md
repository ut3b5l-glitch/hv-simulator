# Live Meeting Results

Append a new section for each race night after ingesting results. Most recent first.

---

## 2026-05-27 — Happy Valley (9 races)

**DB state:** 614 races total (605 historical + 9 from this meeting)
**Import path:** bet.hkjc.com GraphQL fallback. Going updated to GOOD TO FIRM pre-race.
**Standby runners fixed:** 16 reserve/standby runners excluded from import (parser fix committed).

### Summary

| Metric | Result |
|---|---|
| Top-3 precision | **22.2%** (6/27 picks) |
| Value bet results | 0/14 won, 3/14 placed, 11/14 lost |
| Random baseline | 25.7% |

22.2% — worst live meeting to date. Below the 25.7% random baseline.

### Race-by-Race

| Race | Model Picks (top-3) | Actual Top-3 | Hits | Notes |
|---|---|---|---|---|
| R1 | HAPPY ACTION · NOBLE DELUXE · SOLAR RIVER | BASIC INSTINCT / BINGO BABE / EXCEED THE WISH | 0/3 | Complete miss |
| R2 | PERFECT PAIRING · KASA PAPA · SMART BEAUTY | ROSEWOOD FLEETFOOT / PERFECT PAIRING / SMART BEAUTY | 2/3 | Best race of the night |
| R3 | WITHALLMYFAITH · ROMANTIC LAOS · BEAUTY VIVA | AUDACIOUS PURSUIT / WITHALLMYFAITH / LEGEND WINNER | 1/3 | WITHALLMYFAITH placed 2nd |
| R4 | THE PERFECT MATCH · FIND MY LOVE · COUNTRY PRIDE | BRIGHT DAY / LOVING VIBES / KWAI CHUNG TALENTS | 0/3 | Complete miss |
| R5 | FANTASTIC FUN · ALL ROUND WINNER · ARMOR GOLDEN EAGLE | ARMOR GOLDEN EAGLE / HIGHLAND RAHY / EMBRACES | 1/3 | ARMOR GOLDEN EAGLE won |
| R6 | WORLD HERO · CROSSBORDERDUDE · RAINBOW SEVEN | ELEGANT LIFE / DAN ATTACK / BULLISH NOVA | 0/3 | Complete miss (1 scratch) |
| R7 | HAPPY SHOOTER · SPIRIT OF PEACE · NEW POWER | LUCKY MCQUEEN / LEAN MASTER / NEW POWER | 1/3 | NEW POWER ✓ |
| R8 | HORSEPOWER · CASA OF HONOR · LA FORZA | SUPERB CAPITALIST / HORSEPOWER / CANDLELIGHT DINNER | 1/3 | HORSEPOWER placed |
| R9 | HONEST WITNESS · MATTERS MOST · SPORTS LEGEND | SON PAK FU / GUMMY GUMMY / SPICY GOLD | 0/3 | Complete miss — top VB (84.1%) finished out of frame |

**Total: 6/27 = 22.2%**. 4 races went 0/3 (R1, R4, R6, R9). Only R2 had a strong call (2/3).

### Value Bet Results

| Race | Horse | Edge | Odds | Model% | Result |
|---|---|---|---|---|---|
| R2 | PERFECT PAIRING | +58.6% | 6.4 | 74.2% | Placed ✓ |
| R9 | HONEST WITNESS | +55.5% | 3.5 | 84.1% | **Lost** |
| R1 | HAPPY ACTION | +37.7% | 31.0 | 41.0% | **Lost** |
| R5 | FANTASTIC FUN | +36.0% | 12.0 | 44.3% | **Lost** |
| R6 | WORLD HERO | +32.6% | 7.3 | 46.3% | **Lost** |
| R7 | HAPPY SHOOTER | +27.1% | 10.0 | 37.1% | **Lost** |
| R4 | THE PERFECT MATCH | +23.2% | 7.4 | 36.8% | **Lost** |
| R3 | WITHALLMYFAITH | +21.7% | 2.4 | 63.4% | Placed ✓ |
| R1 | NOBLE DELUXE | +14.6% | 11.0 | 23.7% | **Lost** |
| R8 | LA FORZA | +13.2% | 41.0 | 15.7% | **Lost** |
| R8 | CASA OF HONOR | +12.2% | 14.0 | 19.3% | **Lost** |
| R5 | ALL ROUND WINNER | +10.1% | 3.8 | 36.5% | **Lost** |
| R4 | FIND MY LOVE | +9.7% | 7.9 | 22.4% | **Lost** |
| R8 | HORSEPOWER | +6.8% | 4.1 | 31.2% | Placed ✓ |

**0/14 won, 3/14 placed, 11/14 lost.** Edge-heavy calls (HONEST WITNESS 84.1%, PERFECT PAIRING 74.2%) were extreme overconfidence — canonical jf×tf leverage failures.

### Post-Mortem

**jf×tf leverage is the dominant issue.** Model win probabilities of 74–84% are epistemically unjustified in a 12-runner field. HONEST WITNESS (84.1% model, favourite at 3.5) finished out of the frame entirely. This is a repeat of the R7 VIGOR EYE failure from May 13.

The model is producing near-certain probabilities for horses where a correlated jockey+trainer combination compounds their individual factors. The market (which is efficient for HV) had HONEST WITNESS at 3.5 — implying ~28% win probability. The model estimated 84%. That 56-point gap is almost entirely jf×tf overcounting.

**4 complete misses (R1, R4, R6, R9):** in all four, the actual winner was ranked 4th or lower by the model. This is the horse factor being inert (hf=1.0 for all runners) — the model has no way to distinguish horses based on form beyond the last_6_runs field.

**What worked:** R2 (2/3), R5 ARMOR GOLDEN EAGLE (winner), HORSEPOWER placed. Form factor picked up the right direction in several races.

**Priority fix remains:** Cap jf×tf interaction — geometric mean `sqrt(jf*tf)` or hard cap JT_CAP ≤ 3.0. This is the single highest-leverage change available. See [[issues/known-issues#jf-tf-leverage]].

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
