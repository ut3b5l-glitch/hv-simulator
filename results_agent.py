#!/usr/bin/env python3
"""
results_agent.py — Post-race results fetcher for Happy Valley.

Fetches official HKJC results after the Wednesday night meeting, updates
finish_position in race_entries, auto-settles open paper trades, and writes
a results_YYYY-MM-DD.json comparing predictions vs actuals.

Usage:
  python3 results_agent.py                    # auto last Wednesday
  python3 results_agent.py --date 2026-05-07  # specific date
  python3 results_agent.py --dry-run          # fetch + parse only, no DB writes
  python3 results_agent.py --settle-only      # skip fetch, settle from existing finish_positions

Cron (Wed 11pm HKT = 15:00 UTC):
  0 15 * * 3  cd "$HOME/AI Playground/HV_Simulator" && python3 results_agent.py >> agent.log 2>&1
"""

import argparse
import json
import sqlite3
import sys
import time
from datetime import date, timedelta
from pathlib import Path

from bs4 import BeautifulSoup

DB_PATH   = Path(__file__).parent / "happy_valley.db"
VENUE     = "HV"
MAX_RACES = 11  # probe R1..R10, stop on first miss

RESULTS_URL = (
    "https://racing.hkjc.com/en-us/local/information/localresults"
    "?racedate={date}&Racecourse=HV&RaceNo={race_no}"
)


# ─────────────────────────────────────────────────────────────────────────────
# Date helpers
# ─────────────────────────────────────────────────────────────────────────────

def last_wednesday(from_date: date) -> date:
    """Return the most recent Wednesday on or before from_date."""
    days_back = (from_date.weekday() - 2) % 7  # 0 if today is Wed
    return from_date - timedelta(days=days_back)


# ─────────────────────────────────────────────────────────────────────────────
# Playwright fetch
# ─────────────────────────────────────────────────────────────────────────────

def fetch_results_html(page, race_date_str: str, race_no: int) -> str | None:
    """
    Fetch a single per-race results page using an already-open Playwright page.
    race_date_str: 'YYYY/MM/DD'
    Returns HTML string, or None if no results were found.
    """
    url = RESULTS_URL.format(date=race_date_str, race_no=race_no)
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    except Exception as e:
        print(f"  [R{race_no}] Timeout/error: {e}")
        return None

    # HKJC per-race results pages render as table.draggable (not table.result).
    # table.result only appears on the multi-race summary page.
    try:
        page.wait_for_selector("table.draggable, table.result", timeout=12_000)
    except Exception:
        return None  # results not yet posted or race doesn't exist

    time.sleep(2)   # allow any late JS to settle
    html = page.content()
    if "table" not in html:
        return None
    return html


# ─────────────────────────────────────────────────────────────────────────────
# HTML parser
# ─────────────────────────────────────────────────────────────────────────────

