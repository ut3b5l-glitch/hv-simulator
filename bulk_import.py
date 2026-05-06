import subprocess
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path("happy_valley.db")

def generate_wednesdays(start_str, end_str):
    start = datetime.strptime(start_str, "%Y-%m-%d")
    end = datetime.strptime(end_str, "%Y-%m-%d")
    days_ahead = (2 - start.weekday()) % 7
    start += timedelta(days=days_ahead)
    
    dates = []
    while start <= end:
        dates.append(start.strftime("%Y-%m-%d"))
        start += timedelta(days=7)
    return dates

def date_already_done(conn, date_str):
    cur = conn.execute("SELECT 1 FROM races WHERE race_date = ? LIMIT 1", (date_str,))
    return cur.fetchone() is not None

def main():
    conn = sqlite3.connect(DB_PATH)
    
    # ─── CONFIG ───
    # Start conservative with ~2 years. If it runs clean, you can push
    # start_date back to "2021-09-01" later and re-run.
    start_date = "2024-01-01"
    end_date   = "2026-04-22"
    delay_sec  = 3
    # ──────────────
    
    all_dates = generate_wednesdays(start_date, end_date)
    total = len(all_dates)
    print(f"Queue: {total} Wednesdays from {start_date} to {end_date}")
    print("Already-imported dates will be skipped automatically.\n")
    
    for idx, date_str in enumerate(all_dates, 1):
        if date_already_done(conn, date_str):
            print(f"[{idx:>3}/{total}] {date_str}  ✓ skip (already in DB)")
            continue
        
        print(f"\n{'#'*50}")
        print(f"### [{idx:>3}/{total}] {date_str}")
        print(f"{'#'*50}")
        
        for race_no in range(1, 10):
            cmd = ["python3", "import_race.py", date_str, str(race_no)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            print(result.stdout, end='')
            if result.stderr:
                print("STDERR:", result.stderr)
            time.sleep(delay_sec)
        
        if idx % 10 == 0:
            n = conn.execute("SELECT COUNT(*) FROM races").fetchone()[0]
            print(f"\n--- Checkpoint: {n} races in DB ---\n")
    
    conn.close()
    print("\n=== DONE ===")

if __name__ == "__main__":
    main()
