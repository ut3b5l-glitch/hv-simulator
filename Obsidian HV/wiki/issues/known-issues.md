# Known Issues

Tracked bugs, inactive features, data gaps, and todos. Mark resolved issues with `~~strikethrough~~` and a date.

---

## Critical

### jf × tf Multiplicative Leverage {#jf-tf-leverage}

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
