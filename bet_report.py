#!/usr/bin/env python3
"""
bet_report.py — Betting P&L for a meeting, following the model's predictions.

Runs as the final step after reconciliation (results_agent). Reads
predictions_<date>.json (model picks) + results_<date>.json (finishers +
per-race official dividends) and computes flat-stake P&L for four strategies,
all betting ONLY the model's top-3 picks:

  1. WIN          — HK$10 on the #1 pick                       (10/race)
  2. PLACE        — HK$10 on each of the top-3 picks to top-3  (30/race)
  3. QUINELLA     — HK$10 box of the 3 picks (3 pairs)         (30/race)
  4. QUINELLA PLACE — HK$10 box of the 3 picks (3 pairs)       (30/race)

HKJC dividends are quoted per HK$10 and INCLUDE the stake, so a $10 bet that
returns a "$13.00" dividend yields $3 profit. Place pays top-3 (fields of 7+).

Usage:
  python3 bet_report.py [YYYY-MM-DD]      # default: last Wednesday
  from bet_report import report; report("2026-06-03")
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from itertools import combinations
from pathlib import Path

UNIT = 10.0  # HK$ per bet


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load(name: str) -> dict | None:
    p = Path(__file__).parent / name
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _combo_set(combo: str) -> frozenset[int]:
    """'4,10' -> {4, 10};  '4' -> {4}."""
    return frozenset(int(x) for x in str(combo).replace(" ", "").split(",") if x.strip().isdigit())


def _div_map(pool_entries: list[dict]) -> dict[frozenset[int], float]:
    """[{'combo':'4,10','div':102.0}, ...] -> {frozenset({4,10}): 102.0, ...}."""
    out: dict[frozenset[int], float] = {}
    for e in pool_entries or []:
        cs = _combo_set(e.get("combo", ""))
        d = e.get("div")
        if cs and d is not None:
            out[cs] = float(d)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Core computation
# ─────────────────────────────────────────────────────────────────────────────

def compute(meeting_date: str) -> dict | None:
    """Return a structured P&L dict, or None if inputs are missing."""
    preds = _load(f"predictions_{meeting_date}.json")
    res   = _load(f"results_{meeting_date}.json")
    if not preds or not res:
        return None

    preds_by_race = {r["race_number"]: r for r in preds.get("races", [])}

    strategies = {
        "win_top1":          {"label": "WIN on #1 pick",            "stake_per_race": UNIT,     "per_race": [], "staked": 0.0, "returned": 0.0},
        "place_box3":        {"label": "PLACE — all 3 picks",       "stake_per_race": 3 * UNIT, "per_race": [], "staked": 0.0, "returned": 0.0},
        "quinella_box3":     {"label": "QUINELLA box (3 picks)",    "stake_per_race": 3 * UNIT, "per_race": [], "staked": 0.0, "returned": 0.0},
        "quinella_place_box3": {"label": "QUINELLA PLACE box (3 picks)", "stake_per_race": 3 * UNIT, "per_race": [], "staked": 0.0, "returned": 0.0},
    }

    for race in res.get("races", []):
        rno = race["race_number"]
        pred = preds_by_race.get(rno)
        div = race.get("dividends") or {}
        if not pred or not div:
            continue  # need both model picks and official dividends

        # Model's top-3 picks, with horse numbers
        picks = sorted(pred.get("runners", []), key=lambda r: r.get("rank", 99))[:3]
        pick_nos = [p.get("horse_no") for p in picks if p.get("horse_no") is not None]
        pick_names = {p.get("horse_no"): p.get("horse_name") for p in picks}
        if len(pick_nos) < 3:
            continue
        pick_set = set(pick_nos)

        # Actual finish: number -> position
        pos_by_no = {f.get("horse_no"): f.get("position")
                     for f in race.get("finishers", []) if f.get("horse_no") is not None}
        winner_no = next((n for n, p in pos_by_no.items() if p == 1), None)
        top3_nos = {n for n, p in pos_by_no.items() if p in (1, 2, 3)}

        win_map = _div_map(div.get("WIN"))
        place_map = _div_map(div.get("PLACE"))            # frozenset({no}) -> div
        quin_map = _div_map(div.get("QUINELLA"))          # frozenset({a,b}) -> div (1 winning combo)
        qpl_map = _div_map(div.get("QUINELLA PLACE"))     # 3 winning combos

        # 1) WIN on #1 pick
        p1 = pick_nos[0]
        win_ret = win_map.get(frozenset({p1}), 0.0) if p1 == winner_no else 0.0
        _record(strategies["win_top1"], rno, UNIT, win_ret,
                detail=(f"{pick_names.get(p1,'')} won" if win_ret else f"{pick_names.get(p1,'')} — no"))

        # 2) PLACE on each of the 3 picks
        place_ret = sum(place_map.get(frozenset({n}), 0.0) for n in pick_nos)
        placed = [pick_names.get(n) for n in pick_nos if n in top3_nos]
        _record(strategies["place_box3"], rno, 3 * UNIT, place_ret,
                detail=(f"{len(placed)}/3 placed" if placed else "0/3"))

        # 3) QUINELLA box (3 pairs): win the single 1st+2nd combo iff it's inside picks
        quin_ret = 0.0
        for combo, d in quin_map.items():
            if combo <= pick_set:
                quin_ret += d
        _record(strategies["quinella_box3"], rno, 3 * UNIT, quin_ret,
                detail=("hit" if quin_ret else "miss"))

        # 4) QUINELLA PLACE box (3 pairs): each of my pairs that is a winning QPL combo pays
        my_pairs = {frozenset(c) for c in combinations(pick_nos, 2)}
        qpl_ret = sum(d for combo, d in qpl_map.items() if combo in my_pairs)
        qpl_hits = sum(1 for combo in qpl_map if combo in my_pairs)
        _record(strategies["quinella_place_box3"], rno, 3 * UNIT, qpl_ret,
                detail=(f"{qpl_hits} combo(s)" if qpl_hits else "miss"))

    # Finalise totals
    for s in strategies.values():
        s["net"] = round(s["returned"] - s["staked"], 2)
        s["roi_pct"] = round(100 * s["net"] / s["staked"], 1) if s["staked"] else 0.0
        s["returned"] = round(s["returned"], 2)
        s["staked"] = round(s["staked"], 2)

    return {"meeting_date": meeting_date, "unit": UNIT, "strategies": strategies}


def _record(strat: dict, rno: int, stake: float, ret: float, detail: str = ""):
    strat["staked"] += stake
    strat["returned"] += ret
    strat["per_race"].append({"race": rno, "stake": stake,
                              "return": round(ret, 2), "net": round(ret - stake, 2),
                              "detail": detail})


# ─────────────────────────────────────────────────────────────────────────────
# Report
# ─────────────────────────────────────────────────────────────────────────────

def report(meeting_date: str) -> dict | None:
    """Compute, print, and persist the betting P&L. Returns the data dict."""
    data = compute(meeting_date)
    if not data:
        print("  [bet-report] predictions/results not found — skipped.")
        return None

    W = 64
    print(f"\n  {'─'*W}")
    print(f"  BETTING P&L  {meeting_date}  (flat HK${UNIT:.0f}, following model top-3)")
    print(f"  {'─'*W}")
    print("  Dividends are per HK$10 and include the stake.\n")

    order = ["win_top1", "place_box3", "quinella_place_box3", "quinella_box3"]
    print(f"  {'Strategy':<28} {'Staked':>8} {'Return':>9} {'Net':>9} {'ROI':>7}")
    print(f"  {'-'*28} {'-'*8} {'-'*9} {'-'*9} {'-'*7}")
    for key in order:
        s = data["strategies"][key]
        flag = "✅" if s["net"] > 0 else ("➖" if s["net"] == 0 else "❌")
        print(f"  {s['label']:<28} {s['staked']:>8.0f} {s['returned']:>9.2f} "
              f"{s['net']:>+9.2f} {s['roi_pct']:>6.1f}% {flag}")

    best = max(data["strategies"].values(), key=lambda s: s["net"])
    print(f"\n  Best play: {best['label']}  ({best['net']:+.2f} HK$, ROI {best['roi_pct']:+.1f}%)")
    print(f"  {'─'*W}\n")

    out = Path(__file__).parent / f"bet_report_{meeting_date}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Bet report saved → {out.name}")
    return data


def _last_wednesday(d: date) -> date:
    return d - timedelta(days=(d.weekday() - 2) % 7)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else _last_wednesday(date.today()).isoformat()
    report(arg)
