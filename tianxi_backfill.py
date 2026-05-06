#!/usr/bin/env python3
"""
tianxi_backfill.py — Historical Happy Valley race data backfill.

Data flow:
  1. Fetches the list of valid race dates from sleepingarhat/tianxi-database
     (one GitHub API call to get all file paths in the repo).
  2. Skips dates already present in happy_valley.db.
  3. For each missing date, fetches each race from the HKJC English results
     page via headless Chromium (the page requires JavaScript to render).
  4. Parses race metadata (class, distance, going, course) and all runner data
     (English name, jockey, trainer, weight, barrier, finish position, win odds)
     directly from the rendered HTML.
  5. Inserts into DB: races + race_entries.

The script is resumable: any date fully in the DB is skipped. Run it, interrupt
it, re-run it — it picks up where it left off.

Timing estimate:
  ~100 HV meeting dates per year × 9 races × ~6s per page ≈ 90 min / year
  Run with --from 2022-01-01 to backfill the 2 most recent pre-DB years (~3 hrs).

Usage:
  python3 tianxi_backfill.py                          # 2020-01-01 to yesterday
  python3 tianxi_backfill.py --from 2022-01-01        # specific start
  python3 tianxi_backfill.py --to   2023-12-31        # specific end
  python3 tianxi_backfill.py --dry-run                # parse only, no DB writes
  python3 tianxi_backfill.py --max-dates 5 --dry-run  # quick smoke-test
  python3 tianxi_backfill.py --delay 2.0              # seconds between pages
"""

import argparse
import re
import sqlite3
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

DB_PATH  = Path(__file__).parent / "happy_valley.db"
VENUE    = "HV"
MAX_RACE = 11   # probe R1..R10, stop at first miss

RESULTS_URL = (
    "https://racing.hkjc.com/en-us/local/information/localresults"
    "?racedate={date}&Racecourse=HV&RaceNo={race_no}"
)

TIANXI_TREE_URL = (
    "https://api.github.com/repos/sleepingarhat/tianxi-database"
    "/git/trees/main?recursive=1"
)


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — get candidate dates from tianxi-database file listing
# ─────────────────────────────────────────────────────────────────────────────

def get_tianxi_dates() -> list[str]:
    """
    Return sorted list of all race-result dates available in tianxi-database
    (derived from file paths like data/2022/results_2022-11-09.csv).
    One GitHub API request.
    """
    print("  Fetching date list from tianxi-database …")
    try:
        resp = requests.get(TIANXI_TREE_URL, timeout=20)
        resp.raise_for_status()
        tree = resp.json().get("tree", [])
    except Exception as e:
        print(f"  [ERROR] Could not fetch tianxi tree: {e}")
        return []

    dates = []
    for item in tree:
        m = re.match(r"data/\d{4}/results_(\d{4}-\d{2}-\d{2})\.csv", item.get("path", ""))
        if m:
            dates.append(m.group(1))

    return sorted(set(dates))


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — filter out dates already in DB
# ─────────────────────────────────────────────────────────────────────────────

def dates_already_in_db(conn) -> set[str]:
    rows = conn.execute("SELECT DISTINCT race_date FROM races WHERE venue=?", (VENUE,)).fetchall()
    return {r[0] for r in rows}


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — HTML parsing helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_int(s):
    try:
        return int("".join(c for c in str(s) if c.isdigit() or c == "-").replace("--", ""))
    except (ValueError, TypeError):
        return None

def _safe_float(s):
    try:
        return float(str(s).strip())
    except (ValueError, TypeError):
        return None

def _parse_course(raw: str):
    """
    Parse HKJC course string → (course_config, track_surface).
    Examples:
      'TURF - "A" Course'   → ('A', 'Turf')
      'TURF - "C+3" Course' → ('C', 'Turf')  (C+3 is English 'C')
      'ALL WEATHER TRACK'   → ('AWT', 'All Weather Track')
    """
    raw = raw.upper()
    if "ALL WEATHER" in raw or "AWT" in raw:
        return "AWT", "All Weather Track"
    m = re.search(r'"([A-Z\+\d]+)"\s*COURSE', raw)
    if m:
        cfg = m.group(1).split("+")[0]   # 'C+3' → 'C'
        return cfg, "Turf"
    return "A", "Turf"   # sensible default


