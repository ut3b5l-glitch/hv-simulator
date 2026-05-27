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
# GraphQL fallback — intercepts bet.hkjc.com internal API responses
# ─────────────────────────────────────────────────────────────────────────────

BET_HKJC_URL = "https://bet.hkjc.com/en/racing/wp/{date}/HV/1"
GRAPHQL_HOST = "info.cld.hkjc.com"


def _parse_graphql_racecard(body: dict) -> list:
    """
    Parse a GraphQL raceMeetings response into the same list-of-race-dicts
    format that parse_racecard_html() returns, so insert_race_day() can consume it.
    """
    races_out = []
    data = body.get("data") or {}
    for meeting in (data.get("raceMeetings") or []):
        for race in (meeting.get("races") or []):
            try:
                race_no = int(race["no"])
            except (KeyError, TypeError, ValueError):
                continue

            distance_m = race.get("distance") or 0
            course_cfg = (race.get("raceCourse") or {}).get("displayCode") or "C"
            track_raw  = (race.get("raceTrack") or {}).get("description_en") or "Turf"
            track_surface = "AWT" if "weather" in track_raw.lower() else "Turf"
            race_class = race.get("raceClass_en") or None
            going      = (race.get("go_en") or "").upper() or None

            entries = []
            for runner in (race.get("runners") or []):
                if (runner.get("status") or "").upper() in ("SCRATCHED", "WITHDRAWN"):
                    continue
                name = (runner.get("name_en") or "").upper().strip()
                if not name:
                    continue

                try:
                    barrier = int(runner.get("barrierDrawNumber") or 99)
                except (TypeError, ValueError):
                    barrier = 99

                try:
                    horse_no = int(runner.get("no") or 0) or None
                except (TypeError, ValueError):
                    horse_no = None

                try:
                    weight = float(runner.get("handicapWeight") or 0) or None
                    if weight and not (100 <= weight <= 140):
                        weight = None
                except (TypeError, ValueError):
                    weight = None

                try:
                    official_rating = int(runner.get("currentRating") or 0) or None
                except (TypeError, ValueError):
                    official_rating = None

                jockey_info  = runner.get("jockey") or {}
                trainer_info = runner.get("trainer") or {}

                entries.append({
                    "horse_name":          name,
                    "horse_no":            horse_no,
                    "barrier":             barrier,
                    "jockey":              jockey_info.get("name_en") or "",
                    "trainer":             trainer_info.get("name_en") or "",
                    "weight":              weight,
                    "official_rating":     official_rating,
                    "rating_change":       None,
                    "days_since_last_run": None,
                    "last_6_runs":         runner.get("last6run") or None,
                    "public_odds":         None,
                })

            if entries:
                races_out.append({
                    "race_number":   race_no,
                    "distance_m":    distance_m,
                    "course_config": course_cfg,
                    "track_surface": track_surface,
                    "race_class":    race_class,
                    "going":         going,
                    "entries":       entries,
                })

    races_out.sort(key=lambda r: r["race_number"])
    return races_out


def fetch_racecard_graphql(meeting_date: str) -> list:
    """
    Navigate to bet.hkjc.com and intercept the GraphQL HTTP responses that
    contain data.raceMeetings[].races[].runners[]. Returns a list of race dicts
    in the same format as parse_racecard_html().

    meeting_date: 'YYYY-MM-DD'
    """
    from playwright.sync_api import sync_playwright

    captured: list = []

    def _on_response(response):
        if response.status != 200:
            return
        if GRAPHQL_HOST not in response.url:
            return
        try:
            body = response.json()
        except Exception:
            return
        races = _parse_graphql_racecard(body)
        if races:
            # Keep the response with the most races
            if len(races) > len(captured):
                captured.clear()
                captured.extend(races)

    url = BET_HKJC_URL.format(date=meeting_date)
    print(f"  [GraphQL fallback] Navigating to bet.hkjc.com …")

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
        try:
            page.goto(url, wait_until="load", timeout=40_000)
        except Exception as e:
            print(f"  [GraphQL fallback] Page load warning: {e}")
        page.wait_for_timeout(6_000)
        browser.close()

    return captured


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
                "public_odds":      r.get("public_odds"),
                "market_pct":       round(r.get("market_pct", 0.0), 2),
                "edge":             round(r.get("edge", 0.0), 2),
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
        print("\n  Primary fetch yielded nothing — trying GraphQL fallback …")
        parsed_all = fetch_racecard_graphql(meeting_str)
        if parsed_all:
            print(f"  GraphQL fallback returned {len(parsed_all)} race(s).")
            for r in parsed_all:
                print(f"  R{r['race_number']:>2}  {r['distance_m']}m {r['course_config']:<5}  "
                      f"{(r.get('race_class') or '?'):>8}  "
                      f"{len(r['entries'])} runners  going={r.get('going') or '?'}")
        else:
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
