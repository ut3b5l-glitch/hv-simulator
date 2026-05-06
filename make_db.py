import sqlite3
import os

SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS races (
    race_id INTEGER PRIMARY KEY AUTOINCREMENT,
    race_date TEXT NOT NULL,
    venue TEXT NOT NULL DEFAULT 'HV',
    race_number INTEGER NOT NULL,
    course_config TEXT NOT NULL,
    distance_m INTEGER NOT NULL,
    track_surface TEXT NOT NULL,
    going TEXT,
    race_class TEXT,
    prize_money_hkd INTEGER,
    field_size INTEGER,
    UNIQUE(race_date, race_number, venue)
);

CREATE TABLE IF NOT EXISTS horses (
    horse_id INTEGER PRIMARY KEY AUTOINCREMENT,
    horse_name TEXT NOT NULL UNIQUE,
    sex TEXT,
    origin TEXT,
    age INTEGER,
    import_type TEXT
);

CREATE TABLE IF NOT EXISTS trainers (
    trainer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_name TEXT NOT NULL UNIQUE,
    trainer_code TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS jockeys (
    jockey_id INTEGER PRIMARY KEY AUTOINCREMENT,
    jockey_name TEXT NOT NULL UNIQUE,
    jockey_code TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS race_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id INTEGER NOT NULL,
    horse_id INTEGER NOT NULL,
    trainer_id INTEGER,
    jockey_id INTEGER,
    barrier INTEGER,
    weight REAL,
    gear TEXT,
    public_odds REAL,
    finish_position INTEGER,
    finish_margin REAL,
    is_placed INTEGER GENERATED ALWAYS AS (
        CASE WHEN finish_position IS NOT NULL AND finish_position <= 3 THEN 1 ELSE 0 END
    ) STORED,
    final_sectional_400m REAL,
    FOREIGN KEY (race_id) REFERENCES races(race_id),
    FOREIGN KEY (horse_id) REFERENCES horses(horse_id),
    FOREIGN KEY (trainer_id) REFERENCES trainers(trainer_id),
    FOREIGN KEY (jockey_id) REFERENCES jockeys(jockey_id),
    UNIQUE(race_id, horse_id)
);

CREATE TABLE IF NOT EXISTS horse_form (
    form_id INTEGER PRIMARY KEY AUTOINCREMENT,
    horse_id INTEGER NOT NULL,
    linked_race_id INTEGER,
    form_order INTEGER NOT NULL,
    form_date TEXT,
    venue TEXT,
    course_config TEXT,
    distance_m INTEGER,
    going TEXT,
    race_class TEXT,
    barrier INTEGER,
    weight REAL,
    jockey_name TEXT,
    trainer_name TEXT,
    finish_position INTEGER,
    finish_margin REAL,
    is_placed INTEGER,
    FOREIGN KEY (horse_id) REFERENCES horses(horse_id),
    FOREIGN KEY (linked_race_id) REFERENCES races(race_id),
    UNIQUE(horse_id, form_order)
);

CREATE INDEX IF NOT EXISTS idx_races_date ON races(race_date);
CREATE INDEX IF NOT EXISTS idx_races_config_dist ON races(course_config, distance_m);
CREATE INDEX IF NOT EXISTS idx_entries_race ON race_entries(race_id);
CREATE INDEX IF NOT EXISTS idx_entries_horse ON race_entries(horse_id);
CREATE INDEX IF NOT EXISTS idx_form_horse ON horse_form(horse_id, form_order);
"""

if os.path.exists("happy_valley.db"):
    print("Database already exists.")
else:
    conn = sqlite3.connect("happy_valley.db")
    conn.executescript(SQL)
    conn.close()
    print("SUCCESS: happy_valley.db created in your folder.")