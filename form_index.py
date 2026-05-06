import sqlite3
import sys
from pathlib import Path
from datetime import datetime, timedelta

DB_PATH = Path("happy_valley.db")

def get_form(entity_type='jockey', days=30, min_rides=3):
    conn = sqlite3.connect(DB_PATH)
    
    max_date = conn.execute("SELECT MAX(race_date) FROM races").fetchone()[0]
    if not max_date:
        print("No races in database.")
        return
    
    cutoff = datetime.strptime(max_date, "%Y-%m-%d") - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    
    id_col = f"{entity_type}_id"
    name_col = f"{entity_type}_name"
    table = f"{entity_type}s"
    
    sql = f"""
    SELECT 
        t.{name_col},
        COUNT(*) as rides,
        SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) as places,
        ROUND(AVG(e.public_odds), 2) as avg_odds,
        ROUND(AVG(1.0 / NULLIF(e.public_odds, 0)), 4) as avg_impl_prob,
        ROUND(SUM(CASE WHEN e.finish_position = 1 THEN e.public_odds - 1.0 ELSE -1.0 END), 2) as profit,
        MAX(r.race_date) as last_ride
    FROM race_entries e
    JOIN races r ON e.race_id = r.race_id
    JOIN {table} t ON e.{id_col} = t.{id_col}
    WHERE r.race_date >= ?
    GROUP BY e.{id_col}, t.{name_col}
    HAVING rides >= ?
    ORDER BY (wins * 1.0 / rides) DESC, rides DESC
    """
    
    rows = conn.execute(sql, (cutoff_str, min_rides)).fetchall()
    
    if not rows:
        print(f"\nNo {entity_type} data in last {days} days from {max_date}.")
        conn.close()
        return
    
    print(f"\n{'='*80}")
    print(f"  {entity_type.upper()} FORM INDEX")
    print(f"  Window: {cutoff_str}  →  {max_date}  |  Min {min_rides} rides")
    print(f"{'='*80}")
    
    header = f"{'Name':<20} {'Rides':>5} {'Wins':>5} {'Win%':>6} {'Place%':>7} {'AvgOdd':>7} {'ExpWin%':>7} {'Edge':>6} {'ROI':>7}"
    print(header)
    print("-" * len(header))
    
    for name, rides, wins, places, avg_odds, avg_impl, profit, last in rows:
        win_pct = wins / rides
        place_pct = places / rides
        exp_win = (avg_impl * 100) if avg_impl else 0.0
        edge = (win_pct - avg_impl) * 100 if avg_impl else 0.0
        roi = (profit / rides) * 100 if rides else 0.0
        display_name = (name[:17] + '..') if len(name) > 19 else name
        
        print(f"{display_name:<20} {rides:>5} {wins:>5} {win_pct:>6.1%} {place_pct:>7.1%} {avg_odds:>7.1f} {exp_win:>7.1f} {edge:>+6.1f} {roi:>+7.1f}%")
    
    print("-" * len(header))
    print("ExpWin% = Market expectation from average odds (1/odds).")
    print("Edge    = Actual Win% minus ExpWin%. Positive = market underrates them.")
    print("ROI     = Profit on $1 win bets across every ride/runner.")
    print(f"{'='*80}\n")
    conn.close()


def get_combo_form(days=30, min_teams=2):
    conn = sqlite3.connect(DB_PATH)
    
    max_date = conn.execute("SELECT MAX(race_date) FROM races").fetchone()[0]
    if not max_date:
        return
    
    cutoff = datetime.strptime(max_date, "%Y-%m-%d") - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    
    sql = """
    SELECT 
        j.jockey_name,
        t.trainer_name,
        COUNT(*) as teams,
        SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) as places,
        ROUND(AVG(e.public_odds), 2) as avg_odds,
        ROUND(SUM(CASE WHEN e.finish_position = 1 THEN e.public_odds - 1.0 ELSE -1.0 END), 2) as profit
    FROM race_entries e
    JOIN races r ON e.race_id = r.race_id
    JOIN jockeys j ON e.jockey_id = j.jockey_id
    JOIN trainers t ON e.trainer_id = t.trainer_id
    WHERE r.race_date >= ?
    GROUP BY j.jockey_id, t.trainer_id, j.jockey_name, t.trainer_name
    HAVING teams >= ?
    ORDER BY (wins * 1.0 / teams) DESC, teams DESC
    """
    
    rows = conn.execute(sql, (cutoff_str, min_teams)).fetchall()
    
    if not rows:
        print("\nNo combo data found.")
        conn.close()
        return
    
    print(f"\n{'='*85}")
    print(f"  JOCKEY x TRAINER COMBO INDEX")
    print(f"  Window: {cutoff_str}  →  {max_date}  |  Min {min_teams} teams")
    print(f"{'='*85}")
    
    header = f"{'Jockey':<18} {'Trainer':<18} {'Teams':>5} {'Wins':>5} {'Win%':>6} {'Place%':>7} {'AvgOdd':>7} {'ROI':>7}"
    print(header)
    print("-" * len(header))
    
    for jname, tname, teams, wins, places, avg_odds, profit in rows:
        win_pct = wins / teams
        place_pct = places / teams
        roi = (profit / teams) * 100 if teams else 0.0
        
        print(f"{jname:<18} {tname:<18} {teams:>5} {wins:>5} {win_pct:>6.1%} {place_pct:>7.1%} {avg_odds:>7.1f} {roi:>+7.1f}%")
    
    print("-" * len(header))
    print(f"{'='*85}\n")
    conn.close()


if __name__ == "__main__":
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    min_rides = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    
    get_form('jockey', days, min_rides)
    get_form('trainer', days, min_rides)
    get_combo_form(days, max(min_rides, 2))