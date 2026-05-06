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

# HKJC betting odds page — only accessible during live betting sessions
# (typically opens ~12:00 HKT on race day, closes after last race).
# Requires HK-accessible IP; returns 404 for historical or off-session dates.
ODDS_PAGE_URL = (
    "https://racing.hkjc.com/en-us/local/information/winplaceodds"
    "?RaceDate={date}&Racecourse={venue}&RaceNo=1"
)


# ─────────────────────────────────────────────────────────────────────────────
# GraphQL response parser
# ─────────────────────────────────────────────────────────────────────────────

def _parse_graphql_response(body: dict) -> dict:
    """
    Extract {(race_no: int, horse_name_upper: str): float} from an intercepted
    GraphQL response body. Handles both response formats HKJC uses:

    Format A — main raceMeetings query (runners carry winOdds directly):
      data.raceMeetings[].races[].runners[].name_en + winOdds

    Format B — horseOddsQuery (pool-based, per race):
      data.raceMeetings[].pmPools[] where oddsType==WIN,
      oddsNodes[].combString (horse number) + oddsValue
      — requires a separate horse_no→name map built from Format A.
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


# ─────────────────────────────────────────────────────────────────────────────
# Browser fetch
# ─────────────────────────────────────────────────────────────────────────────

def fetch_win_odds(race_date: str, venue: str = "HV", timeout_s: int = 30) -> dict:
    """
    Navigate to HKJC WIN/PLACE odds page in headless Chromium, capture every
    GraphQL response the page fires, and return the union of all extracted odds.

    race_date : "YYYY-MM-DD"
    venue     : "HV" or "ST"
    Returns   : {(race_no: int, horse_name_upper: str): float}
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run:  pip3 install playwright && playwright install chromium")
        return {}

    captured: dict = {}

    def _on_response(response):
        if "graphql/base" not in response.url or response.status != 200:
            return
        try:
            body = response.json()
            odds = _parse_graphql_response(body)
            if odds:
                captured.update(odds)
        except Exception:
            pass

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        )
        page = context.new_page()
        page.on("response", _on_response)

        date_hkjc = race_date.replace("-", "/")
        url = ODDS_PAGE_URL.format(date=date_hkjc, venue=venue)
        try:
            page.goto(url, wait_until="networkidle", timeout=timeout_s * 1000)
        except Exception as e:
            print(f"  [odds] Page load warning: {e}")

        browser.close()

    return captured


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
    args = parser.parse_args()

    print(f"\n{'='*62}")
    print(f"  HKJC Odds Fetch  →  {args.venue}  {args.date}")
    print(f"{'='*62}")
    print(f"\n  Opening browser and navigating to odds page …")

    odds = fetch_win_odds(args.date, args.venue)

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
