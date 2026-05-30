#!/usr/bin/env python3
"""
validate_blend.py — canonical honest validator for the market-blend combiner.

Walk-forward over the recent portion of HV history (race index >= START).
For each test MEETING, blend coefficients are trained ONLY on races strictly
before that meeting's date (leak-free), then the meeting's races are ranked by:
  • model   — pure 9-factor chain (rank by Harville show%)
  • market  — de-vigged public odds (favourite first)
  • blend@L2— race-grouped conditional logit on [log market prob + log factors]

Metrics: #1 win, #1 place(top-3), top-3 precision, winner coverage.
Run once; numbers here are the source of truth for the wiki.
"""
import sqlite3
import math
import numpy as np
import model_core as mc

DB = "happy_valley.db"
VENUE = "HV"
START = 400                       # first test race index (matches diagnose.py)
FEATURES = ["log_mkt", "log_jf", "log_tf", "log_hf", "log_ff",
            "log_biv", "log_cf", "log_wcf", "log_rtf", "log_df"]
FKEY = {"log_jf": "jf", "log_tf": "tf", "log_hf": "hf", "log_ff": "ff",
        "log_biv": "b_iv", "log_cf": "cf", "log_wcf": "wcf",
        "log_rtf": "rtf", "log_df": "df"}
L2_GRID = [3.0, 6.0, 10.0, 20.0, 40.0]


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


def devig(runners):
    valid = [(r["horse_id"], 1.0 / r["public_odds"]) for r in runners
             if r.get("public_odds") and r["public_odds"] > 0]
    if len(valid) < len(runners) or len(valid) < 2:
        return None
    s = sum(v for _, v in valid)
    return {hid: v / s for hid, v in valid}


def feature_matrix(runners):
    mkt = devig(runners)
    if mkt is None:
        return None, None
    X = []
    win = None
    for i, r in enumerate(runners):
        if r["finish_position"] == 1:
            win = i
        row = []
        for f in FEATURES:
            v = mkt[r["horse_id"]] if f == "log_mkt" else r.get(FKEY[f], 1.0)
            row.append(math.log(max(v, 1e-9)))
        X.append(row)
    if win is None:
        return None, None
    return np.array(X), win


def fit_logit(samples, k, l2, iters=100):
    # Ridge toward a prior of [1, 0, 0, ...]: the market log-prob coefficient is
    # shrunk toward 1 (keep the market signal at full strength), the fundamental
    # factor coefficients toward 0 (only survive if they earn their keep).
    beta0 = np.zeros(k)
    beta0[0] = 1.0
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
        if np.max(np.abs(nb - beta)) < 1e-8:
            beta = nb; break
        beta = nb
    return beta


def logit_probs(X, beta):
    u = X @ beta; u -= u.max()
    ex = np.exp(u)
    return ex / ex.sum()


def harville_order_from_winprobs(wp):
    d = {i: float(p) for i, p in enumerate(wp)}
    hp = mc.harville_probs(d)
    return [i for i, _ in sorted(hp.items(), key=lambda kv: kv[1]["show"], reverse=True)]


def tally(order, runners, acc):
    top3 = {i for i, r in enumerate(runners) if r["finish_position"] <= 3}
    winner = next((i for i, r in enumerate(runners) if r["finish_position"] == 1), None)
    if winner is None:
        return
    picks = set(order[:3])
    acc["n"] += 1
    acc["win"] += int(order[0] == winner)
    acc["place"] += int(order[0] in top3)
    acc["prec"] += len(picks & top3) / 3.0
    acc["cover"] += int(winner in picks)


def main():
    conn = sqlite3.connect(DB)
    races = load_races(conn)
    dates = sorted({r[1] for r in races})
    print(f"Building leak-free stats for {len(dates)} dates...")
    sbd = {d: mc.build_stats(conn, before_date=d, venue=VENUE) for d in dates}

    # Pre-score every race (pure factors) + build feature matrix
    data = {}    # race_id -> (runners, X, win, date)
    samples_by_race = {}
    for rid, rdate, dist, cfg, rclass, going in races:
        comp = [e for e in load_entries(conn, rid) if e["finish_position"] is not None]
        if len(comp) < 4:
            continue
        runners = mc.score_race(comp, sbd[rdate], dist, cfg, race_class=rclass, going=going)
        if not runners:
            continue
        X, win = feature_matrix(runners)
        data[rid] = (runners, X, win, rdate)
        if X is not None:
            samples_by_race[rid] = (X, win)
    conn.close()

    start_date = races[START][1]
    test_ids = [r[0] for r in races if r[1] >= start_date and r[0] in data]
    test_dates = sorted({data[rid][3] for rid in test_ids})

    # Fixed rankers: model + market
    acc_model = dict(n=0, win=0, place=0, prec=0.0, cover=0)
    acc_market = dict(n=0, win=0, place=0, prec=0.0, cover=0)
    acc_blend = {l2: dict(n=0, win=0, place=0, prec=0.0, cover=0) for l2 in L2_GRID}

    # Train blend per test-date (cache by date)
    beta_by_date = {l2: {} for l2 in L2_GRID}
    for d in test_dates:
        train = [samples_by_race[r[0]] for r in races
                 if r[1] < d and r[0] in samples_by_race]
        for l2 in L2_GRID:
            beta_by_date[l2][d] = fit_logit(train, len(FEATURES), l2)

    for rid in test_ids:
        runners, X, win, d = data[rid]
        # model
        order = sorted(range(len(runners)), key=lambda i: runners[i]["show_pct"], reverse=True)
        tally(order, runners, acc_model)
        # market
        if X is not None:
            order = sorted(range(len(runners)),
                           key=lambda i: (runners[i].get("public_odds") or 9e9))
            tally(order, runners, acc_market)
            for l2 in L2_GRID:
                wp = logit_probs(X, beta_by_date[l2][d])
                order = harville_order_from_winprobs(wp)
                tally(order, runners, acc_blend[l2])

    def line(name, a):
        n = a["n"] or 1
        return (f"  {name:<12} {a['n']:>4} {a['win']/n*100:>7.1f}% "
                f"{a['place']/n*100:>8.1f}% {a['prec']/n*100:>9.1f}% "
                f"{a['cover']/n*100:>8.1f}%")

    print(f"\n{'='*72}")
    print(f"  WALK-FORWARD (test index {START}+, train-before-each-meeting, leak-free)")
    print(f"{'='*72}")
    print(f"  {'Ranker':<12} {'N':>4} {'#1 Win':>8} {'#1 Place':>9} {'Top3 Prec':>10} {'Coverage':>9}")
    print(f"  {'-'*68}")
    print(line("model", acc_model))
    print(line("market", acc_market))
    for l2 in L2_GRID:
        print(line(f"blend L2={l2:g}", acc_blend[l2]))
    print(f"{'='*72}")


if __name__ == "__main__":
    main()
