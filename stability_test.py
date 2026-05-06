#!/usr/bin/env python3
"""
stability_test.py
Single train/test split stability check using model_core.py.
Train: first (N - TOP_N_TEST) races. Test: last TOP_N_TEST races.

Configs tested:
  A. Phase A model (Barrier + Jockey + Trainer + Horse + Form + Weight + Harville)
  B. Legacy model  (Barrier + Jockey + Trainer + Horse only, no Harville)

Metrics: top-1 win%, top-3 coverage%, top-3 precision%, value ROI.
"""

import sqlite3
import model_core as mc

DB_PATH      = "happy_valley.db"
VENUE        = "HV"
TOP_N_TEST   = 200


# ─────────────────────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────────────────────

def load_races(conn):
    return conn.execute("""
        SELECT race_id, race_date, distance_m, course_config, race_class
        FROM races WHERE venue=?
        ORDER BY race_date ASC, race_number ASC
    """, (VENUE,)).fetchall()


def load_entries(conn, race_id):
    rows = conn.execute("""
        SELECT e.horse_id, e.barrier, e.jockey_id, e.trainer_id,
               e.weight, e.public_odds, e.finish_position,
               e.official_rating, e.rating_change, e.days_since_last_run, e.last_6_runs
        FROM race_entries e WHERE e.race_id=?
    """, (race_id,)).fetchall()
    return [
        {
            "horse_id": r[0], "barrier": r[1], "jockey_id": r[2],
            "trainer_id": r[3], "weight": r[4], "public_odds": r[5],
            "finish_position": r[6], "official_rating": r[7],
            "rating_change": r[8], "days_since_last_run": r[9], "last_6_runs": r[10],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Run one config
# ─────────────────────────────────────────────────────────────────────────────

def run_config(conn, races, config_name, use_form=True, use_weight=True):
    train_races = races[:-TOP_N_TEST]
    test_races  = races[-TOP_N_TEST:]
    cutoff      = test_races[0][1]

    print(f"  Train: {len(train_races)} races (before {cutoff})")
    print(f"  Test:  {len(test_races)} races")

    stats = mc.build_stats(conn, before_date=cutoff, venue=VENUE)

    # Temporarily zero out new factors if testing legacy config
    if not use_form:
        stats["recent_form"] = {}
    if not use_weight:
        # signal to _weight_factors that there's no weight data
        pass  # weight comes from entries; we'll zero it in entries instead

    records = []
    for race_id, rdate, dist, cfg, race_class in test_races:
        entries = load_entries(conn, race_id)
        completed = [e for e in entries if e["finish_position"] is not None]
        if not completed:
            continue

        # Strip weight from entries if testing legacy config
        if not use_weight:
            completed = [{**e, "weight": None} for e in completed]

        runners = mc.score_race(completed, stats, dist, cfg, race_class=race_class)
        if not runners:
            continue

        winner      = next((e["horse_id"] for e in completed if e["finish_position"] == 1), None)
        actual_top3 = {e["horse_id"] for e in completed
                       if e["finish_position"] is not None and e["finish_position"] <= 3}
        pred_top3   = {r["horse_id"] for r in runners[:3]}
        top1_hid    = runners[0]["horse_id"]

        vb_count, vb_profit = 0, 0.0
        for r in runners:
            if r["is_value"] and r.get("public_odds") and r["public_odds"] > 0:
                vb_count += 1
                vb_profit += (r["public_odds"] - 1.0) if r["horse_id"] == winner else -1.0

        records.append({
            "top1_win":       int(top1_hid == winner),
            "top1_place":     int(top1_hid in actual_top3),
            "winner_covered": int(winner in pred_top3) if winner else 0,
            "precision":      len(pred_top3 & actual_top3) / 3.0,
            "field_size":     len(completed),
            "vb_count":       vb_count,
            "vb_profit":      vb_profit,
        })

    n = len(records)
    if n == 0:
        print("  No results.\n")
        return

    vb_total  = sum(r["vb_count"]  for r in records)
    vb_profit = sum(r["vb_profit"] for r in records)
    avg_field = sum(r["field_size"] for r in records) / n

    print(f"\n  Results ({n} races evaluated):")
    print(f"    #1 pick win rate      : {sum(r['top1_win'] for r in records)/n*100:.1f}%")
    print(f"    #1 pick place (top-3) : {sum(r['top1_place'] for r in records)/n*100:.1f}%")
    print(f"    Winner in top-3       : {sum(r['winner_covered'] for r in records)/n*100:.1f}%  ← coverage")
    print(f"    Top-3 precision       : {sum(r['precision'] for r in records)/n*100:.1f}%  ← of our 3 picks, how many placed?")
    print(f"    Random baseline       : {3/avg_field*100:.1f}%  ← avg {avg_field:.1f}-horse field")
    if vb_total:
        roi = vb_profit / vb_total * 100
        print(f"    Value bet ROI         : {roi:+.1f}%  ({vb_total} bets)")
    else:
        print(f"    Value bets            : none generated")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    conn  = sqlite3.connect(DB_PATH)
    races = load_races(conn)
    print(f"Loaded {len(races)} Happy Valley races.\n")

    configs = [
        ("Phase A  — full model (+ Form + Weight + Harville)", True,  True),
        ("Legacy   — Barrier + Jockey + Trainer + Horse only", False, False),
    ]

    for name, use_form, use_weight in configs:
        print("=" * 60)
        print(f"CONFIG: {name}")
        print("=" * 60)
        run_config(conn, races, name, use_form=use_form, use_weight=use_weight)

    conn.close()


if __name__ == "__main__":
    main()
