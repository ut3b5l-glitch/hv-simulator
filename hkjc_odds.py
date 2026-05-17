#!/usr/bin/env python3
"""
hkjc_odds.py — Fetch live WIN odds from HKJC via browser-based interception.

Launches headless Chromium, navigates to the HKJC WIN/PLACE odds page, and
intercepts the GraphQL responses the page triggers internally (bypassing the
IP whitelist that blocks direct GraphQL calls). Extracts WIN tote odds for
every runner in every race and writes them to race_entries.public_odds.
Regenerates the predictions JSON so value bets reflect live market prices.

Designed to run ~30 min before first race (e.g. 6:30pm HKT on Wednesdays).

Usage:
  python3 hkjc_odds.py                       # today's date, HV
  python3 hkjc_odds.py --date 2026-05-07
  python3 hkjc_odds.py --dry-run             # print odds, no DB writes
"""

import argparse
import json
import sqlite3
import sys
from datetime import date
from itertools import groupby
from pathlib import Path

DB_PATH = Path(__file__).parent / "happy_valley.db"
VENUE   = "HV"

# HKJC betting odds page — only accessible during live betting sessions.
# Requires HK-accessible IP; returns 404 for historical or off-session dates.
# URL pattern: /en/racing/wp/{YYYY-MM-DD}/{venue}/{race_no}
ODDS_PAGE_URL = "https://bet.hkjc.com/en/racing/wp/{date}/{venue}/{race_no}"


# ─────────────────────────────────────────────────────────────────────────────
# GraphQL response parser
# ─────────────────────────────────────────────────────────────────────────────

def _parse_graphql_response(body: dict) -> dict:
    """
    GraphQL format (racing.hkjc.com legacy):
      data.raceMeetings[].races[].runners[].name_en + winOdds
    """
    result = {}
    data = body.get("data") or {}
    for meeting in (data.get("raceMeetings") or []):
        for race in (meeting.get("races") or []):
            try:
                race_no = int(race["no"])
            except (KeyError, TypeError, ValueError):
                continue
            for runner in (race.get("runners") or []):
                name = (runner.get("name_en") or "").upper().strip()
                raw  = runner.get("winOdds")
                if name and raw is not None:
                    try:
                        result[(race_no, name)] = float(raw)
                    except (ValueError, TypeError):
                        pass
    return result


def _parse_api_response(body) -> dict:
    """
    REST / alternate GraphQL formats bet.hkjc.com may return.
    Tries several common shapes; returns empty dict if none match.
    """
    result = {}

    def _try_races(races_list):
        for race in races_list or []:
            if not isinstance(race, dict):
                continue
            try:
                race_no = int(
                    race.get("no") or race.get("raceNo") or
                    race.get("race_no") or race.get("raceNumber") or 0
                )
            except (TypeError, ValueError):
                continue
            runners = (
                race.get("runners") or race.get("horses") or
                race.get("entries") or []
            )
            for r in runners:
                if not isinstance(r, dict):
                    continue
                name = (
                    r.get("name_en") or r.get("horseName") or
                    r.get("name") or r.get("horse_name") or ""
                ).upper().strip()
                raw = (
                    r.get("winOdds") or r.get("win_odds") or
                    r.get("odds") or r.get("winOdd") or
                    r.get("currentOdds")
                )
                if name and raw is not None:
                    try:
                        result[(race_no, name)] = float(raw)
                    except (ValueError, TypeError):
                        pass

    if isinstance(body, list):
        _try_races(body)
        return result

    if not isinstance(body, dict):
        return result

    # Unwrap common envelope shapes
    for key in ("races", "raceList", "race_list", "data"):
        val = body.get(key)
        if isinstance(val, list):
            _try_races(val)
        elif isinstance(val, dict):
            result.update(_parse_api_response(val))

    # Also try the top-level body as a races list fallback
    if not result:
        _try_races(body.get("races") or [])

    return result


# ─────────────────────────────────────────────────────────────────────────────
# DOM fallback — extract rendered odds table from the live page
# ─────────────────────────────────────────────────────────────────────────────

