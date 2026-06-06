#!/usr/bin/env python3
"""
ablation_test.py
Factor ablation study — measures each factor's contribution to top-3 precision
by post-hoc setting it to 1.0 (neutral) one at a time across the walk-forward.

Method: score_race() is run normally, then raw scores are divided by the target
factor and re-normalised. Since factors are multiplicative and independent, this
is equivalent to having scored the race with that factor disabled. No changes to
model_core.py required.

Factors tested: b_iv, jf, tf, hf, ff, cf, wcf
Skipped: rtf, df  — Phase B only; always 1.0 in historical data.
         gf       — already excluded from the multiplicative chain.
"""

import sqlite3
import model_core as mc

DB_PATH       = "happy_valley.db"
VENUE         = "HV"
INITIAL_TRAIN = 400
STRIDE        = 50

FACTORS = ["b_iv", "jf", "tf", "hf", "ff", "cf", "wcf"]
FACTOR_LABELS = {
    "b_iv": "Barrier IV",
    "jf":   "Jockey",
    "tf":   "Trainer",
    "hf":   "Horse (exact-trip)",
    "ff":   "Form",
    "cf":   "Class",
    "wcf":  "Weight-Change",
}


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


def rerank_with_factor_disabled(runners, disabled_factor):
    """
    Return new top-3 predictions with `disabled_factor` set to 1.0.
    Divides the factor out of raw_score and re-runs Harville.
    """
    new_raw = {}
    for r in runners:
        fval = r.get(disabled_factor, 1.0)
        if fval and fval != 0:
            new_raw[r["horse_id"]] = r["raw_score"] / fval
        else:
            new_raw[r["horse_id"]] = r["raw_score"]

    total = sum(new_raw.values())
    if total == 0:
        return [r["horse_id"] for r in runners[:3]]

    win_probs = {hid: s / total for hid, s in new_raw.items()}
    h_probs   = mc.harville_probs(win_probs)

    sorted_runners = sorted(runners, key=lambda r: h_probs[r["horse_id"]]["show"], reverse=True)
    return [r["horse_id"] for r in sorted_runners[:3]]


def run_fold(conn, races, train_end, test_start, test_end):
    test_races  = races[test_start:test_end]
    cutoff_date = test_races[0][1]
    stats       = mc.build_stats(conn, before_date=cutoff_date, venue=VENUE)

    # Per-factor accumulators: full model + one per disabled factor
    configs = ["full"] + FACTORS
    acc = {c: {"n": 0, "places": 0, "precision_sum": 0.0, "covered": 0} for c in configs}

    for race_id, rdate, dist, cfg, race_class, going in test_races:
        entries = load_entries(conn, race_id)
        if not entries:
            continue
        completed = [e for e in entries if e["finish_position"] is not None]
        if not completed:
            continue

        runners = mc.score_race(completed, stats, dist, cfg, race_class=race_class, going=going)
        if not runners:
            continue

        actual_top3 = {e["horse_id"] for e in completed if e["finish_position"] <= 3}
        winner      = next((e["horse_id"] for e in completed if e["finish_position"] == 1), None)

        def score_pred(pred_top3_ids):
            pred = set(pred_top3_ids)
            return {
                "top1_place":   int(pred_top3_ids[0] in actual_top3),
                "precision":    len(pred & actual_top3) / 3.0,
                "covered":      int(winner in pred) if winner else 0,
            }

        # Full model
        full_top3 = [r["horse_id"] for r in runners[:3]]
        s = score_pred(full_top3)
        acc["full"]["n"]             += 1
        acc["full"]["places"]        += s["top1_place"]
        acc["full"]["precision_sum"] += s["precision"]
        acc["full"]["covered"]       += s["covered"]

        # Per-factor ablation
        for factor in FACTORS:
            ablated_top3 = rerank_with_factor_disabled(runners, factor)
            s = score_pred(ablated_top3)
            acc[factor]["n"]             += 1
            acc[factor]["places"]        += s["top1_place"]
            acc[factor]["precision_sum"] += s["precision"]
            acc[factor]["covered"]       += s["covered"]

    return acc


def main():
    conn  = sqlite3.connect(DB_PATH)
    races = load_races(conn)
    total = len(races)
    print(f"Loaded {total} Happy Valley races.\n")

    # Build folds
    folds = []
    train_end = INITIAL_TRAIN
    while train_end < total:
        test_end = min(train_end + STRIDE, total)
        folds.append((train_end, train_end, test_end))
        train_end = test_end

    # Aggregate across all folds
    configs = ["full"] + FACTORS
    totals = {c: {"n": 0, "places": 0, "precision_sum": 0.0, "covered": 0} for c in configs}

    for i, (train_end, test_start, test_end) in enumerate(folds):
        print(f"  Fold {i+1}: train={train_end}  test {test_start}→{test_end}...")
        fold_acc = run_fold(conn, races, train_end, test_start, test_end)
        for c in configs:
            for k in totals[c]:
                totals[c][k] += fold_acc[c][k]

    conn.close()

    # ── Results ───────────────────────────────────────────────────────────────
    n = totals["full"]["n"]
    full_prec  = totals["full"]["precision_sum"] / n * 100
    full_place = totals["full"]["places"] / n * 100
    full_cov   = totals["full"]["covered"] / n * 100

    W = 82
    print("\n" + "=" * W)
    print("  FACTOR ABLATION — effect of disabling each factor (set to 1.0/neutral)")
    print(f"  Full model: Precision={full_prec:.1f}%  #1 Place={full_place:.1f}%  Coverage={full_cov:.1f}%")
    print(f"  Races evaluated: {n}  |  Walk-forward: {len(folds)} folds")
    print("=" * W)
    print(f"  {'Factor':<22}  {'Precision':>9}  {'Δ Prec':>8}  {'#1 Place':>9}  {'Δ Place':>8}  {'Coverage':>9}  {'Δ Cov':>7}")
    print("  " + "-" * (W - 2))

    # Sort by precision drop (biggest drop = most important factor)
    results = []
    for factor in FACTORS:
        fn = totals[factor]["n"]
        prec  = totals[factor]["precision_sum"] / fn * 100
        place = totals[factor]["places"] / fn * 100
        cov   = totals[factor]["covered"] / fn * 100
        results.append((factor, prec, place, cov))

    results.sort(key=lambda x: x[1])  # ascending = biggest drop first

    for factor, prec, place, cov in results:
        label      = FACTOR_LABELS[factor]
        d_prec     = prec  - full_prec
        d_place    = place - full_place
        d_cov      = cov   - full_cov
        prec_str   = f"{prec:.1f}%"
        place_str  = f"{place:.1f}%"
        cov_str    = f"{cov:.1f}%"
        d_prec_str = f"{d_prec:+.1f}pp"
        d_plc_str  = f"{d_place:+.1f}pp"
        d_cov_str  = f"{d_cov:+.1f}pp"
        print(f"  {label:<22}  {prec_str:>9}  {d_prec_str:>8}  {place_str:>9}  {d_plc_str:>8}  {cov_str:>9}  {d_cov_str:>7}")

    print("  " + "-" * (W - 2))
    print(f"  {'FULL MODEL':<22}  {full_prec:>8.1f}%  {'—':>8}  {full_place:>8.1f}%  {'—':>8}  {full_cov:>8.1f}%  {'—':>7}")
    print("=" * W)
    print("\n  Δ = change vs full model when factor is disabled.")
    print("  Negative Δ = factor HURTS (removing it improves results).")
    print("  Positive Δ = factor HELPS (removing it loses performance).\n")


if __name__ == "__main__":
    main()
