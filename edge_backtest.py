#!/usr/bin/env python3
"""
edge_backtest.py — large-sample stress test of "the one edge": WIN on the
model's #1 pick, flat stake, over ALL historical races for a venue.

Leak-free: reuses validate_blend's expanding-window blend (coefficients trained
only on races strictly before each test meeting) and model_core scoring. This is
the honest, large-N replacement for the 3-meeting (24-race) live figure.

Compares three rankers' #1-pick WIN ROI:
  • blend   — race-grouped conditional logit (the live model)
  • market  — de-vigged public odds (always back the favourite)
  • model   — pure 9-factor chain (Harville show%)

The only number that matters commercially: does BLEND #1 beat MARKET #1?
If they tie, the "edge" is just riding the favourite (no sellable alpha).

Outputs a console table and (optionally) merges a per-venue result block into a
JSON artifact (default win_edge.json) that export_data.py publishes to the PWA.

Usage:
  python3 edge_backtest.py                       # HV, print only
  python3 edge_backtest.py --venue ST --start 600
  python3 edge_backtest.py --venue HV --json     # write/merge win_edge.json
  python3 edge_backtest.py --venue ST --json
"""
import argparse
import json
import os
import sqlite3
from datetime import datetime, timezone

import model_core as mc
import validate_blend as vb

JSON_PATH = "win_edge.json"


def compute(venue, start, stake, db):
    """Run the leak-free walk-forward and return a result dict for `venue`."""
    vb.VENUE = venue
    conn = sqlite3.connect(db)
    races = vb.load_races(conn)
    if not races:
        conn.close()
        return None
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

    # Train blend per test date; pick best L2 by binary log-loss (matches validate_blend)
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

    def settle(pick_idx, runners):
        r = runners[pick_idx]
        odds = r.get("public_odds")
        if r["finish_position"] == 1 and odds and odds > 0:
            return stake * (odds - 1.0)
        return -stake

    books = {"blend": [], "market": [], "model": []}
    agree, disagree = [], []
    for rid in test_ids:
        runners, X, win, d = data[rid]
        if X is not None:
            wp = vb.logit_probs(X, beta_by_date[best_l2][d])
            blend_pick = vb.harville_order_from_winprobs(wp)[0]
            mkt_pick = min(range(len(runners)),
                           key=lambda i: (runners[i].get("public_odds") or 9e9))
            books["blend"].append(settle(blend_pick, runners))
            books["market"].append(settle(mkt_pick, runners))
            (agree if blend_pick == mkt_pick else disagree).append(
                settle(blend_pick, runners))
        model_pick = max(range(len(runners)), key=lambda i: runners[i]["show_pct"])
        books["model"].append(settle(model_pick, runners))

    def summarize(pnl):
        n = len(pnl)
        if not n:
            return None
        wins = sum(1 for x in pnl if x > 0)
        profit = round(sum(pnl), 2)
        staked = n * stake
        return {"bets": n, "wins": wins, "win_pct": round(wins / n * 100, 1),
                "staked": staked, "returned": round(staked + profit, 2),
                "profit": profit, "roi_pct": round(profit / staked * 100, 2)}

    rankers = {k: summarize(v) for k, v in books.items()}
    edge_gap = (rankers["blend"]["roi_pct"] - rankers["market"]["roi_pct"]
                if rankers.get("blend") and rankers.get("market") else None)
    verdict = ("real_edge" if edge_gap is not None and edge_gap > 1.0
               else "rides_market" if edge_gap is not None and edge_gap > -1.0
               else "worse_than_market" if edge_gap is not None else None)

    return {
        "venue": venue,
        "stake": stake,
        "best_l2": best_l2,
        "n_races": len(test_ids),
        "n_meetings": len(test_dates),
        "from_date": start_date,
        "rankers": rankers,
        "edge_gap_pts": round(edge_gap, 2) if edge_gap is not None else None,
        "verdict": verdict,
        "selective": {
            "agree": summarize(agree),
            "disagree": summarize(disagree),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def print_report(res):
    print(f"\n=== {res['venue']}: WIN on #1 pick, flat ${res['stake']:g}, "
          f"leak-free (best L2={res['best_l2']}) ===")
    print(f"{'ranker':8} {'bets':>5} {'wins':>5} {'win%':>6} "
          f"{'staked':>9} {'returned':>9} {'profit':>9} {'ROI':>8}")
    for name in ("blend", "market", "model"):
        r = res["rankers"].get(name)
        if not r:
            continue
        print(f"{name:8} {r['bets']:5d} {r['wins']:5d} {r['win_pct']:5.1f}% "
              f"${r['staked']:8.0f} ${r['returned']:8.0f} "
              f"${r['profit']:+8.1f} {r['roi_pct']:+7.2f}%")
    if res["edge_gap_pts"] is not None:
        label = {"real_edge": "REAL edge over the market",
                 "rides_market": "NO meaningful edge (rides the favourite)",
                 "worse_than_market": "WORSE than the favourite"}[res["verdict"]]
        print(f"\nBlend #1 vs Market #1 ROI gap: {res['edge_gap_pts']:+.2f} pts  →  {label}")
    print("\n=== Selective: blend #1 vs market favourite ===")
    for key, label in (("agree", "agree (blend=fav)"),
                       ("disagree", "DISAGREE (blend!=fav)")):
        s = res["selective"][key]
        if s:
            print(f"{label:24} n={s['bets']:4d}  win%={s['win_pct']:5.1f}  "
                  f"profit=${s['profit']:+8.1f}  ROI={s['roi_pct']:+7.2f}%")


def write_json(res, path=JSON_PATH):
    """Merge this venue's result into the shared artifact, keyed by venue."""
    blob = {}
    if os.path.exists(path):
        try:
            with open(path) as f:
                blob = json.load(f)
        except (json.JSONDecodeError, OSError):
            blob = {}
    blob.setdefault("venues", {})[res["venue"]] = res
    blob["generated_at"] = res["generated_at"]
    with open(path, "w") as f:
        json.dump(blob, f, indent=2)
    print(f"\nMerged {res['venue']} into {path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--venue", default="HV")
    ap.add_argument("--start", type=int, default=400)
    ap.add_argument("--stake", type=float, default=10.0)
    ap.add_argument("--db", default="happy_valley.db")
    ap.add_argument("--json", action="store_true",
                    help=f"write/merge result into {JSON_PATH}")
    args = ap.parse_args()
    res = compute(args.venue, args.start, args.stake, args.db)
    if res is None:
        print(f"No races for venue={args.venue}.")
    else:
        print(f"[{args.venue}] {res['n_races']} test races / "
              f"{res['n_meetings']} meetings (from {res['from_date']}).")
        print_report(res)
        if args.json:
            write_json(res)
