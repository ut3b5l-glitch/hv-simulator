#!/usr/bin/env python3
"""
diagnose.py — Establish the real benchmark.

Compares, on a true walk-forward basis over all HV races that have BOTH
finish positions and market odds:
  • The current 9-factor model (model_core.score_race)
  • The market favourite (lowest public_odds)
  • A market-implied probability ranking (de-vigged)

Metrics per race:
  top1_win     — did the #1 ranked horse win?
  top1_place   — did the #1 ranked horse finish top-3?
  top3_prec    — of the 3 ranked picks, how many finished top-3? (/3)
  coverage     — did the actual winner appear in the top-3 picks?
"""
import sqlite3
import model_core as mc

DB = "happy_valley.db"
VENUE = "HV"


def load_races(conn):
    return conn.execute("""
        SELECT race_id, race_date, distance_m, course_config, race_class, going
        FROM races WHERE venue=? ORDER BY race_date ASC, race_number ASC
    """, (VENUE,)).fetchall()


def load_entries(conn, race_id):
    rows = conn.execute("""
        SELECT e.horse_id, e.barrier, e.jockey_id, e.trainer_id, e.weight,
               e.public_odds, e.finish_position, e.official_rating,
               e.rating_change, e.days_since_last_run, e.last_6_runs
        FROM race_entries e WHERE e.race_id=?
    """, (race_id,)).fetchall()
    return [{
        "horse_id": r[0], "barrier": r[1], "jockey_id": r[2], "trainer_id": r[3],
        "weight": r[4], "public_odds": r[5], "finish_position": r[6],
        "official_rating": r[7], "rating_change": r[8],
        "days_since_last_run": r[9], "last_6_runs": r[10],
    } for r in rows]


def market_rank(entries):
    """Rank by implied prob (lowest odds first). Returns horse_ids ordered best→worst."""
    valid = [e for e in entries if e.get("public_odds") and e["public_odds"] > 0]
    valid.sort(key=lambda e: e["public_odds"])
    return [e["horse_id"] for e in valid]


def evaluate():
    conn = sqlite3.connect(DB)
    races = load_races(conn)

    # Only evaluate from race index 400 onward (matches walk-forward test window),
    # rebuilding stats with a strict before_date cutoff for each test race's date.
    START = 400

    agg = {
        "model": dict(n=0, win=0, place=0, prec=0.0, cover=0),
        "market": dict(n=0, win=0, place=0, prec=0.0, cover=0),
    }

    # cache stats per cutoff date to avoid rebuilding for every race
    stats_cache = {}

    for idx in range(START, len(races)):
        race_id, rdate, dist, cfg, rclass, going = races[idx]
        entries = load_entries(conn, race_id)
        completed = [e for e in entries if e["finish_position"] is not None]
        if len(completed) < 4:
            continue
        if not any(e.get("public_odds") for e in completed):
            continue

        if rdate not in stats_cache:
            stats_cache[rdate] = mc.build_stats(conn, before_date=rdate, venue=VENUE)
        stats = stats_cache[rdate]

        winner = next((e["horse_id"] for e in completed if e["finish_position"] == 1), None)
        actual_top3 = {e["horse_id"] for e in completed if e["finish_position"] <= 3}

        # ---- Model ----
        runners = mc.score_race(completed, stats, dist, cfg, race_class=rclass, going=going)
        if runners:
            pred = [r["horse_id"] for r in runners]
            top3 = set(pred[:3])
            a = agg["model"]; a["n"] += 1
            a["win"] += int(pred[0] == winner)
            a["place"] += int(pred[0] in actual_top3)
            a["prec"] += len(top3 & actual_top3) / 3.0
            a["cover"] += int(winner in top3)

        # ---- Market ----
        mrank = market_rank(completed)
        if mrank:
            top3 = set(mrank[:3])
            a = agg["market"]; a["n"] += 1
            a["win"] += int(mrank[0] == winner)
            a["place"] += int(mrank[0] in actual_top3)
            a["prec"] += len(top3 & actual_top3) / 3.0
            a["cover"] += int(winner in top3)

    conn.close()

    print(f"\n{'='*68}")
    print(f"  BENCHMARK — HV races index {START}+ (walk-forward, strict cutoff)")
    print(f"{'='*68}")
    print(f"  {'Ranker':<10} {'N':>4} {'#1 Win':>8} {'#1 Place':>9} {'Top3 Prec':>10} {'Coverage':>9}")
    print(f"  {'-'*62}")
    for name in ("model", "market"):
        a = agg[name]
        n = a["n"] or 1
        print(f"  {name:<10} {a['n']:>4} "
              f"{a['win']/n*100:>7.1f}% "
              f"{a['place']/n*100:>8.1f}% "
              f"{a['prec']/n*100:>9.1f}% "
              f"{a['cover']/n*100:>8.1f}%")
    print(f"{'='*68}\n")


if __name__ == "__main__":
    evaluate()
