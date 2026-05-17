# HKJC API & Scraper Notes

Confirmed endpoints and scraper behaviour as of May 13, 2026.

---

## Racecard Data

**Primary (broken):** `racing.hkjc.com` — times out for Playwright headless Chromium as of May 2026. `wednesday_agent.py` auto-falls back.

**Fallback (active):** `bet.hkjc.com` GraphQL interception

```
Endpoint: info.cld.hkjc.com/graphql/base/
Response path: data.raceMeetings[].races[].runners[]
```

`wednesday_agent.py` navigates to `bet.hkjc.com`, intercepts HTTP responses matching the GraphQL base endpoint, and parses `runners[]` directly. This yielded all 9 races on May 13.

**Key field note:** `winOdds` is always `''` on the initial HTTP load — it's populated later via WebSocket push or rendered DOM. Do not rely on it from the GraphQL response.

---

## Live Odds

**Script:** `hkjc_odds.py`  
**URL pattern:** `https://bet.hkjc.com/en/racing/wp/YYYY-MM-DD/HV/{race_no}`  
**Method:** DOM scraper (primary path)

### Confirmed Row Structure

```
[cloth_no, horse_name, draw, weight, jockey, trainer, WIN_ODDS, place_odds]
```

Win odds = `tokens[-2]` (second-to-last token in the row).

**Previous bug:** scraper was taking `tokens[0]` (cloth number = integer 1,2,3…) as odds. Fixed by anchoring to `tokens[-2]`.

### Page Load

`wait_until="load"` required (not `"networkidle"` — the betting page constantly polls, so networkidle never fires).

### WebSocket (not yet working)

`_on_websocket` handler is wired and the bytes-as-frame bug is fixed, but WS frames are not yielding parseable odds yet. DOM scraper is the reliable path for now.

### WS Frame Bug (fixed May 13)

Playwright passes WebSocket frame data as `bytes` directly in newer versions, not as an object with `.payload`. Fix:
```python
def _on_frame(frame):
    if isinstance(frame, bytes):
        data = frame
    else:
        data = frame.payload
```

---

## Results Data

`results_agent.py` fetches HKJC results post-race, updates `finish_position` in `race_entries`, and settles paper trades.

---

## Robustness Notes

- If `bet.hkjc.com` GraphQL also breaks in future, check `fetch_racecard_graphql()` in `wednesday_agent.py` for the full interception logic.
- If HKJC changes the odds table layout, `hkjc_odds.py` will extract wrong values silently. Run with `--dry-run` first to sanity-check (non-sequential values with decimals = real odds; sequential integers 1,2,3 = cloth numbers).

## Related Pages

[[data/database]] · [[workflow/operations]] · [[issues/known-issues]]
