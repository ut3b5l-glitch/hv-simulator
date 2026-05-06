#!/usr/bin/env python3
"""
paper_trades.py
─────────────────────────────────────────────────────────────────────────────
View, settle, and analyse the paper_trades log.

Usage:
  python3 paper_trades.py            # summary + open trades
  python3 paper_trades.py --all      # full log (all settled + open)
  python3 paper_trades.py --settle   # settle open trades interactively
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = "happy_valley.db"


def connect():
    return sqlite3.connect(DB_PATH)


def load_trades(conn, only_open=False):
    where = "WHERE pt.result IS NULL" if only_open else ""
    return conn.execute(f"""
        SELECT pt.trade_id, pt.trade_date, r.race_number, r.distance_m, r.course_config,
               h.horse_name, pt.model_win_pct, pt.model_show_pct,
               pt.edge, pt.public_odds, pt.stake,
               pt.result, pt.finish_position, pt.profit
        FROM paper_trades pt
        JOIN races r  ON pt.race_id  = r.race_id
        JOIN horses h ON pt.horse_id = h.horse_id
        {where}
        ORDER BY pt.trade_date DESC, r.race_number, pt.trade_id
    """).fetchall()


def print_summary(conn):
    W = 80
    print("\n" + "=" * W)
    print("  PAPER TRADES — SUMMARY")
    print("=" * W)

    # Settled trades
    settled = conn.execute("""
        SELECT COUNT(*), SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END),
               SUM(profit), AVG(public_odds)
        FROM paper_trades WHERE result IS NOT NULL
    """).fetchone()
    n_total, n_wins, total_pnl, avg_odds = settled

    if n_total and n_total > 0:
        roi = total_pnl / n_total * 100
        strike = n_wins / n_total * 100
        print(f"\n  Settled bets : {n_total}")
        print(f"  Strike rate  : {strike:.1f}%  ({n_wins} wins)")
        print(f"  Avg odds     : {avg_odds:.1f}")
        print(f"  Total P&L    : {total_pnl:+.2f} units")
        print(f"  ROI          : {roi:+.1f}%")
    else:
        print("\n  No settled trades yet.")

    # Open trades
    open_n = conn.execute(
        "SELECT COUNT(*) FROM paper_trades WHERE result IS NULL"
    ).fetchone()[0]
    if open_n:
        print(f"\n  Open (pending) trades: {open_n}")
    print()


def print_trade_table(trades, label=""):
    W = 80
    if label:
        print(f"\n  {label}")
    print(f"  {'Date':10s}  {'R':>2}  {'Horse':<22} {'Win%':>5} {'Shw%':>5} {'Edge':>6} "
          f"{'Odds':>5}  {'Result':6}  {'P&L':>6}")
    print("  " + "-" * (W - 2))

    for row in trades:
        (tid, tdate, rno, dist, cfg, horse,
         win_pct, show_pct, edge, odds, stake,
         result, finish, profit) = row

        res_str  = result or "OPEN"
        pnl_str  = f"{profit:+.2f}" if profit is not None else "  -"
        fin_str  = f" (P{finish})" if finish else ""
        res_full = f"{res_str}{fin_str}"[:8]

        print(f"  {tdate:10s}  {rno:>2}  {horse:<22} "
              f"{win_pct or 0:>4.1f}%  {show_pct or 0:>4.1f}%  "
              f"{edge or 0:>+5.1f}%  {odds or 0:>4.1f}  "
              f"{res_full:<8}  {pnl_str:>6}")
    print()


def settle_interactive(conn):
    """
    For each open trade, prompt the user to enter the finish position.
    """
    open_trades = conn.execute("""
        SELECT pt.trade_id, pt.race_id, pt.horse_id, pt.public_odds,
               pt.trade_date, r.race_number, h.horse_name
        FROM paper_trades pt
        JOIN races r  ON pt.race_id  = r.race_id
        JOIN horses h ON pt.horse_id = h.horse_id
        WHERE pt.result IS NULL
        ORDER BY pt.trade_date, r.race_number
    """).fetchall()

    if not open_trades:
        print("  No open trades to settle.")
        return

    print(f"\n  Settling {len(open_trades)} open trade(s).\n")
    c = conn.cursor()
    settled = 0
    total_pnl = 0.0

    for trade_id, race_id, horse_id, odds, tdate, rno, horse in open_trades:
        raw = input(
            f"  {tdate} R{rno}  {horse:<22}  "
            f"(odds={odds or '?'})  Finish position (Enter to skip): "
        ).strip()
        if not raw:
            continue
        try:
            finish = int(raw)
        except ValueError:
            print("    [Invalid — enter a number]")
            continue

        won    = (finish == 1)
        profit = ((odds - 1.0) if won else -1.0) if odds else None
        c.execute("""
            UPDATE paper_trades
               SET result=?, finish_position=?, profit=?
             WHERE trade_id=?
        """, ("WIN" if won else "LOSS", finish, profit, trade_id))

        result_tag = "WIN  " if won else "LOSS "
        pnl_str    = f"{profit:+.2f}" if profit is not None else "N/A"
        print(f"    → {result_tag}  P{finish}  P&L: {pnl_str}")
        settled += 1
        if profit is not None:
            total_pnl += profit

    conn.commit()
    print(f"\n  {settled} trade(s) settled.  Race P&L: {total_pnl:+.2f} units")


def main():
    conn   = connect()
    args   = sys.argv[1:]
    settle = "--settle" in args
    show_all = "--all" in args

    print_summary(conn)

    if settle:
        settle_interactive(conn)
        # Refresh summary
        print_summary(conn)
    elif show_all:
        trades = load_trades(conn, only_open=False)
        if trades:
            print_trade_table(trades, label="ALL TRADES")
    else:
        # Show open trades by default
        trades = load_trades(conn, only_open=True)
        if trades:
            print_trade_table(trades, label="OPEN (PENDING) TRADES")
        else:
            print("  No open trades.")

    conn.close()


if __name__ == "__main__":
    main()
