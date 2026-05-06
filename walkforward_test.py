#!/usr/bin/env python3
"""
walkforward_test.py
Expanding-window walk-forward validation using model_core.py.

Fold design (race indices, 0-based):
  Fold 1: Train 0-399  (400 races), Test 400-449  (50 races)
  Fold 2: Train 0-449  (450 races), Test 450-499  (50 races)
  Fold 3: Train 0-499  (500 races), Test 500-549  (50 races)
  Fold 4: Train 0-549  (550 races), Test 550-end

Key metrics:
  Top-pick win%    — did model's #1 ranked horse (by show%) win?
  Top-3 coverage%  — did the actual winner appear in our top-3 show predictions?
  Top-3 precision% — of our 3 predicted horses, how many actually placed top-3?
                     (random baseline for 12-horse field ≈ 25%)
  Value bet ROI    — edge >5%, model win% >10%
"""

import sqlite3
import model_core as mc

DB_PATH       = "happy_valley.db"
VENUE         = "HV"
INITIAL_TRAIN = 400
STRIDE        = 50


# ─────────────────────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────────────────────

def load_races(conn):
    return conn.execute("""
        SELECT race_id, race_date, distance_m, course_config, race_class, going
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
# Fold evaluation
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_fold(conn, races, train_end, test_start, test_end, fold_num):
    test_races  = races[test_start:test_end]
    cutoff_date = test_races[0][1]

    stats = mc.build_stats(conn, before_date=cutoff_date, venue=VENUE)

    records = []
    for race_id, rdate, dist, cfg, race_class, going in test_races:
        entries = load_entries(conn, race_id)
        if not entries:
            continue

        # Only evaluate races where we have complete result data
        completed = [e for e in entries if e["finish_position"] is not None]
        if not completed:
            continue

        runners = mc.score_race(completed, stats, dist, cfg, race_class=race_class, going=going)
        if not runners:
            continue

        # Ground truth
        winner     = next((e["horse_id"] for e in completed if e["finish_position"] == 1), None)
        actual_top3 = {e["horse_id"] for e in completed if e["finish_position"] is not None and e["finish_position"] <= 3}
        field_size  = len(completed)

        # Our predictions (runners already sorted by show% desc)
        pred_top3   = {r["horse_id"] for r in runners[:3]}
        top1_hid    = runners[0]["horse_id"]

        # Metrics
        top1_win    = int(top1_hid == winner)
        top1_place  = int(top1_hid in actual_top3)
        winner_covered = int(winner in pred_top3) if winner else 0
        precision   = len(pred_top3 & actual_top3) / 3.0

        # Value bets
        vb_count, vb_profit = 0, 0.0
        for r in runners:
            if r["is_value"] and r.get("public_odds") and r["public_odds"] > 0:
                vb_count += 1
                if r["horse_id"] == winner:
                    vb_profit += r["public_odds"] - 1.0
                else:
                    vb_profit -= 1.0

        records.append({
            "top1_win":        top1_win,
            "top1_place":      top1_place,
            "winner_covered":  winner_covered,
            "precision":       precision,
            "field_size":      field_size,
            "vb_count":        vb_count,
            "vb_profit":       vb_profit,
        })

    n = len(records)
    if n == 0:
        return None, dict(fold=fold_num, train_n=train_end, test_n=0,
                          test_start_date=cutoff_date, test_end_date=test_races[-1][1])

    vb_total  = sum(r["vb_count"]  for r in records)
    vb_profit = sum(r["vb_profit"] for r in records)
    avg_field = sum(r["field_size"] for r in records) / n

    metrics = dict(
        n             = n,
        wins          = sum(r["top1_win"]       for r in records),
        places        = sum(r["top1_place"]     for r in records),
        covered       = sum(r["winner_covered"] for r in records),
        precision_sum = sum(r["precision"]      for r in records),
        vb_count      = vb_total,
        vb_profit     = vb_profit,
        vb_roi        = vb_profit / vb_total * 100 if vb_total else None,
        avg_field     = avg_field,
        # derived
        top1_win_pct  = sum(r["top1_win"]       for r in records) / n * 100,
        top1_place_pct= sum(r["top1_place"]     for r in records) / n * 100,
        coverage_pct  = sum(r["winner_covered"] for r in records) / n * 100,
        precision_pct = sum(r["precision"]      for r in records) / n * 100,
        random_baseline_pct = 3 / avg_field * 100,   # what random guessing would score
    )

    info = dict(
        fold=fold_num, train_n=train_end, test_n=len(test_races),
        test_start_date=cutoff_date, test_end_date=test_races[-1][1],
        class_rates=stats["base_rate_by_class"],
        global_rate=stats["base_rate"],
    )

    return metrics, info


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

def roi_str(roi):
    return f"{roi:+.1f}%" if roi is not None else "  N/A "


def print_results(fold_metrics, fold_infos):
    W = 80
    print("\n" + "=" * W)
    print("  HAPPY VALLEY — WALK-FORWARD VALIDATION  (model_core Phase A)")
    print(f"  ExactTrip-m{mc.HORSE_M} + Weight + Form + Harville  |  "
          f"Edge>{mc.EDGE_THRESHOLD:.0f}%  Model>{mc.MIN_MODEL_PCT:.0f}%")
    print("=" * W)

    # Per-fold table
    print(f"\n  {'Fold':>4}  {'Train':>5}  {'Test':>4}  "
          f"{'#1 Win':>6}  {'#1 Plc':>6}  "
          f"{'Coverage':>8}  {'Precision':>9}  {'Baseline':>8}  "
          f"{'VB ROI':>7}  {'VBets':>5}")
    print("  " + "-" * (W - 2))

    for m, info in zip(fold_metrics, fold_infos):
        if m is None:
            print(f"  {info['fold']:>4}  — no completed races in test window")
            continue
        print(
            f"  {info['fold']:>4}  {info['train_n']:>5}  {m['n']:>4}  "
            f"{m['top1_win_pct']:>5.1f}%  {m['top1_place_pct']:>5.1f}%  "
            f"{m['coverage_pct']:>7.1f}%  {m['precision_pct']:>8.1f}%  "
            f"{m['random_baseline_pct']:>7.1f}%  "
            f"{roi_str(m['vb_roi']):>7}  {m['vb_count']:>5}"
        )
        print(f"  {'':>4}  {info['test_start_date']} → {info['test_end_date']}")
        print()

    # Aggregate
    valid = [m for m in fold_metrics if m is not None]
    if not valid:
        return

    total_n       = sum(m["n"]             for m in valid)
    total_wins    = sum(m["wins"]          for m in valid)
    total_places  = sum(m["places"]        for m in valid)
    total_covered = sum(m["covered"]       for m in valid)
    prec_sum      = sum(m["precision_sum"] for m in valid)
    total_vb      = sum(m["vb_count"]      for m in valid)
    total_profit  = sum(m["vb_profit"]     for m in valid)
    avg_field     = sum(m["avg_field"] * m["n"] for m in valid) / total_n

    agg_roi = total_profit / total_vb * 100 if total_vb else None

    print("  " + "=" * (W - 2))
    print("  AGGREGATE — all folds")
    print("  " + "-" * (W - 2))
    print(f"  {'Metric':<30}  {'Value':>10}  {'Notes'}")
    print(f"  {'#1 pick win rate':<30}  {total_wins/total_n*100:>9.1f}%")
    print(f"  {'#1 pick place rate (top-3)':<30}  {total_places/total_n*100:>9.1f}%")
    print(f"  {'Winner in top-3 (coverage)':<30}  {total_covered/total_n*100:>9.1f}%  "
          f"← did winner appear in our top-3?")
    print(f"  {'Top-3 precision':<30}  {prec_sum/total_n*100:>9.1f}%  "
          f"← of our 3 picks, how many placed top-3?")
    print(f"  {'Random-guess baseline':<30}  {3/avg_field*100:>9.1f}%  "
          f"← avg field {avg_field:.1f} horses")
    print(f"  {'Value bet ROI':<30}  {roi_str(agg_roi):>10}  ({total_vb} bets / {total_n} races)")
    print("  " + "=" * (W - 2))

    # Class rate table
    all_classes = sorted({cls for info in fold_infos for cls in info.get("class_rates", {})})
    if all_classes:
        print(f"\n  Class base rates by fold:")
        hdr = f"  {'Fold':<6}" + "".join(f"  {c:<11}" for c in all_classes) + "   Global"
        print(hdr)
        for info in fold_infos:
            row = f"  {info['fold']:<6}"
            for cls in all_classes:
                r = info["class_rates"].get(cls)
                row += f"  {r*100:.1f}%      " if r else f"  {'N/A':<11}"
            row += f"  {info['global_rate']*100:.1f}%"
            print(row)

    print("=" * W)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    conn  = sqlite3.connect(DB_PATH)
    races = load_races(conn)
    total = len(races)
    print(f"Loaded {total} Happy Valley races.")

    folds = []
    train_end = INITIAL_TRAIN
    while train_end < total:
        test_end = min(train_end + STRIDE, total)
        folds.append((train_end, train_end, test_end))
        train_end = test_end

    print(f"Running {len(folds)} expanding folds "
          f"(initial train={INITIAL_TRAIN}, stride={STRIDE})\n")

    fold_metrics, fold_infos = [], []
    for i, (train_end, test_start, test_end) in enumerate(folds):
        m, info = evaluate_fold(conn, races, train_end, test_start, test_end, fold_num=i+1)
        fold_metrics.append(m)
        fold_infos.append(info)
        status = f"n={m['n']}" if m else "no data"
        print(f"  Fold {i+1}: train={train_end}  test={test_end-test_start} races "
              f"({info['test_start_date']} → {info['test_end_date']})  [{status}]")

    print_results(fold_metrics, fold_infos)
    conn.close()


if __name__ == "__main__":
    main()