def parse_results_html(html: str) -> list[dict]:
    """
    Parse a per-race results page.
    Returns a list of finisher dicts:
      {position: int|None, horse_name: str, horse_no: int,
       barrier: int|None, win_odds: float|None}
    position is None for scratched/non-finishers (WV, PU, DNF, etc.)

    Handles two HKJC table formats:
      - table.draggable  (per-race URL, all finishers, includes Win Odds column)
      - table.result     (multi-race summary page, top-4 only, no Win Odds)
    """
    import re as _re
    soup = BeautifulSoup(html, "html.parser")

    # Prefer the full per-race table; fall back to the summary table
    table = soup.find("table", class_="draggable") or soup.find("table", class_="result")
    if not table:
        return []

    # Build a flexible column index map from the header row
    headers = []
    first_row = table.find("tr")
    if first_row:
        headers = [c.get_text(strip=True).lower().replace(".", "").replace(" ", "")
                   for c in first_row.find_all(["th", "td"])]

    def col_exact(key):
        """Return index of first header that exactly equals key."""
        try:
            return headers.index(key)
        except ValueError:
            return None

    def col_contains(key):
        """Return index of first header that contains key as substring."""
        for i, h in enumerate(headers):
            if key in h:
                return i
        return None

    idx_pos      = col_exact("pla") or 0
    idx_horse_no = col_exact("horseno") or col_exact("hno") or 1
    idx_horse    = col_exact("horse") or 2          # exact: avoids hitting "horseno"
    idx_weight   = col_exact("actwt") or col_exact("actualwt") or 5
    idx_barrier  = col_exact("dr")                  # Draw column
    idx_odds     = col_contains("winodd")

    finishers = []
    for row in table.find_all("tr")[1:]:  # skip header
        cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
        if len(cells) < 3:
            continue

        pla_raw = cells[idx_pos] if idx_pos < len(cells) else ""

        # Strip HKJC horse code from name: "LONDON LUCKYSTAR(C368)" → "LONDON LUCKYSTAR"
        raw_name = cells[idx_horse] if idx_horse < len(cells) else ""
        code_m   = _re.search(r'\([A-Z]\d{3,4}\)$', raw_name)
        horse_name = (raw_name[:code_m.start()].strip() if code_m else raw_name.strip()).upper()

        if not horse_name:
            continue

        # Finish position — numeric only; WV/PU/DNF → None
        pos_str  = "".join(c for c in pla_raw if c.isdigit())
        position = int(pos_str) if pos_str else None

        try:
            horse_no = int(cells[idx_horse_no]) if idx_horse_no < len(cells) else None
        except (ValueError, TypeError):
            horse_no = None

        # Barrier — last column in summary format, or idx_barrier in full format
        if idx_barrier is not None and idx_barrier < len(cells):
            barrier_raw = cells[idx_barrier]
        elif len(cells) >= 7:
            barrier_raw = cells[-1]
        else:
            barrier_raw = None
        try:
            barrier = int(barrier_raw) if barrier_raw else None
        except (ValueError, TypeError):
            barrier = None

        # Win odds — only available in full (draggable) format
        win_odds = None
        if idx_odds is not None and idx_odds < len(cells):
            try:
                win_odds = float(cells[idx_odds])
            except (ValueError, TypeError):
                pass

        finishers.append({
            "position":   position,
            "horse_name": horse_name,
            "horse_no":   horse_no,
            "barrier":    barrier,
            "win_odds":   win_odds,
        })

    return finishers


# ─────────────────────────────────────────────────────────────────────────────
# DB operations
# ─────────────────────────────────────────────────────────────────────────────

def get_race_id(conn, meeting_date: str, race_no: int) -> int | None:
    row = conn.execute(
        "SELECT race_id FROM races WHERE race_date=? AND race_number=? AND venue=?",
        (meeting_date, race_no, VENUE),
    ).fetchone()
    return row[0] if row else None


def get_horse_id(conn, horse_name: str) -> int | None:
    row = conn.execute(
        "SELECT horse_id FROM horses WHERE horse_name=?",
        (horse_name,),
    ).fetchone()
    return row[0] if row else None


def update_finish_positions(conn, race_id: int, finishers: list[dict]) -> int:
    """
    Update finish_position (and public_odds when available) in race_entries.
    Returns count of rows updated.
    """
    c = conn.cursor()
    updated = 0
    for f in finishers:
        if f["position"] is None:
            continue  # scratched/non-finisher — leave as NULL

        horse_id = get_horse_id(conn, f["horse_name"])
        if horse_id is None:
            print(f"    [WARN] Horse not found in DB: {f['horse_name']}")
            continue

        win_odds = f.get("win_odds")
        if win_odds is not None:
            c.execute(
                """UPDATE race_entries SET finish_position=?, public_odds=?
                   WHERE race_id=? AND horse_id=?""",
                (f["position"], win_odds, race_id, horse_id),
            )
        else:
            c.execute(
                """UPDATE race_entries SET finish_position=?
                   WHERE race_id=? AND horse_id=?""",
                (f["position"], race_id, horse_id),
            )
        if c.rowcount > 0:
            updated += 1

    conn.commit()
    return updated


def settle_paper_trades(conn, meeting_date: str) -> list[dict]:
    """
    Auto-settle open paper trades for the given meeting date.
    Returns list of settlement records for reporting.
    """
    open_trades = conn.execute("""
        SELECT pt.trade_id, pt.race_id, pt.horse_id, pt.public_odds,
               r.race_number, h.horse_name
        FROM paper_trades pt
        JOIN races  r ON pt.race_id  = r.race_id
        JOIN horses h ON pt.horse_id = h.horse_id
        WHERE r.race_date=? AND r.venue=? AND pt.result IS NULL
        ORDER BY r.race_number
    """, (meeting_date, VENUE)).fetchall()

    if not open_trades:
        return []

    c = conn.cursor()
    settlements = []
    for trade_id, race_id, horse_id, odds, race_no, horse_name in open_trades:
        finish = conn.execute(
            "SELECT finish_position FROM race_entries WHERE race_id=? AND horse_id=?",
            (race_id, horse_id),
        ).fetchone()

        if finish is None or finish[0] is None:
            # No finish data — could be scratched; mark VOID
            c.execute(
                "UPDATE paper_trades SET result='VOID', profit=0 WHERE trade_id=?",
                (trade_id,),
            )
            settlements.append({"race": race_no, "horse": horse_name,
                                 "result": "VOID", "finish": None, "profit": 0.0})
            continue

        finish_pos = finish[0]
        won = (finish_pos == 1)
        profit = (odds - 1.0) if (won and odds) else -1.0
        result = "WIN" if won else "LOSS"

        c.execute("""
            UPDATE paper_trades
               SET result=?, finish_position=?, profit=?
             WHERE trade_id=?
        """, (result, finish_pos, profit, trade_id))

        settlements.append({"race": race_no, "horse": horse_name,
                             "result": result, "finish": finish_pos,
                             "profit": profit, "odds": odds})

    conn.commit()
    return settlements