def parse_historical_results_html(html: str) -> tuple[dict | None, list[dict]]:
    """
    Parse a historical HKJC per-race results page.

    Returns:
      (race_meta dict | None, list of runner dicts)

    race_meta keys: race_number, distance_m, course_config, track_surface,
                    race_class, going, prize_hkd
    runner keys: horse_name (English uppercase), horse_code, horse_no,
                 jockey, trainer, weight, barrier, finish_position, public_odds
    """
    soup = BeautifulSoup(html, "html.parser")

    # ── Race metadata ─────────────────────────────────────────────────────────
    # We look for the 2nd <table> on the page (0-indexed = tables[1]).
    # It contains rows like:
    #   ['RACE 1 (150)', '', '']
    #   ['Class 5 - 1650M - (40-0)', 'Going :', 'GOOD']
    #   ['BONHAM HANDICAP', 'Course :', 'TURF - "A" Course']
    #   ['HK$ 810,000', ...]
    tables = soup.find_all("table")
    race_meta = None
    for tbl in tables:
        rows = [[c.get_text(strip=True) for c in row.find_all(["th", "td"])]
                for row in tbl.find_all("tr")]
        # Detect the metadata table by looking for 'RACE N' pattern in row[0][0]
        if rows and re.match(r"RACE\s+\d+", rows[0][0] if rows[0] else ""):
            race_no_m = re.search(r"RACE\s+(\d+)", rows[0][0])
            if not race_no_m:
                continue
            race_number = int(race_no_m.group(1))

            distance_m = None; race_class = None; going = None
            course_config = "A"; track_surface = "Turf"; prize_hkd = None

            for row in rows:
                text = " ".join(row)
                # "Class 5 - 1650M - (40-0)"
                mc = re.search(r"(Class\s+\d)", text, re.I)
                if mc:
                    race_class = mc.group(1).title()
                md = re.search(r"(\d{3,4})M", text)
                if md:
                    distance_m = int(md.group(1))
                # Going comes as ['...', 'Going :', 'GOOD'] or in text
                if len(row) >= 3 and "GOING" in row[1].upper():
                    going = row[2].strip().upper() or None
                elif "GOING" in text.upper():
                    mg = re.search(r"GOING\s*[:\-]?\s*([A-Z ]+?)(?:$|\s{2,}|\|)", text, re.I)
                    if mg:
                        going = mg.group(1).strip().upper() or None
                # Course
                if len(row) >= 3 and "COURSE" in row[1].upper():
                    course_config, track_surface = _parse_course(row[2])
                elif "COURSE" in text.upper() and "CLASS" not in text.upper():
                    mc2 = re.search(r"COURSE\s*[:\-]?\s*(.+?)(?:$|\s{2,})", text, re.I)
                    if mc2:
                        course_config, track_surface = _parse_course(mc2.group(1))
                # Prize money "HK$ 810,000"
                mp = re.search(r"HK\$\s*([\d,]+)", text)
                if mp:
                    prize_hkd = int(mp.group(1).replace(",", ""))

            race_meta = {
                "race_number":   race_number,
                "distance_m":    distance_m or 0,
                "course_config": course_config,
                "track_surface": track_surface,
                "race_class":    race_class,
                "going":         going,
                "prize_hkd":     prize_hkd,
            }
            break   # found it — no need to look further

    if race_meta is None:
        return None, []

    # ── Runner data ───────────────────────────────────────────────────────────
    # Historical results use class="draggable"; recent use class="result".
    # Try draggable first, fall back to result.
    results_tbl = (
        soup.find("table", class_="draggable")
        or soup.find("table", class_="result")
    )
    if not results_tbl:
        return race_meta, []

    runners = []
    header_seen = False
    col_map = {}

    for row in results_tbl.find_all("tr"):
        cells = [c.get_text(strip=True) for c in row.find_all(["th", "td"])]
        if not cells:
            continue

        # Detect header row by "Pla." in first cell
        if not header_seen and "Pla" in cells[0]:
            header_seen = True
            # Build a flexible column index map
            for i, h in enumerate(cells):
                h_norm = h.lower().replace(".", "").replace(" ", "")
                if "pla" in h_norm:              col_map["pos"]    = i
                if "horseno" in h_norm or "hno" in h_norm: col_map["horse_no"] = i
                if h_norm == "horse":            col_map["horse"]  = i
                if "jockey" in h_norm:           col_map["jockey"] = i
                if "trainer" in h_norm:          col_map["trainer"]= i
                if "actwt" in h_norm or "actualwt" in h_norm: col_map["weight"] = i
                if h_norm == "dr":               col_map["barrier"]= i
                if "winodd" in h_norm:           col_map["odds"]   = i
            continue

        if not header_seen or len(cells) < 5:
            continue

        def get(key, default=""):
            idx = col_map.get(key)
            return cells[idx] if idx is not None and idx < len(cells) else default

        # Finish position (handles "1DH", "WV", "PU", "DNF", etc.)
        pos_str = "".join(c for c in get("pos") if c.isdigit())
        finish_position = int(pos_str) if pos_str else None

        # Horse name and optional code "(C368)"
        raw_name = get("horse")
        code_m   = re.search(r'\(([A-Z]\d{3,4})\)$', raw_name)
        horse_code = code_m.group(1) if code_m else None
        horse_name = raw_name[:code_m.start()].strip() if code_m else raw_name.strip()
        horse_name = horse_name.upper()

        if not horse_name:
            continue

        runners.append({
            "horse_name":      horse_name,
            "horse_code":      horse_code,
            "horse_no":        _safe_int(get("horse_no")),
            "jockey":          get("jockey").strip(),
            "trainer":         get("trainer").strip(),
            "weight":          _safe_float(get("weight")),
            "barrier":         _safe_int(get("barrier")) or 99,
            "finish_position": finish_position,
            "public_odds":     _safe_float(get("odds")),
        })

    return race_meta, runners


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers (mirrors phase6_importer.py logic)
# ─────────────────────────────────────────────────────────────────────────────