def _scrape_odds_from_dom(page, race_date: str, venue: str = "HV") -> dict:
    """
    Read the rendered WIN/PLACE odds table directly from the DOM.
    Navigates R1..R9 and extracts (race_no, horse_name) → win_odds
    by looking for rows that contain a horse name and a decimal odds value.
    """
    import sqlite3 as _sq

    # Load all runner names for today from DB so we can match them in the DOM
    known_names: set = set()
    try:
        conn = _sq.connect(DB_PATH)
        rows = conn.execute("""
            SELECT UPPER(h.horse_name)
              FROM race_entries re
              JOIN races r  ON re.race_id  = r.race_id
              JOIN horses h ON re.horse_id = h.horse_id
             WHERE r.race_date=? AND r.venue=?
        """, (race_date, venue)).fetchall()
        known_names = {r[0] for r in rows}
        conn.close()
    except Exception:
        pass

    result: dict = {}

    for race_no in range(1, 10):
        url = ODDS_PAGE_URL.format(date=race_date, venue=venue, race_no=race_no)
        try:
            page.goto(url, wait_until="networkidle", timeout=20_000)
            page.wait_for_timeout(2_000)
        except Exception:
            break

        try:
            # Extract all leaf text nodes grouped by their nearest table-row ancestor
            rows_text = page.evaluate("""
                () => {
                    const rows = [];
                    const candidates = document.querySelectorAll(
                        'tr, [class*="row"], [class*="runner"], [class*="horse"]'
                    );
                    candidates.forEach(el => {
                        const texts = [];
                        el.querySelectorAll('*').forEach(child => {
                            if (child.children.length === 0) {
                                const t = (child.innerText || child.textContent || '').trim();
                                if (t) texts.push(t);
                            }
                        });
                        if (texts.length > 1) rows.push(texts);
                    });
                    return rows;
                }
            """)
        except Exception:
            continue

        for tokens in (rows_text or []):
            # Find a known horse name among tokens
            name_match = next(
                (t.upper() for t in tokens if t.upper() in known_names), None
            )
            if not name_match:
                continue
            # Row structure: [cloth, name, draw, wt, jockey, trainer, WIN_ODDS, place_odds]
            # Win odds is always the second-to-last token. Fall back to last if needed.
            for t in reversed(tokens[-3:-1] if len(tokens) >= 4 else tokens):
                try:
                    val = float(t)
                    if 1.0 <= val <= 999.0:
                        result[(race_no, name_match)] = val
                        break
                except ValueError:
                    pass

        if result:
            # Check if we have entries for this race_no; if yes, move to next
            race_count = len({k[0] for k in result})
            if race_count >= race_no:
                continue  # got this race, keep going
        else:
            break  # nothing on first race, give up

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Browser fetch
# ─────────────────────────────────────────────────────────────────────────────

def fetch_win_odds(
    race_date: str,
    venue: str = "HV",
    timeout_s: int = 30,
    debug: bool = False,
) -> dict:
    """
    Navigate to bet.hkjc.com WIN/PLACE odds pages in headless Chromium,
    intercept every JSON API response the page fires, and return the union
    of all extracted odds.

    race_date : "YYYY-MM-DD"
    venue     : "HV" or "ST"
    debug     : write captured WS frames + HTTP bodies to odds_debug_{date}.json
    Returns   : {(race_no: int, horse_name_upper: str): float}
    """
    import json as _json

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run:  pip3 install playwright && playwright install chromium")
        return {}

    captured_odds: dict = {}
    debug_log: list = []

    def _try_parse(body):
        for parser in (_parse_graphql_response, _parse_api_response):
            odds = parser(body)
            if odds:
                captured_odds.update(odds)

    def _on_response(response):
        if response.status != 200 or "hkjc.com" not in response.url:
            return
        try:
            body = response.json()
        except Exception:
            return
        if debug:
            debug_log.append({"type": "http", "url": response.url, "body": body})
        _try_parse(body)

    def _on_websocket(ws):
        def _on_frame(frame):
            try:
                # Playwright passes frame data as bytes directly in newer versions;
                # older versions wrapped it in an object with a .payload attribute.
                payload = frame if isinstance(frame, bytes) else getattr(frame, "payload", None)
                if not payload:
                    return
                if isinstance(payload, bytes):
                    payload = payload.decode("utf-8", errors="ignore")
                body = _json.loads(payload)
            except Exception:
                return
            if debug:
                debug_log.append({"type": "ws", "url": ws.url, "body": body})
            _try_parse(body)
        ws.on("framereceived", _on_frame)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        )
        page = context.new_page()
        page.on("response",   _on_response)
        page.on("websocket",  _on_websocket)

        url = ODDS_PAGE_URL.format(date=race_date, venue=venue, race_no=1)
        try:
            # Use "load" — networkidle never fires on a live betting page
            # due to continuous WebSocket + polling activity.
            page.goto(url, wait_until="load", timeout=timeout_s * 1000)
        except Exception as e:
            print(f"  [odds] Page load warning: {e}")

        # Wait for initial GraphQL responses and first WebSocket odds push
        print("  Waiting for live odds push …")
        page.wait_for_timeout(8_000)

        # DOM fallback — extract rendered odds directly from the page
        if not captured_odds:
            print("  WebSocket yielded nothing — trying DOM extraction …")
            captured_odds = _scrape_odds_from_dom(page, race_date, venue)

        if debug and debug_log:
            debug_path = DB_PATH.parent / f"odds_debug_{race_date}.json"
            with open(debug_path, "w") as f:
                _json.dump(debug_log, f, indent=2, default=str)
            print(f"  [debug] {len(debug_log)} message(s) written → {debug_path.name}")

        browser.close()

    return captured_odds


# ─────────────────────────────────────────────────────────────────────────────
# DB write
# ─────────────────────────────────────────────────────────────────────────────

