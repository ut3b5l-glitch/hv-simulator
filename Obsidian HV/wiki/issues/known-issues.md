# Known Issues

Tracked bugs, inactive features, data gaps, and todos. Mark resolved issues with `~~strikethrough~~` and a date.

---

## Automation (Sha Tin weekend pipeline)

### ~~zsh word-split silently no-ops every cron run~~ — RESOLVED 2026-06-07

`hv_auto.sh` is `#!/bin/zsh` and looped `for V in $VENUES` with default `VENUES="HV ST"`. zsh does **not** word-split unquoted parameters, so it ran one iteration with `V="HV ST"`, which `wednesday_agent.py`/`results_agent.py` reject (`invalid choice: 'HV ST'`). The crash was caught and **logged as the benign `no meeting — no-op`**. Result: all 6 weekend-cron fires on 2026-06-07 (first live ST meeting) did nothing, undetected. **Fixed** → both loops now use `for V in ${=VENUES}` (`${=…}` forces splitting).

> **Latent risk — silent-failure masking:** the no-op branch swallows *any* agent failure (timeout, parse error, crash) as "no meeting." A real meeting-day failure looks identical to a no-meeting day in the log. **Todo:** distinguish a clean no-result from an agent error (check exit code / parse a sentinel) before logging no-op, and/or send an ntfy alert on non-zero agent exit.

### ~~`results_agent` off-by-one drops the last race~~ — RESOLVED 2026-06-07

`MAX_RACES = 11` with `for race_no in range(1, MAX_RACES)` only probed R1–**R10**. Harmless for HV (8–9 race cards) but **silently dropped R11 of every Sha Tin card** (ST runs up to 11). Surfaced on 2026-06-07 when reconcile reported 10/11 even after all dividends were posted. **Fixed** → `range(1, MAX_RACES + 1)`.

### Weekend reconcile slots too early — OPEN

`crontab` weekend reconcile fires at **18:00 / 18:30**, but a Sunday Sha Tin card isn't fully settled until ~21:00+. On 2026-06-07 the automated reconcile would have captured only the early races; the full 11 needed manual re-runs at 21:3x. **Todo:** add a later weekend reconcile slot (~20:30 and ~21:00) to [[operations]] crontab.

### ~~Reconcile runs before the last race posts → card truncated~~ — RESOLVED 2026-06-25 {#reconcile-before-last-race-posts}

HKJC posts results/dividends progressively, race by race, and the last race of a HV card frequently had not posted when the **23:00** reconcile fired. This truncated three full-card meetings in a row (**2026-06-10, 2026-06-13, 2026-06-24**): the probe hit the first not-yet-posted race, `break`'d, and silently dropped it plus everything after — until a manual `results_agent.py --venue HV --date <date>` re-run backfilled them. (Each missing race was a normal full-field race with a complete dividend pool — purely a timing gap, **not** a stewards' incident or reduced field.) On 06-24, R9 DEFINITIVE posted between the 23:00 and 23:30 fires; the 23:30 cron happened to catch it (`agent.log` 23:30 run fetched R1–R9), but only by luck of timing — had it posted after 23:30 it would still have been dropped.

**Fixed — two coupled changes:**
1. **Probe no longer breaks on the first gap** (`results_agent.py` main loop). It now reads the true card size from `predictions_<date>.json` (`max(race_number)`, capped at `MAX_RACES`), probes `R1..card_size`, and **skips** a not-yet-posted / unparseable race (appending it to a `missing` list) instead of stopping. A late R9 can no longer hide a postable R10/R11. Re-runs stay idempotent — DB writes are UPDATEs and settlement is guarded on `result IS NULL` — so each reconcile run backfills the gaps without double-counting, and prints a `⚠ N of M race(s) not yet posted` notice with the exact backfill command.
2. **Later reconcile slot added.** A third HV fire at **00:15 Thu HKT** (`15 0 * * 4`) was added to the live crontab and the [[operations]] doc as a safety net for a final race that posts after 23:30, mirroring the weekend ST block's multiple fires.

**Verified** against 2026-06-24: a `--dry-run` now reads `card_size=9` and captures the full R1–R9 card (incl. R9 DEFINITIVE) in one pass; an offline test forcing a mid-card gap (R8 missing) confirmed the probe continues to R9 and reports R8 for backfill rather than truncating.

### Asleep cron host silently drops whole meetings — OPEN {#asleep-host-missed-meetings}

**Status:** Open — **confirmed instance: 2026-06-21 Sha Tin (11 races) never captured**