def _upsert_entity(conn, table, col, val) -> int:
    c = conn.cursor()
    row = c.execute(f"SELECT rowid FROM {table} WHERE {col}=?", (val,)).fetchone()
    if row:
        return row[0]
    c.execute(f"INSERT INTO {table} ({col}) VALUES (?)", (val,))
    conn.commit()
    return c.lastrowid


def insert_historical_race(conn, iso_date: str, race_meta: dict, runners: list[dict]) -> int | None:
    """
    Insert one historical race + its entries. Returns race_id or None if skipped.
    Returns existing race_id if race already in DB (idempotent).
    """
    c = conn.cursor()

    existing = c.execute("""
        SELECT race_id FROM races
         WHERE race_date=? AND venue=? AND race_number=?
    """, (iso_date, VENUE, race_meta["race_number"])).fetchone()

    if existing:
        return existing[0]

    c.execute("""
        INSERT INTO races
          (race_date, venue, race_number, distance_m, course_config,
           track_surface, race_class, going, prize_money_hkd)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (
        iso_date, VENUE, race_meta["race_number"],
        race_meta["distance_m"], race_meta["course_config"],
        race_meta["track_surface"], race_meta.get("race_class"),
        race_meta.get("going"), race_meta.get("prize_hkd"),
    ))
    race_id = c.lastrowid
    conn.commit()

    for r in runners:
        if not r["horse_name"]:
            continue
        hid = _upsert_entity(conn, "horses",  "horse_name",   r["horse_name"])
        jid = _upsert_entity(conn, "jockeys",  "jockey_name",  r["jockey"]) if r["jockey"] else None
        tid = _upsert_entity(conn, "trainers", "trainer_name", r["trainer"]) if r["trainer"] else None

        c.execute("""
            INSERT OR REPLACE INTO race_entries
              (race_id, horse_id, barrier, jockey_id, trainer_id,
               weight, public_odds, finish_position)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            race_id, hid, r["barrier"], jid, tid,
            r["weight"], r["public_odds"], r["finish_position"],
        ))

    conn.commit()
    return race_id


# ─────────────────────────────────────────────────────────────────────────────
# Main Playwright loop
# ─────────────────────────────────────────────────────────────────────────────