def apply_odds_to_db(conn, race_date: str, odds: dict, venue: str = "HV") -> int:
    """
    Update race_entries.public_odds for the given meeting date.
    Matches by (race_number, UPPER(horse_name)).
    Returns count of rows updated.
    """
    if not odds:
        return 0

    c = conn.cursor()
    updated = 0

    for (race_no, horse_name), odd_val in odds.items():
        rows = c.execute("""
            SELECT re.entry_id, h.horse_name
              FROM race_entries re
              JOIN races  r ON re.race_id  = r.race_id
              JOIN horses h ON re.horse_id = h.horse_id
             WHERE r.race_date=? AND r.race_number=? AND r.venue=?
        """, (race_date, race_no, venue)).fetchall()

        for entry_id, db_name in rows:
            if db_name.upper() == horse_name:
                c.execute(
                    "UPDATE race_entries SET public_odds=? WHERE entry_id=?",
                    (odd_val, entry_id),
                )
                updated += 1

    conn.commit()
    return updated


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fetch live HKJC WIN odds and update DB + predictions JSON."
    )
    parser.add_argument("--date",    default=date.today().isoformat(),
                        help="Meeting date YYYY-MM-DD (default: today)")
    parser.add_argument("--venue",   default="HV",
                        help="Racecourse code (default: HV)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print fetched odds only; do not write to DB")
    parser.add_argument("--debug", action="store_true",
                        help="Dump all captured API responses to odds_debug_DATE.json")
    args = parser.parse_args()

    print(f"\n{'='*62}")
    print(f"  HKJC Odds Fetch  →  {args.venue}  {args.date}")
    print(f"{'='*62}")
    print(f"\n  Opening browser and navigating to odds page …")

    odds = fetch_win_odds(args.date, args.venue, debug=args.debug)

    if not odds:
        print("  No odds captured.")
        print("  Possible reasons: meeting not today, odds not yet open, or page layout changed.")
        sys.exit(0)

    # ── Print odds grouped by race ────────────────────────────────────────────
    keys_sorted = sorted(odds.keys())
    for race_no, grp in groupby(keys_sorted, key=lambda x: x[0]):
        entries = sorted(grp, key=lambda k: odds[k])
        print(f"\n  Race {race_no}:")
        for k in entries:
            print(f"    {k[1]:<30}  {odds[k]:>6.1f}")

    print(f"\n  {len(odds)} odds entries fetched across "
          f"{len(set(k[0] for k in odds))} race(s).")

    if args.dry_run:
        print("  [dry-run] DB write skipped.")
        sys.exit(0)

    # ── Apply to DB ───────────────────────────────────────────────────────────
    conn = sqlite3.connect(DB_PATH)
    n = apply_odds_to_db(conn, args.date, odds, args.venue)
    print(f"\n  Updated {n} race_entries row(s) in DB.")

    if n == 0:
        conn.close()
        print("  No entries matched — ensure the racecard was imported first.")
        print(f"  Run:  python3 wednesday_agent.py --date {args.date}")
        sys.exit(1)

    # ── Re-run model → update predictions JSON ────────────────────────────────
    print(f"  Re-running model …")

    import model_core as mc
    import wednesday_agent as wa

    races = conn.execute("""
        SELECT race_id, race_number, distance_m, course_config, race_class, going, track_surface
          FROM races
         WHERE race_date=? AND venue=?
         ORDER BY race_number
    """, (args.date, args.venue)).fetchall()

    inserted = [
        (r[0], {
            "race_number":   r[1],
            "distance_m":    r[2],
            "course_config": r[3],
            "race_class":    r[4],
            "going":         r[5],
            "track_surface": r[6],
        })
        for r in races
    ]

    predictions = wa.build_predictions(conn, args.date, inserted)
    conn.close()

    out_path = Path(__file__).parent / f"predictions_{args.date}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(predictions, f, indent=2, ensure_ascii=False)
    print(f"  Predictions saved → {out_path.name}")

    wa.print_summary(predictions)

    # ── Value bet summary ─────────────────────────────────────────────────────
    value_bets = []
    for race in predictions["races"]:
        for r in race["runners"]:
            if r["is_value"]:
                value_bets.append({**r, "race_number": race["race_number"]})

    if value_bets:
        print(f"\n  ★  VALUE BETS  (edge >{mc.EDGE_THRESHOLD}%, model win >{mc.MIN_MODEL_PCT}%)")
        print(f"  {'Race':<5} {'Horse':<24} {'Model%':>7} {'Mkt%':>6} {'Edge':>7} {'Odds':>6}")
        print(f"  {'─'*60}")
        for vb in sorted(value_bets, key=lambda x: x["edge"], reverse=True):
            print(
                f"  R{vb['race_number']:<4} {vb['horse_name']:<24} "
                f"{vb['win_pct']:>6.1f}% {vb.get('market_pct', 0):>5.1f}%  "
                f"{vb['edge']:>+6.1f}%  {vb.get('public_odds', 0):>5.1f}"
            )
    else:
        print(f"\n  No value bets found (edge >{mc.EDGE_THRESHOLD}%, model win >{mc.MIN_MODEL_PCT}%).")

    print()


if __name__ == "__main__":
    main()
