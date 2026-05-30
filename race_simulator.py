#!/usr/bin/env python3
"""
race_simulator.py
─────────────────────────────────────────────────────────────────────────────
Simulate any race already in the DB using model_core (Phase A + B).

Usage:
  python3 race_simulator.py <race_id>
  python3 race_simulator.py <YYYY-MM-DD> <race_number>

All factor logic lives in model_core.py — this script only handles
DB lookups, display, and the optional Monte Carlo convergence check.
"""

import sqlite3
import sys
import random
from pathlib import Path

import model_core as mc

DB_PATH = Path("happy_valley.db")


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────────────────────

def find_race_id(conn, date_str, race_no):
    row = conn.execute(
        "SELECT race_id FROM races WHERE race_date=? AND race_number=?",
        (date_str, race_no)
    ).fetchone()
    return row[0] if row else None


def get_race_info(conn, race_id):
    return conn.execute(
        "SELECT race_date, venue, race_number, distance_m, course_config, "
        "race_class, going, field_size "
        "FROM races WHERE race_id=?", (race_id,)
    ).fetchone()


def get_entries(conn, race_id):
    """Return entries in score_race() format, including all Phase B fields."""
    rows = conn.execute("""
        SELECT e.horse_id, h.horse_name, e.barrier, e.horse_no,
               e.jockey_id, j.jockey_name,
               e.trainer_id, t.trainer_name,
               e.weight, e.public_odds, e.finish_position,
               e.official_rating, e.rating_change,
               e.days_since_last_run, e.last_6_runs
        FROM race_entries e
        JOIN horses  h ON e.horse_id  = h.horse_id
        JOIN jockeys j ON e.jockey_id = j.jockey_id
        JOIN trainers t ON e.trainer_id = t.trainer_id
        WHERE e.race_id = ?
        ORDER BY e.barrier
    """, (race_id,)).fetchall()
    return [
        {
            "horse_id":            r[0],
            "horse_name":          r[1],
            "barrier":             r[2],
            "horse_no":            r[3],
            "jockey_id":           r[4],
            "jockey_name":         r[5],
            "trainer_id":          r[6],
            "trainer_name":        r[7],
            "weight":              r[8],
            "public_odds":         r[9],
            "finish_position":     r[10],
            "official_rating":     r[11],
            "rating_change":       r[12],
            "days_since_last_run": r[13],
            "last_6_runs":         r[14],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Display
# ─────────────────────────────────────────────────────────────────────────────

def print_race_header(info, n_runners):
    race_date, venue, race_no, dist, cfg, race_class, going, field_size = info
    W = 80
    print(f"\n{'='*W}")
    print(f"  RACE SIMULATOR  |  {venue} Race {race_no}  |  {dist}m Course {cfg}")
    going_str  = going or "?"
    class_str  = race_class or "Class ?"
    print(f"  Date: {race_date}  |  {class_str}  |  Going: {going_str}  |  "
          f"{n_runners} runners")
    print(f"{'='*W}")


def print_predictions(runners, base_rate, class_base_rate, race_class):
    W = 80
    print(f"\n  Base win rate (global):              {base_rate:.2%}")
    if race_class:
        print(f"  Base win rate ({race_class:10s}):      {class_base_rate:.2%}")

    has_results = any(r.get("finish_position") for r in runners)
    has_odds    = any(r.get("public_odds")     for r in runners)
    has_phase_b = any(r.get("official_rating") for r in runners)

    # ── Top-3 predictions ───────────────────────────────────────────────────
    print(f"\n  {'#':<3} {'No':>3} {'Horse':<22} {'Bar':>3}", end="")
    if has_phase_b:
        print(f"  {'Rtg':>3} {'Days':>4}", end="")
    print(f"  {'Win%':>5} {'Plc%':>5} {'Shw%':>5}", end="")
    if has_odds:
        print(f"  {'Mkt%':>5} {'Edge':>6}", end="")
    if has_results:
        print(f"  {'Act':>4}", end="")
    print()
    print("  " + "-" * (W - 2))

    for rank, r in enumerate(runners, 1):
        marker = "★ " if rank <= 3 else "  "
        hno = r.get("horse_no") or ""
        line = (f"  {marker}{rank:<2} {hno:>3} {r['horse_name']:<22} {r['barrier']:>3}")
        if has_phase_b:
            rtg  = f"{r.get('official_rating') or '':>3}"
            days = f"{r.get('days_since_last_run') or '':>4}"
            line += f"  {rtg}  {days}"
        line += (f"  {r['win_pct']:>4.1f}%  {r['place_pct']:>4.1f}%  {r['show_pct']:>4.1f}%")
        if has_odds:
            mkt  = r.get("market_pct") or 0
            edge = r.get("edge") or 0
            val  = " ◀" if r.get("is_value") else ""
            line += f"  {mkt:>4.1f}%  {edge:>+5.1f}%{val}"
        if has_results:
            fin = r.get("finish_position")
            line += f"  {'P'+str(fin) if fin else '?':>4}"
        print(line)

    # ── Factor breakdown ────────────────────────────────────────────────────
    print(f"\n  {'#':<3} {'No':>3} {'Horse':<22} {'BIV':>5} {'Joc':>5} {'Tra':>5} "
          f"{'Hrs':>5} {'Frm':>5} {'Cls':>5} {'WtC':>5}", end="")
    if has_phase_b:
        print(f"  {'Rtg':>5} {'Day':>5}", end="")
    print()
    print("  " + "-" * (W - 2))
    for rank, r in enumerate(runners, 1):
        marker = "★ " if rank <= 3 else "  "
        hno = r.get("horse_no") or ""
        line = (f"  {marker}{rank:<2} {hno:>3} {r['horse_name']:<22} "
                f"{r['b_iv']:>4.2f}  {r['jf']:>4.2f}  {r['tf']:>4.2f}  "
                f"{r['hf']:>4.2f}  {r['ff']:>4.2f}  {r.get('cf', 1.0):>4.2f}  "
                f"{r.get('wcf', 1.0):>4.2f}")
        if has_phase_b:
            line += f"  {r['rtf']:>4.2f}  {r['df']:>4.2f}"
        print(line)

    # ── Value bets ──────────────────────────────────────────────────────────
    if has_odds:
        value = [r for r in runners if r.get("is_value")]
        print()
        if value:
            print(f"  VALUE BETS  (edge >{mc.EDGE_THRESHOLD:.0f}%  model >{mc.MIN_MODEL_PCT:.0f}%)")
            print(f"  {'Horse':<22} {'Win%':>5} {'Mkt%':>5} {'Edge':>6} {'Odds':>6}")
            print("  " + "-" * 50)
            for r in sorted(value, key=lambda x: x["edge"], reverse=True):
                print(f"  {r['horse_name']:<22} "
                      f"{r['win_pct']:>4.1f}%  "
                      f"{r['market_pct']:>4.1f}%  "
                      f"{r['edge']:>+5.1f}%  "
                      f"{r.get('public_odds') or 0:>5.1f}")
        else:
            print("  No value bets detected.")


def print_monte_carlo(runners, n_sims=10_000):
    """
    Monte Carlo convergence check: Harville analytic probs should match
    simulation win% closely. Kept for transparency / educational use.
    """
    print(f"\n  Monte Carlo ({n_sims:,} draws) — should converge to Model Win%:")
    names   = [r["horse_name"] for r in runners]
    weights = [r["raw_score"]  for r in runners]

    mc_wins = {n: 0 for n in names}
    for _ in range(n_sims):
        draws = []
        for n, w in zip(names, weights):
            draws.append((n, random.random() ** (1.0 / w) if w > 0 else -1.0))
        draws.sort(key=lambda x: x[1], reverse=True)
        mc_wins[draws[0][0]] += 1

    print(f"  {'Horse':<22} {'Model Win%':>10} {'MC Win%':>8}")
    print("  " + "-" * 44)
    for r in runners:
        name   = r["horse_name"]
        model  = r["win_pct"]
        sim    = mc_wins[name] / n_sims * 100
        diff   = abs(model - sim)
        flag   = " !" if diff > 2.0 else ""
        print(f"  {name:<22} {model:>9.1f}%  {sim:>7.1f}%{flag}")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def simulate(race_id, run_mc=False, n_sims=10_000):
    conn = sqlite3.connect(DB_PATH)
    info = get_race_info(conn, race_id)
    if not info:
        print(f"Race ID {race_id} not found.")
        conn.close()
        return

    race_date, venue, race_no, dist, cfg, race_class, going, field_size = info

    entries = get_entries(conn, race_id)
    if not entries:
        print("No entries found.")
        conn.close()
        return

    print_race_header(info, len(entries))

    # Build stats up to (but not including) race day — strict pre-race only
    stats = mc.build_stats(conn, before_date=race_date, venue=venue)

    runners = mc.score_race(entries, stats, dist, cfg, race_class=race_class, going=going, blend_coef="auto")
    if not runners:
        print("Could not score race (no valid entries).")
        conn.close()
        return

    base_rate       = stats["base_rate"]
    class_base_rate = stats["base_rate_by_class"].get(race_class, base_rate)

    print_predictions(runners, base_rate, class_base_rate, race_class)

    if run_mc:
        print_monte_carlo(runners, n_sims)

    print(f"\n{'='*80}\n")
    conn.close()


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 race_simulator.py <race_id>")
        print("  python3 race_simulator.py <YYYY-MM-DD> <race_number>")
        print("  python3 race_simulator.py <race_id> --mc   # include Monte Carlo check")
        sys.exit(1)

    run_mc = "--mc" in sys.argv
    args   = [a for a in sys.argv[1:] if not a.startswith("--")]

    conn = sqlite3.connect(DB_PATH)
    if len(args) == 1:
        rid = int(args[0])
    else:
        rid = find_race_id(conn, args[0], int(args[1]))
    conn.close()

    if not rid:
        print("Race not found in database.")
        sys.exit(1)

    simulate(rid, run_mc=run_mc)


if __name__ == "__main__":
    main()
