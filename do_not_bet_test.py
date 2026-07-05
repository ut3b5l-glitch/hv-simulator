#!/usr/bin/env python3
"""
do_not_bet_test.py — RESEARCH (read-only): is there a pre-race signal that tells
us which races NOT to bet?

Leak-free walk-forward, per venue, WIN pool. Mirrors edge_backtest.py's expanding
window exactly so the "bet every race" row reconciles with win_edge.json's blend
ROI. On top of that it:

  1. Extracts per-race PRE-RACE features (computable at bet time):
       p1        - blend top win prob            (separability)
       gap       - p1 - p2                        (separability)
       entropy   - Shannon entropy of blend dist  (separability; lower=sharper)
       tv        - 0.5*sum|blend_p - market_p|    (model<->market disagreement)
       fav_odds  - shortest price in race          (favourite strength)
       pick_odds - price of the horse we bet
       nfield    - field size
       overround - sum(1/odds)-1                   (market sharpness/dispersion)
       agree     - does blend #1 == market favourite

  2. For each signal + hypothesised direction, sweeps coverage (bet only the
     "keep" fraction) and reports n, ROI, and a bootstrap 95% CI on ROI.
     The question: does ANY subset's CI lower bound clear 0 (positive EV) — or
     even clearly beat the bet-everything baseline?

  3. Elimination diagnostic (exotics precursor): of runners the blend rates as
     no-hopers (win prob below a threshold), what fraction actually hit top-3,
     and how many can we eliminate per race at a tolerable false-cut rate?

Nothing is written to the DB or model. Pure analysis.

Usage:
  python3 do_not_bet_test.py --venue HV
  python3 do_not_bet_test.py --venue ST
"""
import argparse
import sqlite3

import numpy as np

import model_core as mc
import validate_blend as vb

STAKE = 10.0
COVERAGES = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]
N_BOOT = 10000


def roi_ci(pnls, stake=STAKE, n_boot=N_BOOT, seed=0):
    a = np.asarray(pnls, float)
    n = len(a)
    if n == 0:
        return None
    roi = a.sum() / (n * stake) * 100.0
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, n, size=(n_boot, n))
    boot = a[idx].sum(axis=1) / (n * stake) * 100.0
    lo, hi = np.percentile(boot, [2.5, 97.5])
    wins = int((a > 0).sum())
    return dict(n=n, wins=wins, roi=roi, lo=lo, hi=hi)


