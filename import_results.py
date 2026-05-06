import requests
import pandas as pd
import sys
from pathlib import Path

RESULTS_URL = "https://racing.hkjc.com/racing/information/English/Racing/LocalResults.aspx"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

def fetch(date_str):
    try:
        # Convert YYYY-MM-DD to HKJC format DD/MM/YYYY
        parts = date_str.split("-")
        hkjc_date = f"{parts[2]}/{parts[1]}/{parts[0]}"

        url = f"{RESULTS_URL}?RaceDate={hkjc_date}"
        print(f"Fetching: {url}")

        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()

        tables = pd.read_html(r.text)
        print(f"\nFound {len(tables)} total tables on page.\n")

        for i, tbl in enumerate(tables):
            # Only show tables that look like race result tables
            cols = [str(c).lower() for c in tbl.columns]
            shape = f"{tbl.shape[0]} rows x {tbl.shape[1]} cols"

            print(f"--- Table {i}: {shape} ---")
            print("First few columns:", list(tbl.columns)[:5])
            print(tbl.head(2))
            print("-" * 40)

    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 import_results.py YYYY-MM-DD")
        print("Example: python3 import_results.py 2025-04-23")
        sys.exit(1)

    fetch(sys.argv[1])