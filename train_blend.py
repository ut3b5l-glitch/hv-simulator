#!/usr/bin/env python3
"""
train_blend.py — fit and persist the market-blend conditional-logit coefficients.

Fits a race-grouped conditional logit on the SAME log-feature vectors that
model_core uses in production, then writes blend_coef.json for
model_core.load_blend_coef() to pick up at scoring time.

Features (model_core.BLEND_FEATURES order):
  log_mkt  — log de-vigged market win probability   (dominant; ridge-anchored to 1)
  log_jf log_tf log_hf log_ff log_biv log_cf log_wcf log_rtf log_df
           — log fundamental factors (ridge-shrunk toward 0 — they only survive
             if they earn predictive weight beyond the market)

Leak-free: factor stats for each training race are built strictly from races
before its date, exactly as the live importer would have seen them.

Usage:
  python3 train_blend.py            # fit on all HV history, write blend_coef.json
  python3 train_blend.py --l2 25    # override ridge strength
"""
import sqlite3
import math
import json
import sys
from datetime import date

import numpy as np
import model_core as mc

DB = "happy_valley.db"
VENUE = "HV"
L2_DEFAULT = 25.0    # strong shrinkage: the market is efficient, factors are a whisper


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


def feature_matrix(runners):
    """(n×k) matrix in BLEND_FEATURES order + winner index, or (None, None)."""
    augmented = {r["horse_id"]: r for r in runners}
    market = mc._devig_market(augmented)
    if market is None:
        return None, None
    X, win = [], None
    for i, r in enumerate(runners):
        if r["finish_position"] == 1:
            win = i
        row = [math.log(max(market[r["horse_id"]] if f == "log_mkt"
                            else r.get(mc._BLEND_FACTOR_KEY[f], 1.0), 1e-9))
               for f in mc.BLEND_FEATURES]
        X.append(row)
    if win is None:
        return None, None
    return np.array(X), win


def fit_conditional_logit(samples, k, l2, iters=200):
    """Newton-Raphson MLE with ridge toward prior [1, 0, 0, ...]."""
    beta0 = np.zeros(k); beta0[0] = 1.0      # anchor market coef at 1, factors at 0
    beta = beta0.copy()
    for _ in range(iters):
        g = -l2 * (beta - beta0)
        H = -l2 * np.eye(k)
        for X, win in samples:
            u = X @ beta; u -= u.max()
            ex = np.exp(u); p = ex / ex.sum()
            Xp = X.T @ p
            g += X[win] - Xp
            H += -(X.T * p) @ X + np.outer(Xp, Xp)
        try:
            step = np.linalg.solve(H, g)
        except np.linalg.LinAlgError:
            break
        nb = beta - step
        if np.max(np.abs(nb - beta)) < 1e-9:
            beta = nb; break
        beta = nb
    return beta


def main():
    l2 = L2_DEFAULT
    if "--l2" in sys.argv:
        l2 = float(sys.argv[sys.argv.index("--l2") + 1])

    conn = sqlite3.connect(DB)
    races = load_races(conn)
    dates = sorted({r[1] for r in races})
    print(f"Building leak-free factor stats for {len(dates)} dates...")
    stats_by_date = {d: mc.build_stats(conn, before_date=d, venue=VENUE) for d in dates}

    samples = []
    for race_id, rdate, dist, cfg, rclass, going in races:
        completed = [e for e in load_entries(conn, race_id)
                     if e["finish_position"] is not None]
        if len(completed) < 4:
            continue
        runners = mc.score_race(completed, stats_by_date[rdate], dist, cfg,
                                race_class=rclass, going=going)   # pure factors
        if not runners:
            continue
        X, win = feature_matrix(runners)
        if X is not None:
            samples.append((X, win))
    conn.close()

    print(f"Fitting conditional logit on {len(samples)} races (L2={l2}, ridge→[1,0..])...")
    beta = fit_conditional_logit(samples, len(mc.BLEND_FEATURES), l2)

    coef = {
        "features": mc.BLEND_FEATURES,
        "beta": [round(float(b), 6) for b in beta],
        "l2": l2,
        "n_races": len(samples),
        "trained": date.today().isoformat(),
        "method": "race-grouped conditional logit (Newton, ridge→market prior); de-vigged market + log-factors",
    }
    with open(mc.BLEND_COEF_PATH, "w") as f:
        json.dump(coef, f, indent=2)

    print(f"\nWrote {mc.BLEND_COEF_PATH}  ({len(samples)} races)")
    print(f"  {'feature':<10}{'beta':>10}")
    for name, b in zip(coef["features"], coef["beta"]):
        print(f"  {name:<10}{b:>10.4f}")


if __name__ == "__main__":
    main()
