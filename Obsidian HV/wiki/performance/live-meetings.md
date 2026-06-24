# Live Meeting Results

Append a new section for each race night after ingesting results. Most recent first.

---

## 2026-06-24 — Happy Valley (9 races)

A **longshot-heavy card** with a middling top-3 night (**12/27 = 44.4%**, below the recent HV run-rate but inside normal variance) — yet the headline **WIN-on-#1 strategy printed +61.7% ROI**, the second straight green HV WIN night. Six of nine winners paid ≥ $42, including two big upsets (BLOSSOMY $151.5 R4, DEFINITIVE $133.5 R9), but the three races our #1 pick actually won (ROSEWOOD FLEETFOOT $32, ALL ARE MINE $42, SKY CAP $71.5) were all generously priced — so a small win-bet book cleared a large profit. **No value bets flagged** (market blend), so live paper-trading was flat; the P&L below is the hypothetical flat-stake-the-top-3 book.

> **Data note:** the 23:00 auto-reconcile captured only **R1–R8** — R9 (the last race, DEFINITIVE) had not posted results when the cron fired, and the probe `break`s on the first missing race. Pulled all 9 cleanly via `results_agent.py --venue HV --date 2026-06-24` on the night. This is the **third** occurrence of the reconcile-before-last-race-posts truncation (also 2026-06-10, 2026-06-13). See [[issues/known-issues#reconcile-before-last-race-posts]].

| Race | Model Top-3 | Actual Top-3 | Hits | Note |
|---|---|---|---|---|
| R1 | ROSEWOOD FLEETFOOT · CARRYON SMILING · PERFECT PAIRING | ROSEWOOD FLEETFOOT / GOLDEN FORTUNE / DRAGON SUNRISE | 1/3 | **#1 WIN @ $32** |
| R2 | ALL ARE MINE · ORIENTAL SURPRISE · WINDICATOR FAMILY | ALL ARE MINE / ORIENTAL SURPRISE / IRON LEGION | 2/3 | **#1 WIN @ $42** |
| R3 | NOBLE PURSUIT · TAKE ACTION · FLYING FORTUNE | FLYING FORTUNE / MIGHTY STEED / STAR FIGURE | 1/3 | our #3 (FLYING FORTUNE) won @ $46; #1 missed |
| R4 | VIVACIOUS WIN · CHARMING LEGEND · EXCEED THE LIMIT | BLOSSOMY / CHARMING LEGEND / VIVACIOUS WIN | 2/3 | #1 placed (3rd); BLOSSOMY upset @ $151.5 |
| R5 | QUARTZ LEGEND · GAMEPLAYER ELITE · GRATIFIDE | MEOWTH / GAMEPLAYER ELITE / GRATIFIDE | 2/3 | #1 missed; MEOWTH won @ $27 |
| R6 | SPIRIT OF PEACE · GEORGIAN SIGMA · GOOD LUCK HAPPY | DANICA'S CHOICE / CLOUD NINE / GOOD LUCK HAPPY | 1/3 | our #3 (GOOD LUCK HAPPY) placed 3rd |
| R7 | SKY CAP · ROBOT LUCKY STAR · CENTRAL BANK | SKY CAP / PEGAS / BUNTA BABY | 1/3 | **#1 WIN @ $71.5** |
| R8 | DO YOU JUST · THE HEIR · SYMBOL OF STRENGTH | JUMBO TREASURE / HONEST WITNESS / YOUNG EMPEROR / THE HEIR | 1/3 | dead-heat for 3rd; our #2 (THE HEIR) in it; JUMBO TREASURE won @ $72.5 |
| R9 | MIGHTY COMMANDER · ROMANTIC GLADIATOR · LEGEND WINNER | DEFINITIVE / ROMANTIC GLADIATOR / FIVEFORTWO | 1/3 | our #2 (ROMANTIC GLADIATOR) 2nd; DEFINITIVE won @ $133.5 |

**Top-3: 12/27 = 44.4%.** #1 WIN 3/9 (33.3%: ROSEWOOD FLEETFOOT R1, ALL ARE MINE R2, SKY CAP R7); #1 PLACE 4/9 (44.4%).

### Betting P&L (flat HK$10, model top-3)

| Strategy | Staked | Net | ROI |
|---|---|---|---|
| WIN on #1 | $90 | +$55.50 | **+61.7%** ✅ |
| Place (3 picks) | $270 | +$36.00 | +13.3% ✅ |
| Q-Place box | $270 | −$6.50 | −2.4% ❌ |
| Quinella box | $270 | −$120.50 | −44.6% ❌ |

### Post-Mortem

Top-3 precision (44.4%) was the weakest of the live HV meetings to date, dragged by a chalk-unfriendly card — three winners returned ≥ $71 and two were genuine bombs ($151.5, $133.5) that no top-3 model would shortlist. But the meeting is a clean illustration of the **win-vs-precision divergence working in our favour for once**: the model's three #1 winners were all priced $32–$71.5, so WIN-on-#1 returned $145.50 on $90 (+61.7%) — the inverse of the recurring Sha Tin pattern where high precision pairs with short winners and a losing WIN book. Place betting was also green (+13.3%), carried by R5 (GAMEPLAYER + GRATIFIDE) and R4. Quinella box bled (only R2's ALL ARE MINE/ORIENTAL SURPRISE pairing hit) — exotics need both legs and the longshot winners broke the boxes. **Zero value bets** again, consistent with the market-blend anchoring model prob to de-vigged market prob. Operationally, the reconcile truncation recurred for the third time — the fix (later final-race slot or no-break probe) is now overdue. See [[issues/known-issues#reconcile-before-last-race-posts]].

---

## 2026-06-13 — Sha Tin (11 races, second live ST meeting)

Best top-3 night of the live era — **18/33 = 54.5%**, above every prior live meeting and ~22 pts over the 32.2% walk-forward baseline. Two perfect 1-2-3 sweeps (R1, R7). But **#1-pick win was weak (2/11, 18.2%)** and both winners were short — so flat win-betting lost heavily; the only green line was the Q-Place box (+11.4%).

> **Data note:** the 23:00-era pipeline only settled R1–R5 on race night (the auto-pull caught the first 5 races mid-card and never reconciled the back half). R6–R11 were pulled and settled on **2026-06-19** via `results_agent.py --venue ST --date 2026-06-13`. The accuracy below is the full 11-race card.

| Race | Model Top-3 | Actual Top-3 | Hits | Note |
|---|---|---|---|---|
| R1 | JEDI SPURS · QUANTUM WUKONG · CHANCHENG SPARKLE | JEDI SPURS / CHANCHENG SPARKLE / QUANTUM WUKONG | 3/3 | **#1 WIN · perfect sweep** |
| R2 | THE ALL ROUNDER · ROBOT KNIGHT · ALWAYS FLUKE | COUNTRY DANCER / ALWAYS FLUKE / VERBIER | 1/3 | model split from favourite |
| R3 | FRANCIS MEYNELL · FLASH CURRENT · MIGHTY FIGHTER | PRESTIGE HALL / SKY DEEP / CALL ME SPARKLE | 0/3 | complete miss |
| R4 | ENTHRALLED · ABSOLUTE HONOUR · SMART FAT CAT | FOREVER FOLKS / SMART FAT CAT / ENTHRALLED | 2/3 | #1 placed (3rd) |
| R5 | ONE MAN SHOW · HAPPY SHOOTER · MEGA CAPTAIN | MEGA CAPTAIN / PEJIBAYE / HAPPY SHOOTER | 2/3 | |
| R6 | GORGEOUS VICTORY · GHORGAN · VOYAGE BOSS | MEANINGFUL DRAGON / GORGEOUS VICTORY / VOYAGE BOSS | 2/3 | #1 placed (2nd) |
| R7 | SUPERB SPIRIT · LUCRATIVE EIGHT · ISLAND BUDDY | SUPERB SPIRIT / LUCRATIVE EIGHT / ISLAND BUDDY | 3/3 | **#1 WIN · perfect sweep** |
| R8 | PACKING ANGEL · MIGHTY MASTS · SAGACIOUS LIFE | SOLEIL FIGHTER / BEAUTY ALLIANCE / SAGACIOUS LIFE | 1/3 | |
| R9 | VICTORY SKY · BLAZING WIND · PI LEGEND | PI LEGEND / TURQUOISE VELOCITY / MUST GO | 1/3 | |
| R10 | BIG RETURN · ENDUED · TRINITY TREASURE | ENDUED / BIG RETURN / COMPLETE UNKNOWN | 2/3 | #1 placed (2nd) |
| R11 | SUPER EXPRESS · HAPPY BOSS · AKASHVANI | BABY SAKURA / SUPER EXPRESS / THE RED HARE | 1/3 | #1 placed (2nd) |

**Top-3: 18/33 = 54.5%.** #1 WIN 2/11 (18.2%: JEDI SPURS R1, SUPERB SPIRIT R7); #1 PLACE 6/11 (54.5%).

### Betting P&L (flat HK$10, model top-3)

| Strategy | Staked | Net | ROI |
|---|---|---|---|
| WIN on #1 | $110 | −$77.00 | −70.0% ❌ |
| Place (3 picks) | $330 | −$12.50 | −3.8% ❌ |
| Quinella box | $330 | −$20.50 | −6.2% ❌ |
| Q-Place box | $330 | +$37.50 | **+11.4%** ✅ |

### Post-Mortem

A high top-3 precision (54.5%) that didn't convert to betting profit — the same Sha Tin pattern as June 7. The model sorts ST fields well (two perfect sweeps, six races ≥2/3) but its **#1 pick won only 2 of 11, and both winners (JEDI SPURS, SUPERB SPIRIT) were short**, so WIN-on-#1 returned just $33 on $110. Exotics were near break-even; only the Q-Place box cleared profit. One complete miss (R3). No value bets flagged — consistent with the market-blend keeping model prob close to the market. The win-vs-place gap (18% win, 55% place) is now a recurring ST signature: **the engine is a strong shortlist tool on Sha Tin, not a winner-picker.**

---

## 2026-06-10 — Happy Valley (9 races)

Strong HV night — **top-3 13/27 = 48.1%**, the best HV meeting since the May 13 debut and well above the 32.2% walk-forward baseline. **#1 pick won 3/9 (33.3%)** vs the ~28% market-favourite expectation; #1 place (top-3) 5/9 (55.6%).

| Race | Model Top-3 | Actual Top-3 | Hits | Note |
|---|---|---|---|---|
| R1 | KINGLY DEMEANOR · KYRUS TREASURE · PERFECT PAIRING | KYRUS TREASURE / KINGLY DEMEANOR / DRAGON SUNRISE | 2/3 | #1 placed (2nd) |
| R2 | NOBLE PURSUIT · PRECISION HOPE · LEGEND WINNER | LEGEND WINNER / PRECISION HOPE / SURE JOYFUL | 2/3 | |
| R3 | BULLISH NOVA · SILVER SPURS · HEROIC VANGUARD | HOLMES A COURT / GOLDEN FRIENDSHIP / KING OBERON | 0/3 | complete miss |
| R4 | GRAND NOVA · JUMBO BLESSING · WINNING MONEY | GRAND NOVA / BEAUTY SHOW / HARMONY FIRE | 1/3 | **#1 WIN** |
| R5 | DECISION LINK · ABSOLUTE AWAKENED · VIVA FIRECRACKER | VIVA FIRECRACKER / STURDY RUBY / GENERAL REDWOOD | 1/3 | |
| R6 | ELEGANT LIFE · SUPERB KING · LIVE WIRE | LIVE WIRE / GIANT LEAP / ELEGANT LIFE | 2/3 | #1 placed (3rd) |
| R7 | THE AUSPICIOUS · SHAMUS STORM · AUDACIOUS PURSUIT | LE ZONDA / FORTUNATE SON / GLITTERING LEGEND | 0/3 | complete miss |
| R8 | TYCOON RESOURCES · REFUSETOBEENGLISH · SZERYNG | TYCOON RESOURCES / REFUSETOBEENGLISH / SZERYNG | 3/3 | **perfect 1-2-3 sweep** |
| R9 | TARGET AUDIENCE · STORMING DRAGON · FLYING WROTE | TARGET AUDIENCE / FLYING WROTE / MOTOR | 2/3 | **#1 WIN @ $43 longshot** |

**Top-3: 13/27 = 48.1%.** #1 WIN 3/9 (33.3%: GRAND NOVA R4, TYCOON RESOURCES R8, TARGET AUDIENCE R9); #1 PLACE 5/9 (55.6%).

### Betting P&L (flat HK$10, model top-3)

| Strategy | Staked | Net | ROI |
|---|---|---|---|
| WIN on #1 | $90 | +$54.00 | **+60.0%** ✅ |
| Place (3 picks) | $270 | −$49.50 | −18.3% ❌ |
| Quinella box | $270 | +$60.00 | **+22.2%** ✅ |
| Q-Place box | $270 | +$7.00 | +2.6% ✅ |

Best play: Quinella box (+$60, +22.2%). Three of four strategies profitable — the first clearly green betting night of the live era, driven by R9's TARGET AUDIENCE winning at a $43 WIN dividend. Two of the three winning #1 picks (TARGET AUDIENCE, GRAND NOVA) were not the shortest favourite, so the model added real edge over blindly backing the market.

### Highlights

- **R8 perfect sweep** — the model's exact 1-2-3 (TYCOON RESOURCES / REFUSETOBEENGLISH / SZERYNG) matched the official 1-2-3.
- **R9 longshot win** — TARGET AUDIENCE (model #1) won at $43, with FLYING WROTE (model #3) 2nd. Full 12-horse field; see the reconcile note below.
- Two complete misses (R3, R7) — consistent with ~48% precision on ~12-horse fields.

### Reconcile note — race 9 truncation (timing, not an incident)

The automated **23:00 reconcile captured only 8 races**: it fetched R1–R8, then hit "R9 results … not found" and stopped (the probe `break`s on the first missing race). R9 is the last race of the night and HKJC had not yet posted its results/dividends at 23:00. A manual re-run shortly after pulled all 9 races cleanly.

Race 9 itself was a **normal full 12-horse field** — all 12 finished, with a complete dividend pool through First 4 / Quartet / Trio / Tierce and a $547,863 Six Up jackpot (4-leg exotics are impossible in a small field). No stewards' incident, no reduced field; the "missing race 9" in the app was purely the early-cron timing gap. See [[known-issues]] (reconcile-before-last-race-posts).

---

## 2026-06-07 — Sha Tin (FIRST LIVE ST MEETING)

First live-automated **Sha Tin** meeting — 11 races, 143 runners, market-blend scored. Card + odds pulled and all 11 races reconciled via the venue-aware weekend pipeline (after three automation bugs were fixed same-day — see below and [[known-issues]]).

| Race | Model Top-3 | Actual Top-3 | Hits | Note |
|---|---|---|---|---|
| R1 | FIREFOOT · HAILTOTHEVICTORS · HAPPYDEARHAPPYDEER | FIREFOOT / HAILTOTHEVICTORS / GOLDEN FORTUNE | 2/3 | #1 WIN |
| R2 | WINNING MACHINE · CARRYON SMILING · MAZING GRACE | TOP TO SKY / WINNING MACHINE / DOUBLE BINGO | 1/3 | #1 placed |
| R3 | BETTER AND BETTER · MASTER PAYMENT · SKY DEEP | MASTER PAYMENT / NEXT FORTUNE / BETTER AND BETTER | 2/3 | #1 placed |
| R4 | MASTER LUCKY · SOLID CAR · STRATHPEFFER | HONORARY / MASTER LUCKY / POLAR PATCH | 1/3 | #1 placed |
| R5 | ALLCASH · ARIEL · NIGHT PUROSANGUE | LEAPING STAR / HAPPY UNIVERSE / CHILL KAKA | 0/3 | complete miss |
| R6 | ACE · RELIABLE DAD · AMAZING DUCK | ACE / VICTOR SUPREME / LUCKY YEAR | 1/3 | #1 WIN |
| R7 | LITTLE MONSTER · VIRTUS GLORY · ENJOY GOLF | LEADING DRAGON / VIRTUS GLORY / ENJOY GOLF | 2/3 | |
| R8 | LIGHTNESS OF MUSIC · LUCKY CANDY · SUPER STRONG KID | LOVE TOGETHER / LUCKY CANDY / INVINCIBLE STEED | 1/3 | |
| R9 | GUSTOSISIMO · STAY COSMIC · CHILL BUDDY | CHILL BUDDY / EFFORTLESS WIN / LADY'S CHOICE | 1/3 | |
| R10 | VICTOR THE WINNER · STORM RIDER · MAGIC CONTROL | HOT DELIGHT / MAGIC CONTROL / PUBLIC ATTENTION | 1/3 | |
| R11 | FIT FOR BEAUTY · MAKE YOU SMILE · TRUE BROTHERS | CHILL EASY / RUN RUN SMART / KING EQUINE | 0/3 | complete miss |

**Top-3: 12/33 = 36.4%.** #1 WIN 2/11 (18.2%, FIREFOOT R1 + ACE R6); #1 PLACE 5/11 (45.5%).

### Betting P&L (flat HK$10, model top-3)

| Strategy | Staked | Net | ROI |
|---|---|---|---|
| WIN on #1 | $110 | −$44 | −40.0% |
| Place (3 picks) | $330 | −$91 | −27.6% |
| Quinella box | $330 | −$293 | −88.8% |
| Q-Place box | $330 | −$233 | −70.6% |

### Post-Mortem

A losing night across all four strategies, but **within model variance, not a breakdown**: #1 win 18.2% and place 45.5% sit right on the ST backtest baselines (19.8% / 45.3% — see [[walkforward]]). The damage came from the dividend side — both winners were short favourites (FIREFOOT $2.80, ACE $3.80), so WIN-on-#1 returned only $66 on $110 staked even at 2/11. Exotics were brutal (Quinella −88.8%): a 36.4% top-3 precision rarely produces boxed quinellas. Two complete misses (R5, R11).

### Technical Notes — automation bugs surfaced & fixed

This meeting was the **first real fire of the weekend ST cron** (installed 2026-06-06) and exposed three defects:

1. **zsh word-split in `hv_auto.sh`** — `for V in $VENUES` (default `"HV ST"`) ran once with `V="HV ST"` because zsh doesn't word-split unquoted vars. All 6 of today's cron fires (4 pulls + 2 reconciles) crashed on `--venue "HV ST"` and were **masked as a benign `no meeting — no-op`**. Fixed → `${=VENUES}`.
2. **`results_agent.py` off-by-one** — `range(1, MAX_RACES)` with `MAX_RACES=11` only probed R1–R10, so **R11 was never fetched**. Latent for HV (8–9 races) but silently dropped the last race of every ST card. Fixed → `range(1, MAX_RACES+1)`.
3. Initial reconciles showed 7→10 races only because HKJC posts dividends progressively (not a bug); the final run got all 11.

Recovered manually same-day (pull + reconcile via the fixed script, deployed to the PWA). See [[known-issues]].

### Scheduling gap (open)

Weekend cron reconcile slots are **18:00 / 18:30**, but a Sunday ST card isn't fully settled until ~21:00+. Today needed manual re-runs at 21:3x. **Recommend adding a later weekend reconcile slot (~20:30 / 21:00).** See [[operations]].

---

## 2026-06-03 — Happy Valley (9 races)

**DB state:** 623 races total (614 prior + 9 from this meeting; race_ids 615–623).
**Import path:** bet.hkjc.com GraphQL fallback (racing.hkjc.com timed out — Playwright block).
**Note:** This was a **special between-week Wednesday meeting** (off the normal fortnightly cadence). The 7am racecard cron **failed silently** — no card/predictions were produced; the full pipeline (racecard → odds → results) was run manually post-hoc the same evening. Picks are therefore on **closing odds**; the model never sees results, so it remains a valid skill read. First genuinely live outing for the Phase 5 market-blend (May 13/27 were blend-scored retroactively).

### Summary

| Metric | Result |
|---|---|
| Top-3 precision | **51.9%** (14/27 picks) |
| #1 pick win rate | **44.4%** (4/9) |
| #1 pick place rate | **55.6%** (5/9) |
| Value bets | none flagged (edge >5% & win >10%) — expected for market-anchored blend |
| Random baseline | 25.7% |

Tied with the May 13 debut for the **best live night to date**, and a full reversal of May 27. Top-3 precision sits on the model's ~52% ceiling; #1-pick win rate (44.4%) is well above the ~28% market-favourite expectation.

### Race-by-Race

| Race | Model Picks (top-3) | Actual Top-3 | Hits | Notes |
|---|---|---|---|---|
| R1 (C5) | FAMILY FORTUNE · WAH MAY WAI WAI · SETANTA | FAMILY FORTUNE / THE WAY WE WIN / TELECOM POWER | 1/3 | **Top pick WON** (2.7) |
| R2 (C5) | ALWAYS MY FOLKS · RUNJEET · AUTUMN VIBES | MAJESTIC DELIGHT / AUTUMN VIBES / SONIC BOOM | 1/3 | Top pick 5th; AUTUMN VIBES placed |
| R3 (C4) | YOUNG ARROW · LEADING AGILITY · SAME TO YOU | FORERUNNER / SAME TO YOU / LEADING AGILITY | 2/3 | Winner FORERUNNER was the pre-refresh #3 pick (closing-odds wobble) |
| R4 (C4) | RUN RUN TIMING · DASHING MAURISON · SAVVY WARRIOR | TAKE ACTION / EXCEED THE LIMIT / CAN'T GO WONG | 0/3 | **Bust** — top pick (2.4 fav) finished last (12th) |
| R5 (C4) | BROWNNEEDSFURTHER · LOVING VIBES · GEORGIAN SIGMA | BROWNNEEDSFURTHER / LOVING VIBES / GEORGIAN SIGMA | 3/3 | **Perfect** — exact 1-2-3; top pick WON |
| R6 (C4) | THE HEIR · NEBRASKAN · MEOWTH | THE HEIR / MEOWTH / VIGOR EYE | 2/3 | **Top pick WON** |
| R7 (C3) | ACE CHAMPION · AMAZING KID · KING PROFIT | POWER KOEPP / KING PROFIT / ACE CHAMPION | 2/3 | ACE CHAMPION 3rd; KING PROFIT placed |
| R8 (C2) | ARMOR GOLDEN EAGLE · LIVEANDLETLIVE · BEAUTY ALLIANCE | SILVERY BREEZE / LIVEANDLETLIVE / CALIFORNIATOTALITY | 1/3 | Top pick 5th; LIVEANDLETLIVE placed |
| R9 (C3) | WITHOUT COMPARE · FIVEFORTWO · ALL ROUND WINNER | WITHOUT COMPARE / STORMI / FIVEFORTWO | 2/3 | **Top pick WON** |

**Total: 14/27 = 51.9%.** Four winning top picks (R1, R5, R6, R9); R5 a clean sweep. Only one 0/3 (R4 — a short-priced favourite that flopped, market's miss as much as the model's).

### Operational learnings

- **7am racecard cron failed silently on a meeting day** — biggest reliability gap. Plan: automated Wednesday-evening pull on the Mac (tries every Wed, no-ops if no card → catches special meetings) + 11pm reconcile. See [[web/dynamic-pull-plan]].
- Re-pulling R9's odds refreshed all races to final and shifted R3's #3 pick (FORERUNNER → SAME TO YOU); net precision unchanged. Marginal picks move with closing odds.

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
