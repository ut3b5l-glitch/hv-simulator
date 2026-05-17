#!/usr/bin/env python3
"""
wednesday_agent.py — Automated Wednesday racecard fetcher for Happy Valley.

Fetches the HKJC racecard for the next HV meeting via headless Chromium,
inserts all races into the DB, runs the model, and writes a predictions JSON.

Usage:
  python3 wednesday_agent.py                    # auto-detect next Wednesday
  python3 wednesday_agent.py --date 2026-05-06  # explicit date
  python3 wednesday_agent.py --dry-run          # fetch + parse, no DB writes
"""

import argparse
import json
import sqlite3
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import model_core as mc
from phase6_importer import (
    parse_racecard_html,
    insert_race_day,
    load_entries_for_race,
)

DB_PATH   = Path(__file__).parent / "happy_valley.db"
VENUE     = "HV"
MAX_RACES = 11   # probe R1..R10, stop when a race 404s or has no card

RACECARD_URL = (
    "https://racing.hkjc.com/racing/information/English/Racing/RaceCard.aspx"
    "?RaceDate={date}&Racecourse=HV&RaceNo={race_no}"
)


# ─────────────────────────────────────────────────────────────────────────────
# Date helpers
# ─────────────────────────────────────────────────────────────────────────────

def next_wednesday(from_date: date) -> date:
    """Return the nearest upcoming Wednesday (today if today is Wednesday)."""
    days_ahead = (2 - from_date.weekday()) % 7   # 0 if today is Wed, 1 if Thu, etc.
    return from_date + timedelta(days=days_ahead)


# ─────────────────────────────────────────────────────────────────────────────
# Playwright fetch
# ─────────────────────────────────────────────────────────────────────────────

def fetch_racecard_html(page, race_date_str: str, race_no: int) -> str | None:
    """
    Fetch a single HKJC racecard page using an already-open Playwright page.
    race_date_str: 'YYYY/MM/DD'
    Returns HTML string, or None if no racecard was found.
    """
    url = RACECARD_URL.format(date=race_date_str, race_no=race_no)
    try:
        page.goto(url, wait_until="networkidle", timeout=30_000)
    except Exception as e:
        print(f"  [R{race_no}] Timeout/error navigating: {e}")
        return None

    # Wait up to 10s for the racecard table to appear
    try:
        page.wait_for_selector("#racecardlist", timeout=10_000)
    except Exception:
        return None   # no racecard table → race doesn't exist or not yet posted

    html = page.content()
    # Confirm table is actually populated
    if "racecardlist" not in html:
        return None
    return html


# ─────────────────────────────────────────────────────────────────────────────
# Predictions JSON
# ─────────────────────────────────────────────────────────────────────────────

def build_predictions(conn, meeting_date: str, inserted_races) -> dict:
    stats = mc.build_stats(conn)   # no cutoff → full history (live mode)

    races_out = []
    for race_id, pr in inserted_races:
        entries = load_entries_for_race(conn, race_id)
        runners = mc.score_race(
            entries, stats,
            pr["distance_m"], pr["course_config"],
            race_class=pr.get("race_class"), going=pr.get("going"),
        )
        if not runners:
            continue

        runner_dicts = []
        for rank, r in enumerate(runners, 1):
            runner_dicts.append({
                "rank":             rank,
                "horse_name":       r["horse_name"],
                "horse_id":         r["horse_id"],
                "horse_no":         r.get("horse_no"),
                "barrier":          r["barrier"],
                "jockey_name":      r.get("jockey_name", ""),
                "trainer_name":     r.get("trainer_name", ""),
                "official_rating":  r.get("official_rating"),
                "days_since_last_run": r.get("days_since_last_run"),
                "last_6_runs":      r.get("last_6_runs"),
                "win_pct":          round(r["win_pct"], 2),
                "place_pct":        round(r["place_pct"], 2),
                "show_pct":         round(r["show_pct"], 2),
                "is_value":         r.get("is_value", False),
                "factors": {
                    "barrier_iv": round(r["b_iv"], 3),
                    "jockey":     round(r["jf"], 3),
                    "trainer":    round(r["tf"], 3),
                    "horse":      round(r["hf"], 3),
                    "form":       round(r["ff"], 3),
                    "class_tf":   round(r.get("cf", 1.0), 3),
                    "weight_chg": round(r.get("wcf", 1.0), 3),
                    "rating":     round(r["rtf"], 3),
                    "days":       round(r["df"], 3),
                },
            })

        top3 = [r["horse_name"] for r in runner_dicts[:3]]
        races_out.append({
            "race_id":      race_id,
            "race_number":  pr["race_number"],
            "distance_m":   pr["distance_m"],
            "course_config": pr["course_config"],
            "track_surface": pr.get("track_surface", "Turf"),
            "race_class":   pr.get("race_class"),
            "going":        pr.get("going"),
            "field_size":   len(runner_dicts),
            "top3":         top3,
            "runners":      runner_dicts,
        })

    return {
        "meeting_date": meeting_date,
        "fetched_at":   __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "races":        races_out,
    }


