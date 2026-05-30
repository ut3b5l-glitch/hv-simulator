#!/usr/bin/env python3
"""
benter_blend.py — Conditional-logit combiner (Benter method) experiment.

Builds, per runner, a feature vector of log-factors from model_core plus the
log de-vigged market probability, then fits a race-grouped conditional logit
(multinomial softmax per race) by Newton-Raphson with L2 regularization.

Walk-forward, leak-free: factor stats for each race are built strictly from
data before that race's date; logit coefficients are trained only on races in
earlier folds and applied out-of-sample to the test fold.

Compares four rankers on the held-out races:
  • market   — de-vigged public odds
  • model    — current multiplicative 9-factor chain (rank by show%)
  • blendA   — conditional logit on [log p_mkt, log p_model]
  • blendB   — conditional logit on [log p_mkt, all individual log-factors]

Metrics: #1 win, #1 place(top-3), top-3 precision, winner coverage.
"""
import sqlite3
import math
import numpy as np
import model_core as mc

DB = "happy_valley.db"
VENUE = "HV"
L2 = 2.0           # ridge strength on logit coefficients
INITIAL_TRAIN = 350  # races before first test fold
STRIDE = 50

FEATURES_B = ["log_mkt", "log_jf", "log_tf", "log_hf", "log_ff",
              "log_biv", "log_cf", "log_wcf", "log_rtf", "log_df"]


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


def devig(entries):
    """De-vigged market win prob per horse_id. None if no odds."""
    valid = [(e["horse_id"], 1.0 / e["public_odds"])
             for e in entries if e.get("public_odds") and e["public_odds"] > 0]
    if len(valid) < 2:
        return None
    s = sum(v for _, v in valid)
    return {hid: v / s for hid, v in valid}


def build_race_features(completed, stats, dist, cfg, rclass, going):
    """Return (race_dict) with per-runner feature rows, model probs, winner idx.

    Skips races without a clean winner or without market odds.
    """
    mkt = devig(completed)
    if not mkt:
        return None
    runners = mc.score_race(completed, stats, dist, cfg, race_class=rclass, going=going)
    if not runners:
        return None

    rows = []
    for r in runners:
        hid = r["horse_id"]
        p_mkt = mkt.get(hid)
        if not p_mkt or p_mkt <= 0:
            p_mkt = 1e-4
        p_model = max(r["win_pct"] / 100.0, 1e-6)
        feat = {
            "log_mkt": math.log(p_mkt),
            "log_model": math.log(p_model),
            "log_jf": math.log(max(r["jf"], 1e-6)),
            "log_tf": math.log(max(r["tf"], 1e-6)),
            "log_hf": math.log(max(r["hf"], 1e-6)),
            "log_ff": math.log(max(r["ff"], 1e-6)),
            "log_biv": math.log(max(r["b_iv"], 1e-6)),
            "log_cf": math.log(max(r["cf"], 1e-6)),
            "log_wcf": math.log(max(r["wcf"], 1e-6)),
            "log_rtf": math.log(max(r["rtf"], 1e-6)),
            "log_df": math.log(max(r["df"], 1e-6)),
        }
        rows.append({
            "horse_id": hid,
            "feat": feat,
            "p_mkt": p_mkt,
            "win_pct": r["win_pct"],
            "show_pct": r["show_pct"],
            "finish_position": r["finish_position"],
        })
    winner_idx = next((i for i, x in enumerate(rows)
                       if x["finish_position"] == 1), None)
    if winner_idx is None:
        return None
    return {"rows": rows, "winner_idx": winner_idx}


def make_matrix(race, feat_names):
    return np.array([[r["feat"][f] for f in feat_names] for r in race["rows"]])


def fit_conditional_logit(races, feat_names, l2=L2, iters=50):
    """Newton-Raphson MLE for race-grouped conditional logit."""
    k = len(feat_names)
    beta = np.zeros(k)
    mats = [(make_matrix(r, feat_names), r["winner_idx"]) for r in races]
    for _ in range(iters):
        g = -l2 * beta
        H = -l2 * np.eye(k)
        for X, win in mats:
            u = X @ beta
            u -= u.max()
            ex = np.exp(u)
            p = ex / ex.sum()
            g += X[win] - X.T @ p
            H += -(X.T * p) @ X + np.outer(X.T @ p, X.T @ p)
        try:
            step = np.linalg.solve(H, g)
        except np.linalg.LinAlgError:
            break
        beta_new = beta - step
        if np.max(np.abs(beta_new - beta)) < 1e-7:
            beta = beta_new
            break
        beta = beta_new
    return beta


def predict_probs(race, feat_names, beta):
    X = make_matrix(race, feat_names)
    u = X @ beta
    u -= u.max()
    ex = np.exp(u)
    return ex / ex.sum()


