import sqlite3
import sys
from pathlib import Path

DB_PATH = Path("happy_valley.db")

def find_horse(conn, name_query):
    cur = conn.execute(
        "SELECT horse_id, horse_name FROM horses WHERE horse_name LIKE ?",
        (f"%{name_query}%",)
    )
    rows = cur.fetchall()
    if not rows:
        return None
    if len(rows) > 1:
        print(f"Found {len(rows)} matches: {', '.join(r[1] for r in rows)}")
        print("Please use the exact name in quotes.")
        return None
    return rows[0]

def get_record(conn, horse_id, venue=None, distance_m=None, course_config=None):
    sql = """
    SELECT 
        COUNT(*) as runs,
        SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) as places,
        ROUND(AVG(e.finish_position), 2) as avg_pos,
        ROUND(AVG(COALESCE(e.finish_margin, 0)), 2) as avg_beaten,
        ROUND(AVG(e.public_odds), 2) as avg_odds
    FROM race_entries e
    JOIN races r ON e.race_id = r.race_id
    WHERE e.horse_id = ?
    """
    params = [horse_id]

    if venue:
        sql += " AND r.venue = ?"
        params.append(venue)
    if distance_m:
        sql += " AND r.distance_m = ?"
        params.append(distance_m)
    if course_config:
        sql += " AND r.course_config = ?"
        params.append(course_config)

    row = conn.execute(sql, params).fetchone()
    return row if row and row[0] else None

def get_form_line(conn, horse_id, limit=6):
    sql = """
    SELECT 
        r.race_date,
        r.venue,
        r.race_number,
        r.distance_m,
        r.course_config,
        e.barrier,
        e.finish_position,
        e.finish_margin,
        e.public_odds,
        j.jockey_name
    FROM race_entries e
    JOIN races r ON e.race_id = r.race_id
    JOIN jockeys j ON e.jockey_id = j.jockey_id
    WHERE e.horse_id = ?
    ORDER BY r.race_date DESC, r.race_number DESC
    LIMIT ?
    """
    return conn.execute(sql, (horse_id, limit)).fetchall()

def print_profile(horse_name):
    conn = sqlite3.connect(DB_PATH)
    horse = find_horse(conn, horse_name)

    if not horse:
        print(f"\nHorse '{horse_name}' not found in database.")
        print("(If the backfill is still running, try again tomorrow.)\n")
        conn.close()
        return

    horse_id, exact_name = horse
    print(f"\n{'='*70}")
    print(f"  HORSE PROFILE: {exact_name}")
    print(f"{'='*70}")

    # Lifetime
    rec = get_record(conn, horse_id)
    print(f"\n  CAREER OVERALL")
    print(f"  Runs: {rec[0]} | Wins: {rec[1]} | Places: {rec[2]} | Avg Pos: {rec[3]} | Avg Odds: {rec[5]}")

    # Happy Valley overall
    hv = get_record(conn, horse_id, venue='HV')
    if hv and hv[0] > 0:
        print(f"\n  HAPPY VALLEY OVERALL")
        win_pct = hv[1] / hv[0] * 100
        print(f"  Runs: {hv[0]} | Wins: {hv[1]} ({win_pct:.0f}%) | Places: {hv[2]} | Avg Pos: {hv[3]} | Avg Beat: {hv[4]}L")

    # Specific splits
    splits = conn.execute("""
        SELECT r.distance_m, r.course_config, COUNT(*) as runs
        FROM race_entries e
        JOIN races r ON e.race_id = r.race_id
        WHERE e.horse_id = ? AND r.venue = 'HV'
        GROUP BY r.distance_m, r.course_config
        HAVING runs >= 1
        ORDER BY runs DESC
    """, (horse_id,)).fetchall()

    if splits:
        print(f"\n  COURSE-DISTANCE SUITABILITY (Happy Valley)")
        print(f"  {'Distance':>8} {'Course':>6} {'Runs':>5} {'Wins':>5} {'Win%':>6} {'Place%':>7} {'AvgPos':>7} {'AvgBeat':>8}")
        print("  " + "-"*58)
        for dist, course, _ in splits:
            s = get_record(conn, horse_id, venue='HV', distance_m=dist, course_config=course)
            if not s:
                continue
            wp = s[1] / s[0] * 100
            pp = s[2] / s[0] * 100
            print(f"  {dist:>8}m {course:>6} {s[0]:>5} {s[1]:>5} {wp:>6.0f}% {pp:>7.0f}% {s[3]:>7.2f} {s[4]:>8.2f}L")

    # Recent form
    recent = get_form_line(conn, horse_id, 6)
    if recent:
        print(f"\n  LAST {len(recent)} STARTS  (most recent first)")
        print(f"  {'Date':<12} {'Ven':>3} {'R':>2} {'Dist':>5} {'Crs':>3} {'Bar':>3} {'Pos':>3} {'Marg':>5} {'Odds':>5} {'Jockey':<15}")
        print("  " + "-"*68)
        for row in recent:
            date, ven, rn, dist, crs, bar, pos, marg, odds, jock = row
            marg_str = f"{marg}L" if marg is not None else "-"
            print(f"  {date:<12} {ven:>3} {rn:>2} {dist:>5}m {crs:>3} {bar:>3} {pos:>3} {marg_str:>5} {odds:>5} {jock:<15}")

    print(f"\n{'='*70}\n")
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 horse_profile.py 'HORSE NAME'")
        print("Example: python3 horse_profile.py NEBRASKAN")
        sys.exit(1)
    print_profile(sys.argv[1])