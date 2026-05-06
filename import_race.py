import requests
import sqlite3
import re
import sys
from bs4 import BeautifulSoup
from pathlib import Path

DB_PATH = Path("happy_valley.db")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

def parse_margin(lbw_text):
    if lbw_text is None or lbw_text.strip() in ['-', '']:
        return None
    text = lbw_text.strip()
    if '-' in text:
        whole, frac = text.split('-', 1)
        if '/' in frac:
            num, den = frac.split('/')
            return float(whole) + float(num) / float(den)
        else:
            try:
                return float(whole) + float(frac)
            except ValueError:
                return None
    elif '/' in text:
        num, den = text.split('/')
        return float(num) / float(den)
    else:
        try:
            return float(text)
        except ValueError:
            return None

def fetch_and_import(race_date_str, race_no):
    y, m, d = race_date_str.split("-")
    hkjc_date = f"{d}/{m}/{y}"
    
    url = (f"https://racing.hkjc.com/racing/information/English/Racing/"
           f"LocalResults.aspx?RaceDate={hkjc_date}&Racecourse=HV&RaceNo={race_no}")
    print(f"\n=== Fetching Race {race_no} on {race_date_str} ===")
    
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    
    # Path(f"raw_race_{race_no}.html").write_text(r.text, encoding='utf-8')
    
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # --- Metadata extraction (robust td-by-td) ---
    race_tab = soup.find('div', class_='race_tab')
    course_config = None
    distance_m = None
    race_class = None
    going = None
    prize_money = None
    
    if race_tab:
        for td in race_tab.find_all('td'):
            txt = td.get_text(strip=True)
            
            if re.match(r'Going\s*:', txt):
                nxt = td.find_next_sibling('td')
                if nxt:
                    going = nxt.get_text(strip=True)
            
            elif re.match(r'Course\s*:', txt):
                nxt = td.find_next_sibling('td')
                if nxt:
                    m = re.search(r'"([A-Z])"', nxt.get_text(strip=True))
                    if m:
                        course_config = m.group(1)
            
            elif txt.startswith('HK$'):
                try:
                    prize_money = int(txt.replace('HK$', '').replace(',', '').strip())
                except ValueError:
                    pass
            
            elif 'Class' in txt and 'M' in txt:
                m_c = re.search(r'Class\s+(\d+)', txt)
                m_d = re.search(r'(\d+)M', txt)
                if m_c:
                    race_class = f"Class {m_c.group(1)}"
                if m_d:
                    distance_m = int(m_d.group(1))
    
    print(f"  Course : {course_config}")
    print(f"  Dist   : {distance_m}m")
    print(f"  Class  : {race_class}")
    print(f"  Going  : {going if going else '(not found)'}")
    
    # --- Results table ---
    perf = soup.find('div', class_='performance')
    table = perf.find('table') if perf else None
    tbody = table.find('tbody', class_='f_fs12') if table else None
    if not tbody:
        print("ERROR: Could not find results table.")
        return
    
    rows = tbody.find_all('tr')
    
    entries = []
    for tr in rows:
        tds = tr.find_all('td')
        if len(tds) < 12:
            continue
        
        first_text = tds[0].get_text(strip=True)
        if not first_text.isdigit():
            # Skip note rows like WV-A, WV, etc.
            continue
        
        finish_pos = int(first_text)
        
        horse_a = tds[2].find('a')
        horse_name = horse_a.get_text(strip=True) if horse_a else tds[2].get_text(strip=True)
        horse_name = re.sub(r'\s*\([A-Z0-9]+\)\s*$', '', horse_name)
        
        jockey_a = tds[3].find('a')
        jockey_name = jockey_a.get_text(strip=True) if jockey_a else tds[3].get_text(strip=True)
        
        trainer_a = tds[4].find('a')
        trainer_name = trainer_a.get_text(strip=True) if trainer_a else tds[4].get_text(strip=True)
        
        weight = float(tds[5].get_text(strip=True))
        barrier = int(tds[7].get_text(strip=True))
        margin = parse_margin(tds[8].get_text(strip=True))
        win_odds = float(tds[11].get_text(strip=True))
        
        if finish_pos == 1 and margin is None:
            margin = 0.0
        
        entries.append({
            'pos': finish_pos, 'name': horse_name, 'jockey': jockey_name,
            'trainer': trainer_name, 'wt': weight, 'draw': barrier,
            'margin': margin, 'odds': win_odds,
        })
        print(f"    {finish_pos:>2}. {horse_name:<18} | Draw {barrier:>2} | Odds {win_odds}")
    
    if not entries:
        print("WARNING: No valid horses found.")
        return
    
    field_size = len(entries)
    print(f"  Runners: {field_size}")
    
    # --- Write to database ---
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("""
        INSERT OR IGNORE INTO races 
        (race_date, venue, race_number, course_config, distance_m, track_surface, going, race_class, prize_money_hkd, field_size)
        VALUES (?, 'HV', ?, ?, ?, 'Turf', ?, ?, ?, ?)
    """, (race_date_str, race_no, course_config, distance_m, going, race_class, prize_money, field_size))
    
    cur.execute("SELECT race_id FROM races WHERE race_date=? AND race_number=? AND venue='HV'",
                (race_date_str, race_no))
    race_id = cur.fetchone()[0]
    
    for e in entries:
        cur.execute("INSERT OR IGNORE INTO horses (horse_name) VALUES (?)", (e['name'],))
        cur.execute("SELECT horse_id FROM horses WHERE horse_name=?", (e['name'],))
        horse_id = cur.fetchone()[0]
        
        cur.execute("INSERT OR IGNORE INTO jockeys (jockey_name) VALUES (?)", (e['jockey'],))
        cur.execute("SELECT jockey_id FROM jockeys WHERE jockey_name=?", (e['jockey'],))
        jockey_id = cur.fetchone()[0]
        
        cur.execute("INSERT OR IGNORE INTO trainers (trainer_name) VALUES (?)", (e['trainer'],))
        cur.execute("SELECT trainer_id FROM trainers WHERE trainer_name=?", (e['trainer'],))
        trainer_id = cur.fetchone()[0]
        
        cur.execute("""
            INSERT OR IGNORE INTO race_entries 
            (race_id, horse_id, trainer_id, jockey_id, barrier, weight, public_odds, finish_position, finish_margin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (race_id, horse_id, trainer_id, jockey_id,
              e['draw'], e['wt'], e['odds'], e['pos'], e['margin']))
    
    conn.commit()
    conn.close()
    print(f"  SUCCESS: Race {race_no} saved.\n")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 import_race.py YYYY-MM-DD race_number")
        sys.exit(1)
    fetch_and_import(sys.argv[1], int(sys.argv[2]))