def rank_metrics(order, race):
    """order: list of row-indices best→worst. Returns (win, place, prec, cover)."""
    rows = race["rows"]
    actual_top3 = {i for i, r in enumerate(rows) if r["finish_position"] <= 3}
    winner = race["winner_idx"]
    top3 = set(order[:3])
    win = int(order[0] == winner)
    place = int(order[0] in actual_top3)
    prec = len(top3 & actual_top3) / 3.0
    cover = int(winner in top3)
    return win, place, prec, cover


def harville_order(win_probs):
    """win_probs: np array. Return order by show% via Harville."""
    wp = {i: float(p) for i, p in enumerate(win_probs)}
    hp = mc.harville_probs(wp)
    return [i for i, _ in sorted(hp.items(), key=lambda kv: kv[1]["show"], reverse=True)]


def main():
    conn = sqlite3.connect(DB)
    races = load_races(conn)

    # Pre-build stats per distinct date (leak-free, cached)
    dates = sorted({r[1] for r in races})
    print(f"Building factor stats for {len(dates)} distinct dates...")
    stats_by_date = {d: mc.build_stats(conn, before_date=d, venue=VENUE) for d in dates}

    # Build feature races in chronological order
    feat_races = []
    for race_id, rdate, dist, cfg, rclass, going in races:
        entries = load_entries(conn, race_id)
        completed = [e for e in entries if e["finish_position"] is not None]
        if len(completed) < 4:
            continue
        fr = build_race_features(completed, stats_by_date[rdate], dist, cfg, rclass, going)
        if fr:
            feat_races.append(fr)
    N = len(feat_races)
    print(f"Usable races (results + odds + winner): {N}\n")

    feat_A = ["log_mkt", "log_model"]
    feat_B = FEATURES_B

    agg = {name: dict(n=0, win=0, place=0, prec=0.0, cover=0)
           for name in ("market", "model", "blendA", "blendB")}

    train_end = INITIAL_TRAIN
    betas_last = {}
    while train_end < N:
        test_end = min(train_end + STRIDE, N)
        train = feat_races[:train_end]
        test = feat_races[train_end:test_end]
        betaA = fit_conditional_logit(train, feat_A)
        betaB = fit_conditional_logit(train, feat_B)
        betas_last = {"A": betaA, "B": betaB}

        for race in test:
            rows = race["rows"]
            # market
            order = sorted(range(len(rows)), key=lambda i: rows[i]["p_mkt"], reverse=True)
            for s, v in zip(("win", "place", "prec", "cover"), rank_metrics(order, race)):
                agg["market"][s] += v
            agg["market"]["n"] += 1
            # model (already show%-sorted in score_race, but re-sort to be safe)
            order = sorted(range(len(rows)), key=lambda i: rows[i]["show_pct"], reverse=True)
            for s, v in zip(("win", "place", "prec", "cover"), rank_metrics(order, race)):
                agg["model"][s] += v
            agg["model"]["n"] += 1
            # blendA
            wp = predict_probs(race, feat_A, betaA)
            order = harville_order(wp)
            for s, v in zip(("win", "place", "prec", "cover"), rank_metrics(order, race)):
                agg["blendA"][s] += v
            agg["blendA"]["n"] += 1
            # blendB
            wp = predict_probs(race, feat_B, betaB)
            order = harville_order(wp)
            for s, v in zip(("win", "place", "prec", "cover"), rank_metrics(order, race)):
                agg["blendB"][s] += v
            agg["blendB"]["n"] += 1

        train_end = test_end

    print(f"{'='*72}")
    print(f"  CONDITIONAL-LOGIT COMBINER — walk-forward (train≥{INITIAL_TRAIN}, stride {STRIDE})")
    print(f"{'='*72}")
    print(f"  {'Ranker':<9} {'N':>4} {'#1 Win':>8} {'#1 Place':>9} {'Top3 Prec':>10} {'Coverage':>9}")
    print(f"  {'-'*66}")
    for name in ("market", "model", "blendA", "blendB"):
        a = agg[name]; n = a["n"] or 1
        print(f"  {name:<9} {a['n']:>4} {a['win']/n*100:>7.1f}% "
              f"{a['place']/n*100:>8.1f}% {a['prec']/n*100:>9.1f}% {a['cover']/n*100:>8.1f}%")
    print(f"{'='*72}")
    print("\n  Last-fold coefficients:")
    print(f"  blendA {feat_A}\n    {np.round(betas_last['A'],3)}")
    print(f"  blendB {feat_B}\n    {np.round(betas_last['B'],3)}")
    conn.close()


if __name__ == "__main__":
    main()
