import sqlite3
import sys
from pathlib import Path

DB_PATH = Path("happy_valley.db")

def analyze(distance_m, course_config):
    conn = sqlite3.connect(DB_PATH)
    
    sql = """
    SELECT 
        e.barrier,
        COUNT(*) as runners,
        SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) as places,
        ROUND(AVG(e.public_odds), 2) as avg_odds,
        ROUND(SUM(CASE WHEN e.finish_position = 1 THEN 1.0 + COALESCE(e.public_odds, 0) ELSE 0 END), 2) as total_return
    FROM race_entries e
    JOIN races r ON e.race_id = r.race_id
    WHERE r.venue = 'HV' 
      AND r.distance_m = ? 
      AND r.course_config = ?
    GROUP BY e.barrier
    ORDER BY e.barrier
    """
    
    rows = conn.execute(sql, (distance_m, course_config)).fetchall()
    
    if not rows:
        print(f"\nNo data for HV {distance_m}m | Course {course_config}")
        print("Check what you have with: SELECT DISTINCT distance_m, course_config FROM races")
        conn.close()
        return
    
    total_runners = sum(r[1] for r in rows)
    total_wins = sum(r[2] for r in rows)
    overall_win_rate = total_wins / total_runners if total_runners else 0
    
    print(f"\n{'='*60}")
    print(f"  BARRIER BIAS REPORT")
    print(f"  Track : Happy Valley | {distance_m}m | Course {course_config}")
    print(f"  Sample: {total_runners} runners, {total_wins} winners")
    print(f"  Base  : {overall_win_rate:.1%} win rate (all barriers)")
    print(f"{'='*60}")
    
    if total_runners < 50:
        print("  ⚠️  WARNING: Small sample. Backfill more meetings for sharp edges.\n")
    
    header = f"{'Barrier':>7} {'Run':>5} {'Wins':>5} {'Win%':>6} {'Place%':>7} {'AvgOdd':>7} {'IV':>5} {'ROI':>6}"
    print(header)
    print("-" * len(header))
    
    for barrier, runners, wins, places, avg_odds, total_return in rows:
        win_pct = wins / runners
        place_pct = places / runners
        iv = (win_pct / overall_win_rate) if overall_win_rate > 0 else 1.0
        roi_pct = ((total_return / runners) - 1.0) * 100 if runners else 0
        
        print(f"{barrier:>7} {runners:>5} {wins:>5} {win_pct:>6.1%} {place_pct:>7.1%} {avg_odds:>7.1f} {iv:>5.2f} {roi_pct:>+5.1f}%")
    
    print("-" * len(header))
    print("IV = Impact Value. >1.00 means barrier wins more than fair share.")
    print("ROI = Profit on turnover if you bet $1 win on EVERY horse from that barrier.")
    print(f"{'='*60}\n")
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 barrier_bias.py distance_m course_config")
        print("Example: python3 barrier_bias.py 1200 B")
        sys.exit(1)
    
    analyze(int(sys.argv[1]), sys.argv[2])