def build(venue, start, db):
    """Leak-free walk-forward (copied structure from edge_backtest.compute)."""
    vb.VENUE = venue
    conn = sqlite3.connect(db)
    races = vb.load_races(conn)
    dates = sorted({r[1] for r in races})
    sbd = {d: mc.build_stats(conn, before_date=d, venue=venue) for d in dates}

    data, samples_by_race = {}, {}
    for rid, rdate, dist, cfg, rclass, going in races:
        comp = [e for e in vb.load_entries(conn, rid)
                if e["finish_position"] is not None]
        if len(comp) < 4:
            continue
        runners = mc.score_race(comp, sbd[rdate], dist, cfg,
                                race_class=rclass, going=going)
        if not runners:
            continue
        X, win = vb.feature_matrix(runners)
        data[rid] = (runners, X, win, rdate)
        if X is not None:
            samples_by_race[rid] = (X, win)
    conn.close()

    if start >= len(races):
        start = max(0, len(races) // 2)
    start_date = races[start][1]
    test_ids = [r[0] for r in races if r[1] >= start_date and r[0] in data]
    test_dates = sorted({data[rid][3] for rid in test_ids})

    beta_by_date = {l2: {} for l2 in vb.L2_GRID}
    bag = {l2: {"p": [], "y": [], "mlogloss": []} for l2 in vb.L2_GRID}
    for d in test_dates:
        train = [samples_by_race[r[0]] for r in races
                 if r[1] < d and r[0] in samples_by_race]
        for l2 in vb.L2_GRID:
            beta_by_date[l2][d] = vb.fit_logit(train, len(vb.FEATURES), l2)
    for rid in test_ids:
        runners, X, win, d = data[rid]
        if X is None:
            continue
        for l2 in vb.L2_GRID:
            wp = vb.logit_probs(X, beta_by_date[l2][d])
            vb.collect_probs(list(wp), runners, bag[l2])
    best_l2 = min(vb.L2_GRID,
                  key=lambda l2: vb.brier_logloss(bag[l2])[1] if bag[l2]["p"] else 9e9)

    rows, elim = [], []
    for rid in test_ids:
        runners, X, win, d = data[rid]
        if X is None:
            continue
        wp = np.asarray([float(x) for x in vb.logit_probs(X, beta_by_date[best_l2][d])])
        order = vb.harville_order_from_winprobs(wp)
        pick = order[0]
        odds = runners[pick].get("public_odds")
        pnl = (STAKE * (odds - 1.0)
               if runners[pick]["finish_position"] == 1 and odds and odds > 0
               else -STAKE)

        srt = np.sort(wp)[::-1]
        p1 = float(srt[0])
        p2 = float(srt[1]) if len(srt) > 1 else 0.0
        ent = float(-np.sum(wp * np.log(np.clip(wp, 1e-12, 1.0))))
        mkt = vb.devig(runners)
        mktarr = np.asarray([mkt[r["horse_id"]] for r in runners])
        tv = 0.5 * float(np.sum(np.abs(wp - mktarr)))
        prices = [r["public_odds"] for r in runners if r.get("public_odds")]
        fav_odds = min(prices)
        overround = float(sum(1.0 / p for p in prices) - 1.0)
        mkt_fav = min(range(len(runners)),
                      key=lambda i: runners[i].get("public_odds") or 9e9)
        rows.append(dict(pnl=pnl, p1=p1, gap=p1 - p2, entropy=ent, tv=tv,
                         fav_odds=fav_odds, pick_odds=float(odds or 0.0),
                         nfield=len(runners), overround=overround,
                         agree=int(pick == mkt_fav)))
        for i, r in enumerate(runners):
            elim.append((float(wp[i]), 1 if r["finish_position"] <= 3 else 0))

    return dict(venue=venue, best_l2=best_l2, n_meetings=len(test_dates),
                from_date=start_date, rows=rows, elim=elim)


def sweep(rows, key, keep):
    vals = np.asarray([r[key] for r in rows], float)
    pnls = np.asarray([r["pnl"] for r in rows], float)
    order = np.argsort(vals)
    if keep == "high":
        order = order[::-1]
    out = []
    for cov in COVERAGES:
        k = max(1, int(round(cov * len(rows))))
        sel = order[:k]
        out.append((cov, roi_ci(list(pnls[sel]))))
    return out


def print_sweep(title, hypothesis, swept):
    print(f"\n  {title}  — keep {hypothesis}")
    print(f"  {'cover':>6} {'bets':>5} {'wins':>5} {'ROI%':>8} "
          f"{'95% CI (bootstrap)':>22} {'CI clears 0?':>13}")
    print(f"  {'-'*64}")
    for cov, ci in swept:
        if not ci:
            continue
        flag = "YES +EV" if ci["lo"] > 0 else ("worse" if ci["hi"] < 0 else "no")
        print(f"  {cov*100:>5.0f}% {ci['n']:>5d} {ci['wins']:>5d} "
              f"{ci['roi']:>+7.2f}% [{ci['lo']:>+6.1f}, {ci['hi']:>+6.1f}] {flag:>13}")


def elimination(elim, venue, n_races):
    print(f"\n{'='*68}")
    print(f"  ELIMINATION DIAGNOSTIC — {venue} (exotics precursor)")
    print(f"  Can the blend reliably flag no-hopers? Of runners below a win-prob")
    print(f"  cut, how many actually finished top-3 (a 'bad cut')?")
    print(f"{'='*68}")
    arr = np.asarray(elim)  # (winprob, is_top3)
    wp, top3 = arr[:, 0], arr[:, 1]
    total_runners = len(wp)
    print(f"  {'cut <':>7} {'flagged':>8} {'%field':>7} {'top3 among cut':>16} "
          f"{'per race':>9}")
    print(f"  {'-'*56}")
    for cut in [0.005, 0.01, 0.02, 0.03, 0.05, 0.08]:
        m = wp < cut
        flagged = int(m.sum())
        if flagged == 0:
            continue
        bad = float(top3[m].mean()) * 100.0
        per_race = flagged / n_races
        print(f"  {cut*100:>5.1f}% {flagged:>8d} {flagged/total_runners*100:>6.1f}% "
              f"{bad:>14.1f}% {per_race:>9.2f}")
    print(f"\n  Read: a low 'top3 among cut' = safe to eliminate. 'per race' = how"
          f"\n  many horses you can strike out, shrinking the exotic combinatorics.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--venue", default="HV", choices=["HV", "ST"])
    ap.add_argument("--start", type=int, default=400)
    ap.add_argument("--db", default="happy_valley.db")
    args = ap.parse_args()

    res = build(args.venue, args.start, args.db)
    rows = res["rows"]
    n = len(rows)
    base = roi_ci([r["pnl"] for r in rows])

    print(f"\n{'='*68}")
    print(f"  DO-NOT-BET WALK-FORWARD — {args.venue}  (WIN pool, blend #1, "
          f"flat ${STAKE:g})")
    print(f"  {n} races / {res['n_meetings']} meetings from {res['from_date']}  "
          f"(best L2={res['best_l2']:g})")
    print(f"{'='*68}")
    print(f"  BASELINE — bet every race: {base['n']} bets, "
          f"ROI {base['roi']:+.2f}%  CI [{base['lo']:+.1f}, {base['hi']:+.1f}]")
    print(f"  (reconcile vs win_edge.json blend ROI for this venue)")

    # Each signal with its hypothesised "bettable" direction.
    plan = [
        ("p1  (blend top win prob)", "p1", "high", "sharper favourite"),
        ("gap (p1 - p2)", "gap", "high", "clearer standout"),
        ("entropy (blend dist)", "entropy", "low", "more separable race"),
        ("tv  (model<->market disagree)", "tv", "high", "value/overlay thesis"),
        ("fav_odds (shortest price)", "fav_odds", "low", "strong favourite"),
        ("fav_odds (shortest price)", "fav_odds", "high", "open race"),
        ("nfield (field size)", "nfield", "low", "fewer runners"),
        ("overround", "overround", "low", "sharper market"),
    ]
    for title, key, keep, why in plan:
        print_sweep(f"{title}  [{why}]", keep, sweep(rows, key, keep))

    # Agree vs disagree (reconcile with win_edge.json selective block)
    agree = [r["pnl"] for r in rows if r["agree"]]
    disagree = [r["pnl"] for r in rows if not r["agree"]]
    print(f"\n  AGREE vs DISAGREE (reconcile vs win_edge.json):")
    for label, pnls in (("agree (blend=fav)", agree), ("DISAGREE", disagree)):
        ci = roi_ci(pnls)
        if ci:
            print(f"    {label:18} n={ci['n']:>4} ROI {ci['roi']:+7.2f}%  "
                  f"CI [{ci['lo']:+6.1f}, {ci['hi']:+6.1f}]")

    elimination(res["elim"], args.venue, n)
    print()


if __name__ == "__main__":
    main()