The automation runs from `crontab` on a **personal Mac**. macOS cron does not fire while the machine is asleep and does not catch up missed jobs on wake, so any meeting on a day the laptop happens to sleep is **never pulled or reconciled** — and because the no-op branch logs a sleeping host identically to a genuine dark day (see the silent-failure-masking note above), the miss is invisible until someone compares against the HKJC fixture list weeks later.

**Confirmed 2026-06-21 (Sun, Sha Tin twilight, 11 races, R1 won by №5 RAPID PHANTOM):** `agent.log` has **zero lines** for 2026-06-21 (vs full firing on the 2026-06-17 Wednesday), so neither the weekend pull nor the reconcile ran. Discovered 2026-06-25 while explaining the Jun 13 → Jun 24 gap in the consumer app.

**Not recoverable as a live record.** HKJC's racecard endpoint is **pre-race only** — once a meeting runs it serves results, not the card — so `wednesday_agent.py --date 2026-06-21 --venue ST` now returns "no races found," and `regen_predictions.py` skips it ("no races in DB"). The only retrospective source is the results pages, whose odds are **closing** odds; scoring from those would reintroduce [[#closing-odds-contamination]]. So Jun 21 stays an honest gap: omitted from the apps rather than backfilled with hindsight picks.

**Todos:**
1. **Daily fixture-vs-data audit.** A lightweight cron (e.g. 09:00 daily) that diffs the HKJC season fixture list against captured `predictions_*/results_*` files and **alerts** (ntfy) on any past fixture with no local data — so an asleep-day miss surfaces the next morning, inside the still-pullable racecard window.
2. **Move the cron to an always-on host** (small VPS / always-awake mini), or use a wake-scheduler (`pmset repeat wake`) on race days, so the capture window is never missed.
3. Until then, **manually verify coverage against the fixture list** after any stretch where the machine may have slept on a Wed/Sat/Sun.

---

## Critical

### jf × tf Multiplicative Leverage {#jf-tf-leverage}

> **RESOLVED (Phase 5, 2026-05-30)** — the [[model/market-blend]] conditional
> logit fits jockey+trainer jointly with the de-vigged market probability. The
> trainer coefficient shrinks to ~0 (collinear with jockey & market) and the
> market log-prob (coef ~1.0) dominates, so the overconfident jf x tf products
> are gone. The inert `hf` is confirmed (logit weight 0.000). Detail below is
> retained for history.

> **Related ceiling:** do NOT chase 60% top-3 precision — the oracle bound on
> HV's ~11.5-horse fields is ~52% even with perfect probabilities. Edge beyond
> the market needs richer features (sectionals, ratings), not harder ranking.


**Status:** Open — highest priority fix  
**Impact:** Causes severe overconfidence in top jockey/trainer combinations. jf×tf products up to 7.6× found on May 13.

Top jockeys ride for top trainers — the factors are correlated in practice but the model treats them as fully independent. This produces near-certain show probabilities (96%+) for hot combinations that are epistemically unjustified.

**May 13 example:** VIGOR EYE (R7) had 59.8% model win probability → finished P12.

**Side effect:** Horse factor (`hf`) is effectively 1.00 for all runners — jf×tf does all differentiation and swamps the horse's actual trip history.

**Recommended fixes (must walk-forward test each independently):**

| Fix | Approach | Priority |
|---|---|---|
| Cap JT product | `min(jf * tf, JT_CAP)` where `JT_CAP ≈ 3.0–4.0` | 1 |
| Geometric mean | `sqrt(jf * tf)` instead of `jf * tf` | 2 |
| Raise floor | jockey/trainer floor from 0.20 → 0.40 | 3 |
| Raise TRAILING_MIN | 10 → 20 rides (reduce noise in thin windows) | 4 |
| Bayesian shrinkage | Shrink trailing factors toward career baseline | 5 |

---

## Active Infrastructure Issues

### racing.hkjc.com Playwright blocked

**Status:** Open (workaround in place)  
`wednesday_agent.py` auto-falls back to bet.hkjc.com GraphQL. No action needed unless the fallback also breaks.

### hkjc_odds.py: WebSocket odds not parsing

**Status:** Open (workaround in place)  
WS handler is wired and bytes-as-frame bug is fixed, but WS frames are not yielding parseable odds. DOM scraper is reliable for now. If HKJC restructures the odds page, investigate WS format.

### hkjc_odds.py: Silent extraction failure risk

**Status:** Open  
If HKJC changes the DOM table layout, `tokens[-2]` will extract wrong values silently (cloth numbers instead of odds). Mitigation: run `--dry-run` before writing to DB and check values visually.

