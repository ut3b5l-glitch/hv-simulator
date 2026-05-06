#!/usr/bin/env python3
"""
backtest.py
Walk-forward backtest for the Happy Valley Racing Simulator.

Compares:
  EXACT  -> Old exact-trip horse factor (wins / runs) / base_rate, neutral if no runs.
  SMOOTH -> Bayesian-smoothed horse factor (m=5 prior), floor 0.50, neutral if no runs.

All other factors (Barrier IV, Jockey, Trainer) are held constant.
"""

import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

# -----------------------------------------------------------------------------
# USER CONFIGURATION
# -----------------------------------------------------------------------------
DB_PATH = Path.home() / "AI Playground" / "HV_Simulator" / "happy_valley.db"

N_RACES = 200               # report on the most recent N races
BURN_IN_RACES = 100         # leading races to accumulate before measuring
MIN_JOCKEY_RIDES = 5
MIN_TRAINER_RUNS = 5
PRIOR_RUNS = 5              # Bayesian prior "m"
FACTOR_FLOOR = 0.20         # Barrier / Jockey / Trainer floor
OLD_HORSE_FLOOR = 0.20      # Exact-match horse floor (configurable; old model was harsher)
NEW_HORSE_FLOOR = 0.50      # Smoothed horse floor
VALUE_EDGE = 0.03           # Model% - Market% must exceed this
VALUE_MIN_PROB = 0.08       # Model% must exceed this
PLACE_CUTOFF = 3            # finish_position <= this counts as 'placed'
DEFAULT_BASE_RATE = 0.10    # used only until empirical base rate stabilises

# Restrict to specific venue(s) if your DB contains multiple tracks.
# Examples: ["Happy Valley"], ["HV"], ["Happy Valley", "HV"]
VENUE_WHITELIST = None
# -----------------------------------------------------------------------------

def get_connection():
    if not DB_PATH.exists():
        print(f"[ERROR] Database not found: {DB_PATH}")
        sys.exit(1)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def fetch_races(conn):
    sql = """
        SELECT r.race_id, r.race_date, r.venue, r.race_number,
               r.distance_m, r.course_config
        FROM races r
        WHERE EXISTS (
            SELECT 1 FROM race_entries re
            WHERE re.race_id = r.race_id
              AND re.finish_position IS NOT NULL
              AND re.public_odds IS NOT NULL
              AND re.public_odds > 0
              AND re.barrier IS NOT NULL
        )
    """
    params = []
    if VENUE_WHITELIST:
        placeholders = ",".join("?" for _ in VENUE_WHITELIST)
        sql += f" AND r.venue IN ({placeholders})"
        params.extend(VENUE_WHITELIST)
    sql += " ORDER BY r.race_date ASC, r.race_number ASC"
    cur = conn.execute(sql, params)
    return cur.fetchall()


def fetch_entries(conn, race_id):
    cur = conn.execute("""
        SELECT horse_id, barrier, jockey_id, trainer_id,
               public_odds, finish_position
        FROM race_entries
        WHERE race_id = ?
          AND finish_position IS NOT NULL
          AND public_odds IS NOT NULL
          AND public_odds > 0
          AND barrier IS NOT NULL
        ORDER BY horse_id
    """, (race_id,))
    rows = []
    for r in cur.fetchall():
        rows.append({
            "horse_id": r["horse_id"],
            "barrier": r["barrier"],
            "jockey_id": r["jockey_id"] if r["jockey_id"] is not None else -1,
            "trainer_id": r["trainer_id"] if r["trainer_id"] is not None else -1,
            "public_odds": float(r["public_odds"]),
            "finish_position": int(r["finish_position"]),
        })
    return rows


def update_stats(entries, venue, distance, course_config,
                 total_stats, trip_stats, barrier_stats,
                 jockey_stats, trainer_stats, horse_trip_stats):
    """Add the just-evaluated race into the cumulative caches."""
    for e in entries:
        # global
        total_stats["runs"] += 1
        if e["finish_position"] == 1:
            total_stats["wins"] += 1

        # trip (venue + distance + course_config)
        tk = (venue, distance, course_config)
        trip_stats[tk]["runs"] += 1
        if e["finish_position"] == 1:
            trip_stats[tk]["wins"] += 1

        # barrier
        bk = (venue, distance, course_config, e["barrier"])
        barrier_stats[bk]["runs"] += 1
        if e["finish_position"] == 1:
            barrier_stats[bk]["wins"] += 1

        # jockey
        jk = e["jockey_id"]
        jockey_stats[jk]["runs"] += 1
        if e["finish_position"] == 1:
            jockey_stats[jk]["wins"] += 1

        # trainer
        trk = e["trainer_id"]
        trainer_stats[trk]["runs"] += 1
        if e["finish_position"] == 1:
            trainer_stats[trk]["wins"] += 1

        # horse at exact trip
        hk = (e["horse_id"], venue, distance, course_config)
        horse_trip_stats[hk]["runs"] += 1
        if e["finish_position"] == 1:
            horse_trip_stats[hk]["wins"] += 1