def run_backfill(dates: list[str], conn, dry_run: bool, delay: float):
    """
    Open one persistent Playwright browser. For each date, fetch each race
    until no results are found.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed.")
        return

    total_races = 0
    total_entries = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        )
        page = context.new_page()

        for i, date_str in enumerate(dates):
            date_hkjc = date_str.replace("-", "/")
            races_this_date = 0
            print(f"\n  [{i+1}/{len(dates)}] {date_str} …", end=" ", flush=True)

            for race_no in range(1, MAX_RACE):
                url = RESULTS_URL.format(date=date_hkjc, race_no=race_no)
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                    time.sleep(3)  # allow JS to render
                except Exception as e:
                    print(f"\n    [R{race_no}] page error: {e}")
                    break

                html = page.content()
                race_meta, runners = parse_historical_results_html(html)

                if race_meta is None:
                    # No results table → no more races for this date
                    if race_no == 1:
                        print("no HV meeting.")
                    break

                if not runners:
                    print(f"\n    [R{race_no}] no runners parsed — skipping.")
                    continue

                if dry_run:
                    print(f"\n    [dry-run] R{race_no}  {race_meta['distance_m']}m "
                          f"{race_meta['course_config']}  {race_meta.get('race_class','?')}  "
                          f"{len(runners)} runners")
                    races_this_date += 1
                else:
                    race_id = insert_historical_race(conn, date_str, race_meta, runners)
                    if race_id:
                        races_this_date += 1
                        total_entries += len(runners)

                time.sleep(delay)

            if races_this_date > 0:
                total_races += races_this_date
                if not dry_run:
                    print(f"✓  {races_this_date} race(s) inserted.")
                else:
                    print(f"→  {races_this_date} race(s) found (dry-run).")

        browser.close()

    print(f"\n  ─────────────────────────────────────")
    print(f"  Done.  {total_races} races  •  {total_entries} entries inserted.")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Backfill historical Happy Valley race data from HKJC results HTML."
    )
    parser.add_argument("--from",  dest="date_from", default="2020-01-01",
                        help="Start date YYYY-MM-DD (default: 2020-01-01)")
    parser.add_argument("--to",    dest="date_to",
                        default=(date.today() - timedelta(days=1)).isoformat(),
                        help="End date YYYY-MM-DD (default: yesterday)")
    parser.add_argument("--dry-run",   action="store_true",
                        help="Parse HTML only — do not write to DB")
    parser.add_argument("--max-dates", type=int, default=0, metavar="N",
                        help="Process at most N dates (0 = no limit)")
    parser.add_argument("--delay",     type=float, default=1.5, metavar="SEC",
                        help="Seconds to wait between race page fetches (default: 1.5)")
    args = parser.parse_args()

    print(f"\n{'='*64}")
    print(f"  HV Historical Backfill  {args.date_from}  →  {args.date_to}")
    print(f"{'='*64}")

    # ── Get candidate dates ───────────────────────────────────────────────────
    all_dates = get_tianxi_dates()
    if not all_dates:
        print("  No dates found from tianxi. Check network access.")
        sys.exit(1)

    # Filter by date range
    dates = [d for d in all_dates if args.date_from <= d <= args.date_to]
    print(f"  {len(dates)} candidate dates in range  "
          f"(of {len(all_dates)} total in tianxi).")

    # Filter out dates already in DB
    conn = sqlite3.connect(DB_PATH)
    already = dates_already_in_db(conn)
    dates = [d for d in dates if d not in already]
    print(f"  {len(dates)} dates not yet in DB  ({len(already)} already present).")

    if not dates:
        print("  Nothing to do — all dates already imported.")
        conn.close()
        sys.exit(0)

    if args.max_dates and len(dates) > args.max_dates:
        dates = dates[:args.max_dates]
        print(f"  Limited to {args.max_dates} date(s) (--max-dates flag).")

    # ── Estimate time ─────────────────────────────────────────────────────────
    est_min = len(dates) * 9 * (args.delay + 4) / 60
    print(f"  Estimated time: ~{est_min:.0f} min  (varies with page load speed).")
    if not args.dry_run:
        print(f"  Writing to: {DB_PATH.name}")

    print(f"\n  Starting … (interrupt with Ctrl-C to pause; re-run to resume)\n")

    try:
        run_backfill(dates, conn, dry_run=args.dry_run, delay=args.delay)
    except KeyboardInterrupt:
        print("\n\n  Interrupted. Re-run to continue from where we left off.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
