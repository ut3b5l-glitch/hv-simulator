#!/usr/bin/env python3
"""
phase6_importer.py
Parse a SAVED HKJC racecard HTML file, insert the race into the DB,
run the model, and print top-3 place predictions + value bets.

Usage:
  python3 phase6_importer.py "Race Card_Apr 29 2026.html"
  python3 phase6_importer.py          # prompts for file path
"""

import sqlite3
import sys
import re
from pathlib import Path
from bs4 import BeautifulSoup

import model_core as mc

DB_PATH = "happy_valley.db"
VENUE   = "HV"


# ─────────────────────────────────────────────────────────────────────────────
# HTML parsing
# ─────────────────────────────────────────────────────────────────────────────

def parse_racecard_html(html_str):
    """
    Parse HKJC racecard HTML (as a string).
    Returns a list with ONE race dict (each racecard page covers one race).
    """
    soup = BeautifulSoup(html_str, "html.parser")

    # Race info header
    race_info_div = None
    for div in soup.find_all("div", class_="f_fs13"):
        txt = div.get_text()
        if "Race " in txt and "Happy Valley" in txt:
            race_info_div = div
            break
    if not race_info_div:
        print("[ERROR] Could not find race info div.")
        return []

    info = race_info_div.get_text()

    m = re.search(r"Race\s+(\d+)", info)
    race_number = int(m.group(1)) if m else 1

    m = re.search(r"(\d{3,4})\s*M", info)
    distance_m = int(m.group(1)) if m else 0

    m = re.search(r'"([^"]+)"\s*Course', info)
    course_cfg = m.group(1) if m else "C"

    m = re.search(r"(Turf|TURF|All\s*Weather|AWT)", info, re.I)
    track_surface = m.group(1).strip().title() if m else "Turf"

    m = re.search(r"(Class\s*\d)", info, re.I)
    race_class = m.group(1).title() if m else None

    m = re.search(r"(GOOD TO FIRM|GOOD TO YIELDING|GOOD|FIRM)", info, re.I)
    going = m.group(1).upper() if m else None

    # Starter table
    outer = soup.find("table", id="racecardlist")
    if not outer:
        print("[ERROR] Could not find table#racecardlist.")
        return []
    starter = outer.find("table", class_="starter") or outer.find("table")
    if not starter:
        print("[ERROR] Could not find starter table.")
        return []
    tbody = starter.find("tbody")
    if not tbody:
        print("[ERROR] Could not find tbody.")
        return []

    # Column map (confirmed from HKJC racecard HTML header):
    # 0=Horse No, 1=Last 6 Runs, 2=Colour, 3=Horse, 4=Brand, 5=Wt.(carried),
    # 6=Jockey, 7=Over Wt, 8=Draw(barrier), 9=Trainer, 10=Int'l Rtg,
    # 11=Rtg.(HKJC), 12=Rtg.+/-, 13=Horse Wt(decl), 14=Wt.+/-,
    # 15=Best Time, 16=Age, 17=WFA, 18=Sex, 19=Season Stakes,
    # 20=Priority, 21=Days since Last Run, 22=Gear, ...
    COL = {
        "last_6_runs":        1,
        "horse_name":         3,
        "weight":             5,
        "jockey":             6,
        "barrier":            8,
        "trainer":            9,
        "official_rating":    11,
        "rating_change":      12,
        "days_since_last_run": 21,
    }

    def safe_int(s):
        try:
            return int(s.replace("+", "").replace(" ", ""))
        except (ValueError, AttributeError):
            return None

    def safe_float(s):
        try:
            v = float(s.replace("+", "").replace(" ", ""))
            return v
        except (ValueError, AttributeError):
            return None

    entries = []
    for row in tbody.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) < 10:
            continue

        def txt(i):
            return cols[i].get_text(strip=True) if i < len(cols) else ""

        if not txt(0).isdigit():
            continue

        horse_name = txt(COL["horse_name"])
        if not horse_name:
            continue

        # Weight carried (lbs) — col 5, confirmed range 100–140
        weight = safe_float(txt(COL["weight"]))
        if weight and not (100 <= weight <= 140):
            weight = None

        # Official HKJC rating — col 11 (may be '-' for unrated)
        official_rating = safe_int(txt(COL["official_rating"]))

        # Rating change — col 12 (e.g. '0', '-2', '+3')
        rating_change = safe_int(txt(COL["rating_change"]))

        # Days since last run — col 21
        days_since_last_run = safe_int(txt(COL["days_since_last_run"]))

        # Last 6 runs — col 1 (e.g. '4/6/1/12/14/3', may be empty for debutants)
        last_6_runs = txt(COL["last_6_runs"]) or None

        # Barrier (draw) — col 8
        barrier = safe_int(txt(COL["barrier"])) or 99

        entries.append({
            "horse_name":         horse_name,
            "barrier":            barrier,
            "jockey":             txt(COL["jockey"]),
            "trainer":            txt(COL["trainer"]),
            "weight":             weight,
            "official_rating":    official_rating,
            "rating_change":      rating_change,
            "days_since_last_run": days_since_last_run,
            "last_6_runs":        last_6_runs,
            "public_odds":        None,
        })

    if not entries:
        print("[ERROR] No entries found in starter table.")
        return []

    return [{
        "race_number":   race_number,
        "distance_m":    distance_m,
        "course_config": course_cfg,
        "track_surface": track_surface,
        "race_class":    race_class,
        "going":         going,
        "entries":       entries,
    }]