def evaluate_race(entries, venue, distance, course_config,
                  global_base, model_type,
                  barrier_stats, jockey_stats, trainer_stats,
                  horse_trip_stats, trip_stats):
    """
    model_type: 'exact' or 'smoothed'
    Returns dict with runners (incl. model_prob), top_pick, value_bets.
    """
    trip_key = (venue, distance, course_config)
    trip_s = trip_stats[trip_key]
    trip_base = (trip_s["wins"] / trip_s["runs"]) if trip_s["runs"] > 0 else global_base

    if trip_base <= 0:
        trip_base = DEFAULT_BASE_RATE
    if global_base <= 0:
        global_base = DEFAULT_BASE_RATE

    runners = []
    for e in entries:
        # --- Barrier IV (trip-specific base) ---
        bk = (venue, distance, course_config, e["barrier"])
        bs = barrier_stats[bk]
        if bs["runs"] > 0:
            bar_rate = bs["wins"] / bs["runs"]
            barrier_iv = max(bar_rate / trip_base, FACTOR_FLOOR)
        else:
            barrier_iv = 1.0

        # --- Jockey Factor ---
        js = jockey_stats[e["jockey_id"]]
        if js["runs"] >= MIN_JOCKEY_RIDES:
            j_rate = js["wins"] / js["runs"]
            jockey_factor = max(j_rate / global_base, FACTOR_FLOOR)
        else:
            jockey_factor = 1.0

        # --- Trainer Factor ---
        ts = trainer_stats[e["trainer_id"]]
        if ts["runs"] >= MIN_TRAINER_RUNS:
            t_rate = ts["wins"] / ts["runs"]
            trainer_factor = max(t_rate / global_base, FACTOR_FLOOR)
        else:
            trainer_factor = 1.0

        # --- Horse Factor (exact trip) ---
        hk = (e["horse_id"], venue, distance, course_config)
        hs = horse_trip_stats[hk]
        if hs["runs"] > 0:
            if model_type == "exact":
                raw_rate = hs["wins"] / hs["runs"]
                horse_factor = raw_rate / global_base
                if horse_factor < OLD_HORSE_FLOOR:
                    horse_factor = OLD_HORSE_FLOOR
            else:  # smoothed
                smoothed_rate = (hs["wins"] + PRIOR_RUNS * global_base) / (hs["runs"] + PRIOR_RUNS)
                horse_factor = smoothed_rate / global_base
                if horse_factor < NEW_HORSE_FLOOR:
                    horse_factor = NEW_HORSE_FLOOR
        else:
            horse_factor = 1.0  # neutral for both models if no exact-trip history

        raw_score = barrier_iv * jockey_factor * trainer_factor * horse_factor
        market_prob = 1.0 / e["public_odds"]

        runners.append({
            **e,
            "barrier_iv": barrier_iv,
            "jockey_factor": jockey_factor,
            "trainer_factor": trainer_factor,
            "horse_factor": horse_factor,
            "raw_score": raw_score,
            "market_prob": market_prob,
        })

    total_raw = sum(r["raw_score"] for r in runners)
    for r in runners:
        r["model_prob"] = r["raw_score"] / total_raw if total_raw > 0 else 0.0

    # Top pick = highest model_prob
    top_pick = max(runners, key=lambda x: x["model_prob"])

    # Value bets
    value_bets = [
        r for r in runners
        if (r["model_prob"] - r["market_prob"] > VALUE_EDGE)
        and (r["model_prob"] > VALUE_MIN_PROB)
    ]

    return {
        "runners": runners,
        "top_pick": top_pick,
        "value_bets": value_bets,
    }


def aggregate_metrics(results, label):
    """
    results: list of (race_row, result_dict)
    """
    n_races = len(results)
    if n_races == 0:
        return {}

    tp_wins = 0
    tp_places = 0
    tp_stakes = 0
    tp_returns = 0.0

    val_stakes = 0
    val_returns = 0.0

    bucket_20 = []
    bucket_05 = []

    for _race, res in results:
        top = res["top_pick"]
        tp_stakes += 1
        if top["finish_position"] == 1:
            tp_wins += 1
            tp_returns += top["public_odds"]
        if top["finish_position"] <= PLACE_CUTOFF:
            tp_places += 1

        for vb in res["value_bets"]:
            val_stakes += 1
            if vb["finish_position"] == 1:
                val_returns += vb["public_odds"]

        for r in res["runners"]:
            mp = r["model_prob"]
            won = 1 if r["finish_position"] == 1 else 0
            if mp >= 0.20:
                bucket_20.append(won)
            elif mp <= 0.05:
                bucket_05.append(won)

    out = {
        "label": label,
        "n_races": n_races,
        "tp_win_rate": tp_wins / n_races,
        "tp_place_rate": tp_places / n_races,
        "tp_flat_roi": (tp_returns - tp_stakes) / tp_stakes if tp_stakes else 0.0,
        "value_roi": (val_returns - val_stakes) / val_stakes if val_stakes else 0.0,
        "bucket_20plus": (sum(bucket_20) / len(bucket_20)) if bucket_20 else 0.0,
        "bucket_0_5": (sum(bucket_05) / len(bucket_05)) if bucket_05 else 0.0,
        "n_bucket_20": len(bucket_20),
        "n_bucket_05": len(bucket_05),
        "n_value_bets": val_stakes,
    }
    return out