# ─────────────────────────────────────────────────────────────────────────────
# Predictions JSON — load and annotate with actuals
# ─────────────────────────────────────────────────────────────────────────────

def load_predictions(meeting_date: str) -> dict | None:
    path = Path(__file__).parent / f"predictions_{meeting_date}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_results_json(conn, meeting_date: str, race_results: list[dict]) -> dict:
    """Merge race_results (parsed finishers per race) with DB actuals."""
    races_out = []
    for entry in race_results:
        race_no   = entry["race_no"]
        finishers = entry["finishers"]

        race_id = get_race_id(conn, meeting_date, race_no)
        if not race_id:
            continue

        # Build {horse_name: finish_position} map from DB (authoritative after update)
        db_results = conn.execute("""
            SELECT h.horse_name, re.finish_position
            FROM race_entries re
            JOIN horses h ON re.horse_id = h.horse_id
            WHERE re.race_id=?
            ORDER BY re.finish_position
        """, (race_id,)).fetchall()

        actual_top3 = [r[0] for r in db_results if r[1] and r[1] <= 3]

        races_out.append({
            "race_number": race_no,
            "race_id":     race_id,
            "finishers":   [{"position": f["position"], "horse_name": f["horse_name"]}
                            for f in finishers if f["position"]],
            "actual_top3": actual_top3,
        })

    return {
        "meeting_date": meeting_date,
        "settled_at":   __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "races":        races_out,
    }


def compute_accuracy(results_json: dict, predictions: dict | None) -> dict:
    """Compare predictions vs actuals. Returns summary stats."""
    if not predictions:
        return {}

    pred_by_race = {r["race_number"]: r for r in predictions.get("races", [])}
    total, hits = 0, 0

    for race in results_json["races"]:
        rno     = race["race_number"]
        actual  = set(race.get("actual_top3", []))
        pred    = pred_by_race.get(rno, {})
        top3    = set(pred.get("top3", []))
        overlap = len(actual & top3)
        total  += min(len(actual), 3)
        hits   += overlap

    precision = (hits / total * 100) if total else 0.0
    return {"races_with_results": len(results_json["races"]),
            "top3_hits": hits, "top3_total": total,
            "top3_precision_pct": round(precision, 1)}