def parse_saved_racecard(html_path):
    """Convenience wrapper: read an HTML file and call parse_racecard_html()."""
    with open(html_path, "r", encoding="utf-8") as f:
        return parse_racecard_html(f.read())


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_or_create_ids(conn, horse_name, jockey_name, trainer_name):
    c = conn.cursor()
    def upsert(table, col, val):
        r = c.execute(f"SELECT rowid FROM {table} WHERE {col}=?", (val,)).fetchone()
        if r:
            return r[0]
        c.execute(f"INSERT INTO {table} ({col}) VALUES (?)", (val,))
        return c.lastrowid

    hid = upsert("horses",   "horse_name",   horse_name)
    jid = upsert("jockeys",  "jockey_name",  jockey_name)
    tid = upsert("trainers", "trainer_name", trainer_name)
    conn.commit()
    return hid, jid, tid


def insert_race_day(conn, iso_date, parsed_races):
    inserted = []
    for pr in parsed_races:
        c = conn.cursor()
        row = c.execute("""
            SELECT race_id FROM races
            WHERE race_date=? AND venue=? AND race_number=?
        """, (iso_date, VENUE, pr["race_number"])).fetchone()

        if row:
            race_id = row[0]
            print(f"  Race {pr['race_number']} already in DB (id={race_id}).")
            if pr.get("going"):
                c.execute("UPDATE races SET going=? WHERE race_id=?",
                          (pr["going"], race_id))
        else:
            c.execute("""
                INSERT INTO races
                  (race_date, venue, race_number, distance_m, course_config,
                   track_surface, race_class, going)
                VALUES (?,?,?,?,?,?,?,?)
            """, (iso_date, VENUE, pr["race_number"], pr["distance_m"],
                  pr["course_config"], pr["track_surface"], pr.get("race_class"),
                  pr.get("going")))
            race_id = c.lastrowid
            print(f"  Race {pr['race_number']} inserted (id={race_id}).")

        for e in pr["entries"]:
            hid, jid, tid = get_or_create_ids(
                conn, e["horse_name"], e["jockey"], e["trainer"])
            c.execute("""
                INSERT OR REPLACE INTO race_entries
                  (race_id, horse_id, barrier, jockey_id, trainer_id,
                   weight, public_odds, finish_position,
                   official_rating, rating_change, days_since_last_run, last_6_runs)
                VALUES (?,?,?,?,?,?,?,NULL,?,?,?,?)
            """, (race_id, hid, e["barrier"], jid, tid,
                  e.get("weight"), e.get("public_odds"),
                  e.get("official_rating"), e.get("rating_change"),
                  e.get("days_since_last_run"), e.get("last_6_runs")))

        conn.commit()
        print(f"  {len(pr['entries'])} entries ready.")
        inserted.append((race_id, pr))
    return inserted