def print_report(old, new):
    print("\n" + "=" * 72)
    print(" HAPPY VALLEY SIMULATOR — BACKTEST REPORT")
    print(f" Test window : last {old['n_races']} races  (burn-in: {BURN_IN_RACES})")
    print("=" * 72)

    lines = [
        ("Metric", "Exact-Match (Old)", "Smoothed (Current)"),
        ("-" * 24, "-" * 18, "-" * 18),
        ("Top Pick Win Rate",  f"{old['tp_win_rate']:.1%}",  f"{new['tp_win_rate']:.1%}"),
        ("Top Pick Place Rate",f"{old['tp_place_rate']:.1%}", f"{new['tp_place_rate']:.1%}"),
        ("Top Pick Flat ROI",  f"{old['tp_flat_roi']:.1%}",   f"{new['tp_flat_roi']:.1%}"),
        ("Value Bet ROI",      f"{old['value_roi']:.1%}",     f"{new['value_roi']:.1%}"),
        ("20+% Bucket Actual", f"{old['bucket_20plus']:.1%}", f"{new['bucket_20plus']:.1%}"),
        ("0–5% Bucket Actual", f"{old['bucket_0_5']:.1%}",    f"{new['bucket_0_5']:.1%}"),
    ]

    for a, b, c in lines:
        print(f" {a:<23} {b:>18} {c:>18}")

    print("-" * 72)
    print(f" Value bets placed       : {old['n_value_bets']:>18} {new['n_value_bets']:>18}")
    print(f" Horses in 20+% bucket   : {old['n_bucket_20']:>18} {new['n_bucket_20']:>18}")
    print(f" Horses in 0–5% bucket   : {old['n_bucket_05']:>18} {new['n_bucket_05']:>18}")
    print("=" * 72)


def main():
    conn = get_connection()

    # quick health check
    hc = conn.execute("""
        SELECT 
            (SELECT COUNT(*) FROM races) AS rc,
            (SELECT COUNT(*) FROM race_entries) AS ec
    """).fetchone()
    print(f"[DB] Races: {hc['rc']:,} | Entries: {hc['ec']:,}")

    all_races = fetch_races(conn)
    print(f"[INFO] {len(all_races):,} eligible completed races loaded.")

    if len(all_races) < BURN_IN_RACES + N_RACES:
        print(f"[ERROR] Need >= {BURN_IN_RACES + N_RACES} races. Exiting.")
        return

    # Mutable stat caches
    total_stats = {"runs": 0, "wins": 0}
    trip_stats = defaultdict(lambda: {"runs": 0, "wins": 0})
    barrier_stats = defaultdict(lambda: {"runs": 0, "wins": 0})
    jockey_stats = defaultdict(lambda: {"runs": 0, "wins": 0})
    trainer_stats = defaultdict(lambda: {"runs": 0, "wins": 0})
    horse_trip_stats = defaultdict(lambda: {"runs": 0, "wins": 0})

    results_old = []
    results_new = []

    for idx, race in enumerate(all_races):
        rid = race["race_id"]
        entries = fetch_entries(conn, rid)
        if not entries:
            continue

        venue = race["venue"]
        dist = race["distance_m"]
        cfg = race["course_config"]

        global_base = (
            total_stats["wins"] / total_stats["runs"]
            if total_stats["runs"] > 0
            else DEFAULT_BASE_RATE
        )

        res_old = evaluate_race(
            entries, venue, dist, cfg, global_base, "exact",
            barrier_stats, jockey_stats, trainer_stats, horse_trip_stats, trip_stats
        )
        res_new = evaluate_race(
            entries, venue, dist, cfg, global_base, "smoothed",
            barrier_stats, jockey_stats, trainer_stats, horse_trip_stats, trip_stats
        )

        if idx >= BURN_IN_RACES:
            results_old.append((race, res_old))
            results_new.append((race, res_new))

        # Now absorb this race into history before moving forward
        update_stats(
            entries, venue, dist, cfg,
            total_stats, trip_stats, barrier_stats,
            jockey_stats, trainer_stats, horse_trip_stats
        )

        if idx % 100 == 0 and idx > 0:
            print(f"  ... processed {idx} races")

    # Slice to the final N races
    results_old = results_old[-N_RACES:]
    results_new = results_new[-N_RACES:]

    old = aggregate_metrics(results_old, "Exact")
    new = aggregate_metrics(results_new, "Smoothed")
    print_report(old, new)

    if results_new:
        d0 = results_new[0][0]["race_date"]
        d1 = results_new[-1][0]["race_date"]
        print(f"\nDate range of test set: {d0}  →  {d1}\n")


if __name__ == "__main__":
    main()