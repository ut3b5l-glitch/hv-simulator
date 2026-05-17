"""One-time backfill: populate horse_no for existing race_entries rows.

Strategy:
  1. For dates with saved HTML racecards — extract exact horse numbers.
  2. For all other dates — assign horse numbers by weight descending
     (HKJC convention: heaviest horse = #1). Ties broken by barrier.
"""
import sqlite3, os, sys
from pathlib import Path

DB = Path(__file__).parent / "happy_valley.db"

def backfill_from_weight(conn):
    """Assign horse_no by weight-descending rank within each race."""
    races = conn.execute(
        "SELECT race_id FROM races ORDER BY race_date, race_number"
    ).fetchall()

    updated = 0
    for (race_id,) in races:
        entries = conn.execute("""
            SELECT entry_id, weight, barrier
            FROM race_entries
            WHERE race_id = ? AND horse_no IS NULL
            ORDER BY weight DESC, barrier ASC
        """, (race_id,)).fetchall()
        if not entries:
            continue
        for rank, (eid, _w, _b) in enumerate(entries, 1):
            conn.execute(
                "UPDATE race_entries SET horse_no = ? WHERE entry_id = ?",
                (rank, eid),
            )
            updated += 1
    conn.commit()
    return updated


def backfill_from_html(conn, html_path, race_date):
    """Parse a saved HKJC racecard HTML and update horse_no for that date."""
    try:
        from phase6_importer import parse_saved_racecard
    except ImportError:
        print(f"  [skip] Cannot import phase6_importer")
        return 0

    parsed = parse_saved_racecard(html_path)
    updated = 0
    for pr in parsed:
        race_no = pr["race_number"]
        row = conn.execute(
            "SELECT race_id FROM races WHERE race_date = ? AND race_number = ?",
            (race_date, race_no),
        ).fetchone()
        if not row:
            continue
        race_id = row[0]
        for e in pr["entries"]:
            hno = e.get("horse_no")
            if hno is None:
                continue
            conn.execute("""
                UPDATE race_entries SET horse_no = ?
                WHERE race_id = ? AND horse_id = (
                    SELECT horse_id FROM horses WHERE horse_name = ?
                )
            """, (hno, race_id, e["horse_name"]))
            updated += 1
    conn.commit()
    return updated


if __name__ == "__main__":
    if not DB.exists():
        print("Database not found.")
        sys.exit(1)

    conn = sqlite3.connect(str(DB))
    total_before = conn.execute(
        "SELECT COUNT(*) FROM race_entries WHERE horse_no IS NOT NULL"
    ).fetchone()[0]

    # Phase 1: exact backfill from saved HTML racecards
    html_map = {
        "Race Card_Apr 29 2026.html": "2026-04-29",
        "Apr 29 Race Card HKJC.html": "2026-04-29",
    }
    for fname, rdate in html_map.items():
        fpath = DB.parent / fname
        if fpath.exists():
            n = backfill_from_html(conn, str(fpath), rdate)
            if n:
                print(f"  HTML backfill ({rdate}): {n} entries updated")

    # Phase 2: weight-based backfill for remaining NULL rows
    n = backfill_from_weight(conn)
    print(f"  Weight-based backfill: {n} entries updated")

    total_after = conn.execute(
        "SELECT COUNT(*) FROM race_entries WHERE horse_no IS NOT NULL"
    ).fetchone()[0]
    print(f"\n  Done. {total_before} -> {total_after} entries with horse_no.")
    conn.close()