---

## Data Integrity

### Closing-odds contamination in re-scored predictions files {#closing-odds-contamination}

**Status:** Mitigated 2026-06-19 (root cause open)

Three raw `predictions_*.json` files were overwritten *after* their meetings by a re-score against **closing odds**, replacing the contemporaneous live picks with hindsight-inflated, favourite-aligned ones:

| Meeting | Overwritten | Live (wiki) | App was showing | #1 = market fav |
|---|---|---|---|---|
| 2026-05-13 | 2026-05-30 (batch regen) | 51.9% (14/27) | 59.3% (16/27) | 9/9 |
| 2026-05-27 | 2026-05-30 (batch regen) | 22.2% (6/27) | 40.7% (11/27) | 8/9 |
| 2026-06-07 | 2026-06-07 22:07 (bug-recovery) | 36.4% (12/33) | 45.5% (15/33) | ~11/11 |

Because `export_data.py` reads `top3` straight from the predictions file (no DB re-score), the inflated numbers propagated to both the PWA and the Zokki consumer app. Most blatant: 06-07 R11's #1 became CHILL EASY — the actual winner, bet down to 2.9 — vs the live pick FIT FOR BEAUTY (a complete miss). The signature is **#1 pick == market favourite in nearly every race** plus a file mtime later than the meeting.

**Mitigation:** raw sources are immutable, so the fix is a `PICK_CORRECTIONS` overlay in `export_data.py` that re-ranks these three meetings to the contemporaneous live picks (from [[performance/live-meetings]]) at export time. Runner identity / odds / factors / actual finish are preserved; only the model-output column (win/place/show %) is reassigned in descending order to keep podiums and probability bars coherent. The honest consumer headline is now **44.3%** (77/174) over 6 live meetings, with same-sample baselines (favourite 63.8%, random 25.3%).

**Caveats / open follow-ups:**
- 05-13 and 05-27 ran the **old factor model** (pre-blend); their live numbers reflect a model since replaced — a true historical track record, not the current engine.
- Reconstructed win% for the three meetings are approximate (live pre-race odds were lost). Pre-race odds were never archived → a clean blend re-score is not currently possible.
- **Root cause still open:** whatever regenerated these files (`regen_predictions.py` and/or the 22:07 bug-recovery path) used current/closing odds with no guard against overwriting a settled meeting. Add a guard so a meeting that already has results is never re-scored against post-race odds, and/or snapshot the pre-race predictions immutably at lock time.

## Data Gaps

### Race 587 (Apr 29 R1): no Phase B data

**Status:** Open  
This race was imported before Phase B was built. `official_rating`, `days_since_last_run`, `last_6_runs` are all NULL. Fix: re-run `phase6_importer.py` on the Apr 29 HTML file.

### Apr 22 races: going = '' instead of NULL

**Status:** Open (cosmetic)  
Some Apr 22 entries have empty string `going` instead of NULL. No model impact — the going factor is inactive. Fix if/when going factor is reactivated.

### final_sectional_400m mostly empty

**Status:** Deferred  
This column exists but is largely unpopulated. Could be a useful late-race pace signal in future. Deferred until data accumulates.

---

## Inactive Features

### Going Factor (Phase 4C)

**Status:** Built, deactivated  
Infrastructure exists (`_going_factor()`, all callers wired). Walk-forward showed regression — only 37 SOFT races, ~0.3 per horse. Re-enable after 2+ full HV seasons. See [[model/factors/going]].

### WebSocket odds interception

**Status:** Wired, not functional  
`_on_websocket` handler in `hkjc_odds.py` is ready but WS frames aren't parsing. DOM fallback is the active path.

---

## Phase 4E Todos

1. Monte Carlo convergence check: `python3 race_simulator.py --mc` on 2–3 recent races
2. Confirm dashboard "Factor breakdown" expander shows `Class F` and `Wt Chg F` correctly, no stale `Going F` column
3. Update `walkforward_test.py` header (still reads `"model_core Phase A"` and old factor list)

---

## No-Action Notes

- **No class/wcf factors for horses with no prior HV run** — `cf = wcf = 1.00` neutral. Low priority; affects only true debutants.
- **horse_form table unused** — detailed all-venue form history exists but is not wired into the model. Future candidate for cross-venue form signal.
- **Phase 5 (ML)** — do not start before November 2026. Needs ~26 live meetings of Phase B data.

## Related Pages

[[overview]] · [[model/factors/jockey-trainer]] · [[data/api]] · [[data/database]]