def print_summary(predictions: dict):
    print()
    print(f"  {'─'*62}")
    print(f"  HAPPY VALLEY  {predictions['meeting_date']}  ({len(predictions['races'])} races)")
    print(f"  {'─'*62}")
    for race in predictions["races"]:
        top3_str = "  /  ".join(race["top3"])
        print(f"  R{race['race_number']:>2}  {race['distance_m']}m {race['course_config']:<2}  "
              f"{(race['race_class'] or '?'):>8}  ►  {top3_str}")
    print(f"  {'─'*62}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch HV Wednesday racecard and run model.")
    parser.add_argument("--date", help="Meeting date YYYY-MM-DD (default: next Wednesday)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and parse only — do not write to DB or predictions file")
    parser.add_argument("--retry", type=int, default=0, metavar="N",
                        help="Retry up to N times (1hr apart) if card not yet posted")
    args = parser.parse_args()

    if args.date:
        try:
            meeting = date.fromisoformat(args.date)
        except ValueError:
            print(f"ERROR: invalid date '{args.date}', expected YYYY-MM-DD")
            sys.exit(1)
    else:
        meeting = next_wednesday(date.today())

    meeting_str     = meeting.isoformat()          # 'YYYY-MM-DD'
    meeting_hkjc    = meeting.strftime("%Y/%m/%d") # 'YYYY/MM/DD'
    predictions_out = Path(__file__).parent / f"predictions_{meeting_str}.json"

    print(f"\n{'='*64}")
    print(f"  HV Racecard Agent  →  {meeting_str}")
    print(f"{'='*64}")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run:  pip3 install playwright && playwright install chromium")
        sys.exit(1)

    parsed_all = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
        page = context.new_page()

        for race_no in range(1, MAX_RACES):
            print(f"  Fetching Race {race_no} …", end=" ", flush=True)
            html = fetch_racecard_html(page, meeting_hkjc, race_no)

            if html is None:
                print("not found — stopping.")
                break

            races = parse_racecard_html(html)
            if not races:
                print("parse failed — skipping.")
                continue

            r = races[0]
            print(f"✓  {r['distance_m']}m {r['course_config']}  {r.get('race_class') or '?'}  "
                  f"{len(r['entries'])} runners  going={r.get('going') or '?'}")
            parsed_all.append(r)
            time.sleep(1.5)   # polite delay between pages

        browser.close()

    if not parsed_all:
        if args.retry > 0:
            print(f"\nCard not posted yet — retrying in 60 min ({args.retry} attempt(s) left).")
            time.sleep(3600)
            sys.argv = [a for a in sys.argv if not a.startswith("--retry")]
            sys.argv += [f"--retry={args.retry - 1}"]
            main()
            return
        print("\nNo races found. The card may not be posted yet.")
        sys.exit(0)

    print(f"\n  Parsed {len(parsed_all)} race(s).")

    if args.dry_run:
        print("  [dry-run] Skipping DB write and predictions file.")
        for r in parsed_all:
            print(f"    R{r['race_number']:>2}  {len(r['entries'])} runners")
        sys.exit(0)

    # ── Insert into DB ────────────────────────────────────────────────────────
    print(f"\n  Writing to DB …")
    conn = sqlite3.connect(DB_PATH)
    inserted = insert_race_day(conn, meeting_str, parsed_all)

    # ── Run model and build predictions ──────────────────────────────────────
    print(f"\n  Running model …")
    predictions = build_predictions(conn, meeting_str, inserted)
    conn.close()

    # ── Write predictions JSON ────────────────────────────────────────────────
    with open(predictions_out, "w", encoding="utf-8") as f:
        json.dump(predictions, f, indent=2, ensure_ascii=False)
    print(f"  Predictions saved → {predictions_out.name}")

    print_summary(predictions)


if __name__ == "__main__":
    main()