def print_summary(meeting_date: str, race_results: list[dict],
                  settlements: list[dict], accuracy: dict):
    W = 64
    print()
    print(f"  {'─'*W}")
    print(f"  RESULTS  {meeting_date}  ({len(race_results)} race(s) fetched)")
    print(f"  {'─'*W}")

    for entry in race_results:
        rno  = entry["race_no"]
        fins = [f for f in entry["finishers"] if f["position"]]
        top3 = "  /  ".join(f['horse_name'] for f in fins[:3])
        print(f"  R{rno:>2}  1st-3rd: {top3}")

    if accuracy:
        print(f"\n  Accuracy: {accuracy['top3_hits']}/{accuracy['top3_total']} "
              f"picks placed  ({accuracy['top3_precision_pct']}% precision)")

    if settlements:
        print(f"\n  Paper trades settled: {len(settlements)}")
        pnl = sum(s["profit"] for s in settlements)
        wins = sum(1 for s in settlements if s["result"] == "WIN")
        for s in settlements:
            tag = "✓" if s["result"] == "WIN" else ("○" if s["result"] == "VOID" else "✗")
            fin = f"P{s['finish']}" if s.get("finish") else "—"
            pnl_str = f"{s['profit']:+.2f}" if s.get("profit") is not None else "  —"
            print(f"    {tag} R{s['race']:>2}  {s['horse']:<22}  {fin:<4}  {pnl_str}")
        print(f"\n  Session P&L: {pnl:+.2f} units  ({wins}/{len(settlements)} wins)")
    else:
        print("\n  No open paper trades to settle.")

    print(f"  {'─'*W}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch HV race results and settle paper trades.")
    parser.add_argument("--date",        help="Meeting date YYYY-MM-DD (default: last Wednesday)")
    parser.add_argument("--dry-run",     action="store_true",
                        help="Fetch and parse only — no DB writes")
    parser.add_argument("--settle-only", action="store_true",
                        help="Skip fetch; settle trades using existing finish_positions in DB")
    args = parser.parse_args()

    if args.date:
        try:
            meeting = date.fromisoformat(args.date)
        except ValueError:
            print(f"ERROR: invalid date '{args.date}', expected YYYY-MM-DD")
            sys.exit(1)
    else:
        meeting = last_wednesday(date.today())

    meeting_str  = meeting.isoformat()           # 'YYYY-MM-DD'
    meeting_hkjc = meeting.strftime("%Y/%m/%d")  # 'YYYY/MM/DD'
    results_out  = Path(__file__).parent / f"results_{meeting_str}.json"

    print(f"\n{'='*66}")
    print(f"  HV Results Agent  →  {meeting_str}")
    print(f"{'='*66}")

    conn = sqlite3.connect(DB_PATH)

    # ── Settle-only mode ─────────────────────────────────────────────────────
    if args.settle_only:
        print("  [settle-only] Using existing finish_positions from DB.\n")
        settlements = settle_paper_trades(conn, meeting_str)
        conn.close()
        print_summary(meeting_str, [], settlements, {})
        return

    # ── Playwright fetch ──────────────────────────────────────────────────────
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run:  pip3 install playwright && playwright install chromium")
        sys.exit(1)

    race_results = []   # [{race_no, finishers}]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
        page = context.new_page()

        for race_no in range(1, MAX_RACES):
            print(f"  Fetching R{race_no} results …", end=" ", flush=True)
            html = fetch_results_html(page, meeting_hkjc, race_no)

            if html is None:
                print("not found — stopping.")
                break

            finishers = parse_results_html(html)
            if not finishers:
                print("parse failed — skipping.")
                continue

            ranked = [f for f in finishers if f["position"] is not None]
            scratched = [f for f in finishers if f["position"] is None]
            winner = next((f["horse_name"] for f in ranked if f["position"] == 1), "?")
            print(f"✓  {len(ranked)} finishers  1st: {winner}"
                  + (f"  ({len(scratched)} scratched)" if scratched else ""))

            race_results.append({"race_no": race_no, "finishers": finishers})
            time.sleep(1.0)

        browser.close()

    if not race_results:
        print("\nNo results found. Meeting may not have run yet.")
        conn.close()
        sys.exit(0)

    print(f"\n  Fetched results for {len(race_results)} race(s).")

    if args.dry_run:
        print("  [dry-run] Skipping DB writes.\n")
        for entry in race_results:
            print(f"    R{entry['race_no']:>2}: "
                  + ", ".join(f"P{f['position']} {f['horse_name']}"
                               for f in entry['finishers'] if f['position'])[:80])
        conn.close()
        return

    # ── Update DB ─────────────────────────────────────────────────────────────
    print(f"\n  Updating DB …")
    for entry in race_results:
        race_no  = entry["race_no"]
        race_id  = get_race_id(conn, meeting_str, race_no)
        if race_id is None:
            print(f"    [WARN] Race {race_no} not in DB — skipping (run wednesday_agent first?)")
            continue
        n = update_finish_positions(conn, race_id, entry["finishers"])
        print(f"    R{race_no:>2}: {n} entries updated")

    # ── Settle paper trades ───────────────────────────────────────────────────
    print(f"\n  Settling paper trades …")
    settlements = settle_paper_trades(conn, meeting_str)

    # ── Build results JSON ────────────────────────────────────────────────────
    results_data = build_results_json(conn, meeting_str, race_results)
    predictions  = load_predictions(meeting_str)
    accuracy     = compute_accuracy(results_data, predictions)
    results_data["accuracy"] = accuracy
    results_data["settlements"] = settlements

    with open(results_out, "w", encoding="utf-8") as f:
        json.dump(results_data, f, indent=2, ensure_ascii=False)
    print(f"  Results saved → {results_out.name}")

    conn.close()
    print_summary(meeting_str, race_results, settlements, accuracy)


if __name__ == "__main__":
    main()