def load_entries_for_race(conn, race_id):
    """Fetch all entries for a race from DB, in the format score_race() expects."""
    rows = conn.execute("""
        SELECT e.horse_id, h.horse_name, e.barrier,
               e.jockey_id, e.trainer_id, e.weight, e.public_odds, e.finish_position,
               e.official_rating, e.rating_change, e.days_since_last_run, e.last_6_runs
        FROM race_entries e
        JOIN horses h ON e.horse_id = h.horse_id
        WHERE e.race_id = ?
    """, (race_id,)).fetchall()
    return [
        {
            "horse_id":            r[0],
            "horse_name":          r[1],
            "barrier":             r[2],
            "jockey_id":           r[3],
            "trainer_id":          r[4],
            "weight":              r[5],
            "public_odds":         r[6],
            "finish_position":     r[7],
            "official_rating":     r[8],
            "rating_change":       r[9],
            "days_since_last_run": r[10],
            "last_6_runs":         r[11],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Paper trades
# ─────────────────────────────────────────────────────────────────────────────

def log_paper_trades(conn, race_id, iso_date, runners):
    """
    Log all value-bet runners to the paper_trades table.
    If a trade for (race_id, horse_id) already exists it is updated in place.
    Returns the number of value bets logged.
    """
    value = [r for r in runners if r["is_value"]]
    if not value:
        return 0
    c = conn.cursor()
    for r in value:
        existing = c.execute(
            "SELECT trade_id FROM paper_trades WHERE race_id=? AND horse_id=?",
            (race_id, r["horse_id"])
        ).fetchone()
        if existing:
            c.execute("""
                UPDATE paper_trades
                   SET model_win_pct=?, model_place_pct=?, model_show_pct=?,
                       edge=?, public_odds=?
                 WHERE trade_id=?
            """, (r["win_pct"], r["place_pct"], r["show_pct"],
                  r["edge"], r.get("public_odds"), existing[0]))
        else:
            c.execute("""
                INSERT INTO paper_trades
                  (race_id, horse_id, trade_date,
                   model_win_pct, model_place_pct, model_show_pct,
                   edge, public_odds, stake, result, logged_at)
                VALUES (?,?,?,?,?,?,?,?,1.0,NULL,datetime('now'))
            """, (race_id, r["horse_id"], iso_date,
                  r["win_pct"], r["place_pct"], r["show_pct"],
                  r["edge"], r.get("public_odds")))
    conn.commit()
    return len(value)


def enter_results(conn, race_id, runners):
    """
    Prompt the user to enter the actual finishing order after the race.
    Updates race_entries.finish_position and settles any open paper_trades.
    Entry accepts barrier number (fastest) or full/partial horse name.
    """
    print("\n  Enter finishing order — barrier number or horse name, 'done' to finish.\n")

    by_barrier = sorted(runners, key=lambda x: x["barrier"])
    bar_map    = {r["barrier"]:          r for r in runners}
    name_map   = {r["horse_name"].lower(): r for r in runners}

    positions = {}   # horse_id → finish_position
    pos = 1
    while pos <= len(runners):
        raw = input(f"  Position {pos:>2}: ").strip()
        if raw.lower() in ("done", "q", ""):
            break

        runner = None
        try:
            runner = bar_map.get(int(raw))
        except ValueError:
            # try full or partial name
            runner = name_map.get(raw.lower())
            if not runner:
                for nm, r in name_map.items():
                    if raw.lower() in nm:
                        runner = r
                        break

        if not runner:
            print(f"    [Not found: '{raw}'] — use barrier number or horse name")
            continue
        if runner["horse_id"] in positions:
            print(f"    [{runner['horse_name']} already assigned P{positions[runner['horse_id']]}]")
            continue

        positions[runner["horse_id"]] = pos
        print(f"    → P{pos}: {runner['horse_name']}")
        pos += 1

    if not positions:
        print("  No results entered.")
        return

    c = conn.cursor()
    for hid, finish_pos in positions.items():
        c.execute(
            "UPDATE race_entries SET finish_position=? WHERE race_id=? AND horse_id=?",
            (finish_pos, race_id, hid)
        )

    # Settle any open paper trades for this race
    open_trades = c.execute(
        "SELECT trade_id, horse_id, public_odds FROM paper_trades "
        "WHERE race_id=? AND result IS NULL",
        (race_id,)
    ).fetchall()

    settled_pnl = 0.0
    for trade_id, horse_id, odds in open_trades:
        finish   = positions.get(horse_id)
        won      = (finish == 1)
        profit   = ((odds - 1.0) if won else -1.0) if odds else None
        c.execute("""
            UPDATE paper_trades
               SET result=?, finish_position=?, profit=?
             WHERE trade_id=?
        """, ("WIN" if won else "LOSS", finish, profit, trade_id))
        if profit is not None:
            settled_pnl += profit

    conn.commit()

    print(f"\n  {len(positions)} position(s) recorded.")
    if open_trades:
        print(f"  {len(open_trades)} paper trade(s) settled  "
              f"(race P&L: {settled_pnl:+.2f} units)")


# ─────────────────────────────────────────────────────────────────────────────
# Odds entry
# ─────────────────────────────────────────────────────────────────────────────

def prompt_and_apply_odds(conn, race_id, runners):
    """
    Prompt user to enter tote WIN odds for each runner (sorted by barrier).
    Saves to race_entries.public_odds. Returns True if any were entered.
    """
    print("\nEnter decimal WIN tote odds for each runner.")
    print("Format: decimal (e.g. 5.5). Press Enter to skip.\n")

    name_to_hid = {
        r["horse_name"]: r["horse_id"]
        for r in runners
    }
    by_barrier = sorted(runners, key=lambda x: x["barrier"])

    c = conn.cursor()
    any_entered = False
    for r in by_barrier:
        hname   = r["horse_name"]
        barrier = r["barrier"]
        show    = r["show_pct"]
        raw = input(
            f"  Barrier {barrier:2d}  {hname:22s}  (Show {show:5.1f}%) WIN odds: "
        ).strip()
        if not raw:
            continue
        try:
            odds = float(raw.replace("$", "").replace(",", ""))
            if odds <= 1.0:
                print("    [Skipped — decimal odds must be > 1.0]")
                continue
            c.execute(
                "UPDATE race_entries SET public_odds=? WHERE race_id=? AND horse_id=?",
                (odds, race_id, name_to_hid[hname])
            )
            any_entered = True
        except (ValueError, KeyError):
            print(f"    [Could not parse '{raw}']")

    conn.commit()
    return any_entered


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

def print_output(race_meta, runners, has_odds):
    W = 72
    print("\n" + "=" * W)
    print(f"  HAPPY VALLEY  Race {race_meta['race_number']}  |  "
          f"{race_meta['distance_m']}m {race_meta['course_config']}  |  "
          f"{race_meta.get('race_class') or 'Class ?'}")
    print("=" * W)

    # ── Top-3 place predictions ──────────────────────────────────────────────
    print(f"\n  {'#':<3} {'Horse':<22} {'Rtg':>4} {'Chg':>4} {'Days':>5} {'Last 6':>14}  "
          f"{'Win%':>5} {'Plc%':>5} {'Shw%':>5}")
    print("  " + "-" * (W - 2))

    for rank, r in enumerate(runners, 1):
        marker = "★ " if rank <= 3 else "  "
        rtg    = f"{r.get('official_rating') or '':>3}"
        chg    = (f"{r.get('rating_change'):+d}" if r.get('rating_change') is not None else "  -")
        days   = f"{r.get('days_since_last_run') or '':>4}"
        runs   = (r.get("last_6_runs") or "-")[:14]
        print(
            f"  {marker}{rank:<2} {r['horse_name']:<22} {rtg:>4} {chg:>4} {days:>5} {runs:>14}  "
            f"{r['win_pct']:>4.1f}% {r['place_pct']:>4.1f}% {r['show_pct']:>4.1f}%"
        )

    # ── Factor detail (compact second pass) ─────────────────────────────────
    print(f"\n  {'#':<3} {'Horse':<22} {'BIV':>5} {'Joc':>5} {'Tra':>5} "
          f"{'Hrs':>5} {'Frm':>5} {'Cls':>5} {'WtC':>5} {'Rtg':>5} {'Day':>5}")
    print("  " + "-" * (W - 2))
    for rank, r in enumerate(runners, 1):
        marker = "★ " if rank <= 3 else "  "
        print(
            f"  {marker}{rank:<2} {r['horse_name']:<22} "
            f"{r['b_iv']:>4.2f}  {r['jf']:>4.2f}  {r['tf']:>4.2f}  "
            f"{r['hf']:>4.2f}  {r['ff']:>4.2f}  {r.get('cf', 1.0):>4.2f}  "
            f"{r.get('wcf', 1.0):>4.2f}  {r['rtf']:>4.2f}  {r['df']:>4.2f}"
        )

    # ── Value bets ───────────────────────────────────────────────────────────
    if has_odds:
        value = [r for r in runners if r["is_value"]]
        print()
        if value:
            print(f"  {'VALUE BETS':}")
            print(f"  {'Horse':<22} {'Win%':>5} {'Mkt%':>5} {'Edge':>6} {'Odds':>6}")
            print("  " + "-" * 50)
            for r in sorted(value, key=lambda x: x["edge"], reverse=True):
                print(f"  {r['horse_name']:<22} "
                      f"{r['win_pct']:>4.1f}% "
                      f"{r['market_pct']:>4.1f}% "
                      f"{r['edge']:>+5.1f}% "
                      f"{r.get('public_odds') or 0:>6.1f}")
        else:
            print("  No value bets meet criteria (edge >5%, model >10%).")
    else:
        print("\n  [Odds not entered — value bets disabled]")

    print("\n" + "=" * W)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) > 1:
        html_path = sys.argv[1]
    else:
        html_path = input("Drag saved HTML file here and press Enter: ").strip()

    html_path = html_path.strip().strip("'\"")
    if not Path(html_path).exists():
        print(f"ERROR: File not found: {html_path}")
        sys.exit(1)

    print(f"\nReading: {html_path}")
    parsed_races = parse_saved_racecard(html_path)
    if not parsed_races:
        print("No races parsed.")
        sys.exit(1)

    pr = parsed_races[0]
    print(f"Parsed Race {pr['race_number']}  |  {pr['distance_m']}m  |  "
          f"{pr['course_config']}  |  {pr.get('race_class') or '?'}  |  "
          f"{len(pr['entries'])} runners")

    iso_date = input("Race date (YYYY-MM-DD): ").strip()

    conn = sqlite3.connect(DB_PATH)
    inserted = insert_race_day(conn, iso_date, parsed_races)

    print("\nBuilding model factors …")
    stats = mc.build_stats(conn)   # no cutoff → all historical data

    # Score and display
    for race_id, pr in inserted:
        entries = load_entries_for_race(conn, race_id)
        runners = mc.score_race(
            entries, stats,
            pr["distance_m"], pr["course_config"],
            race_class=pr.get("race_class"), going=pr.get("going")
        )

        has_odds = any(r.get("public_odds") for r in entries)
        print_output(pr, runners, has_odds)

        # ── Odds entry ──────────────────────────────────────────────────────
        ans = input("\nEnter tote WIN odds now? (y/n): ").strip().lower()
        if ans == "y":
            entered = prompt_and_apply_odds(conn, race_id, runners)
            if entered:
                # Reload entries with new odds and re-score
                entries  = load_entries_for_race(conn, race_id)
                runners  = mc.score_race(
                    entries, stats,
                    pr["distance_m"], pr["course_config"],
                    race_class=pr.get("race_class"), going=pr.get("going")
                )
                print("\nUpdated output with odds:")
                print_output(pr, runners, has_odds=True)

                # ── Paper trade logging ─────────────────────────────────────
                n_logged = log_paper_trades(conn, race_id, iso_date, runners)
                if n_logged:
                    print(f"\n  ✓ {n_logged} value bet(s) logged to paper_trades.")
                else:
                    print("\n  No value bets to log.")

        # ── Post-race result entry ──────────────────────────────────────────
        ans2 = input("\nEnter race results now? (y/n): ").strip().lower()
        if ans2 == "y":
            enter_results(conn, race_id, runners)

    conn.close()


if __name__ == "__main__":
    main()
