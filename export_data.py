#!/usr/bin/env python3
"""
export_data.py — Build the JSON snapshot consumed by the web/ PWA.

Reads:
  - happy_valley.db
  - predictions_YYYY-MM-DD.json    (one per meeting, in project root)
  - results_YYYY-MM-DD.json        (one per meeting, in project root)

Writes (under web/public/data/):
  - meetings.json                  index of meetings (date, races, hit-rate, etc.)
  - meetings/<date>.json           per-meeting full prediction + actual results
  - performance.json               aggregate ROI / hit-rate / trailing form / walk-forward
  - profiles.json                  horses / jockeys / trainers summary lists

Run after each meeting:  python export_data.py
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent
DB_PATH = ROOT / "happy_valley.db"
OUT = ROOT / "web" / "public" / "data"


def jload(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def jdump(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, indent=2, default=str), encoding="utf-8")


def find_meeting_dates() -> list[str]:
    """All dates that have at least a predictions file."""
    dates = set()
    for p in ROOT.glob("predictions_*.json"):
        try:
            dates.add(p.stem.replace("predictions_", ""))
        except Exception:
            pass
    return sorted(dates, reverse=True)


def load_predictions(date: str) -> dict | None:
    p = ROOT / f"predictions_{date}.json"
    return jload(p) if p.exists() else None


def load_results(date: str) -> dict | None:
    p = ROOT / f"results_{date}.json"
    return jload(p) if p.exists() else None


def merge_meeting(date: str) -> dict | None:
    """Merge predictions + results for one meeting into a single record."""
    preds = load_predictions(date)
    if not preds:
        return None
    results = load_results(date)

    # Index results by race_id and race_number for robust lookup
    actual_by_race: dict[int, dict] = {}
    if results:
        for race in results.get("races", []):
            key = race.get("race_id") or race.get("race_number")
            if key is not None:
                actual_by_race[key] = race

    races_out = []
    for race in preds.get("races", []):
        actual = (
            actual_by_race.get(race.get("race_id"))
            or actual_by_race.get(race.get("race_number"))
            or {}
        )
        actual_top3 = actual.get("actual_top3") or []
        finishers = actual.get("finishers") or []

        # Annotate each runner with actual finish position if available
        finish_by_name = {
            f["horse_name"]: f.get("position") for f in finishers
        }
        runners = []
        for r in race.get("runners", []):
            row = dict(r)
            row["actual_position"] = finish_by_name.get(r.get("horse_name"))
            runners.append(row)

        # Hit metrics
        predicted_top3 = race.get("top3") or []
        top3_hits = len(set(predicted_top3) & set(actual_top3))
        top_pick_hit = bool(actual_top3 and predicted_top3 and predicted_top3[0] in actual_top3)

        races_out.append({
            **{k: race[k] for k in race if k != "runners"},
            "runners": runners,
            "actual_top3": actual_top3,
            "finishers": finishers,
            "top3_hits": top3_hits,
            "top_pick_hit": top_pick_hit,
            "has_results": bool(finishers),
        })

    return {
        "meeting_date": date,
        "fetched_at": preds.get("fetched_at"),
        "settled_at": (results or {}).get("settled_at"),
        "races": races_out,
        "has_results": bool(results),
    }


def summarise_meeting(m: dict) -> dict:
    races = m["races"]
    settled = [r for r in races if r["has_results"]]
    total_top3_picks = 3 * len(settled)
    total_top3_hits = sum(r["top3_hits"] for r in settled)
    top_pick_hits = sum(1 for r in settled if r["top_pick_hit"])

    value_bets = []
    for r in races:
        for run in r["runners"]:
            if run.get("is_value"):
                vb = {
                    "race_number": r["race_number"],
                    "horse_name": run["horse_name"],
                    "win_pct": run["win_pct"],
                    "public_odds": run.get("public_odds"),
                    "edge": run.get("edge"),
                    "actual_position": run.get("actual_position"),
                }
                value_bets.append(vb)

    # Simple ROI: 1 unit on each value bet at win odds, settled only.
    settled_vbs = [v for v in value_bets if v["actual_position"] is not None]
    vb_wins = [v for v in settled_vbs if v["actual_position"] == 1]
    vb_staked = len(settled_vbs)
    vb_returns = sum((v["public_odds"] or 0) for v in vb_wins)  # decimal odds incl. stake
    vb_pnl = vb_returns - vb_staked
    vb_roi = (vb_pnl / vb_staked * 100) if vb_staked else None

    return {
        "meeting_date": m["meeting_date"],
        "race_count": len(races),
        "has_results": m["has_results"],
        "top3_hits": total_top3_hits,
        "top3_attempts": total_top3_picks,
        "top3_precision": (total_top3_hits / total_top3_picks * 100) if total_top3_picks else None,
        "top_pick_hits": top_pick_hits,
        "top_pick_attempts": len(settled),
        "top_pick_rate": (top_pick_hits / len(settled) * 100) if settled else None,
        "value_bet_count": len(value_bets),
        "value_bet_settled": vb_staked,
        "value_bet_wins": len(vb_wins),
        "value_bet_pnl": vb_pnl if vb_staked else None,
        "value_bet_roi": vb_roi,
    }


def build_profiles(conn) -> dict:
    """Summarise each horse / jockey / trainer with career and trailing-60d stats."""
    max_date = conn.execute(
        "SELECT MAX(race_date) FROM races WHERE venue='HV'"
    ).fetchone()[0]

    horses = conn.execute("""
        SELECT h.horse_id, h.horse_name,
               COUNT(e.entry_id) AS runs,
               SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) AS places,
               MAX(r.race_date) AS last_run
        FROM horses h
        LEFT JOIN race_entries e ON e.horse_id = h.horse_id
        LEFT JOIN races r ON e.race_id = r.race_id AND r.venue='HV'
        GROUP BY h.horse_id
        ORDER BY h.horse_name
    """).fetchall()

    jockeys = conn.execute("""
        SELECT j.jockey_id, j.jockey_name,
               COUNT(e.entry_id) AS rides,
               SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) AS places
        FROM jockeys j
        LEFT JOIN race_entries e ON e.jockey_id = j.jockey_id
        LEFT JOIN races r ON e.race_id = r.race_id AND r.venue='HV'
        GROUP BY j.jockey_id
        ORDER BY wins DESC
    """).fetchall()

    trainers = conn.execute("""
        SELECT t.trainer_id, t.trainer_name,
               COUNT(e.entry_id) AS runs,
               SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) AS places
        FROM trainers t
        LEFT JOIN race_entries e ON e.trainer_id = t.trainer_id
        LEFT JOIN races r ON e.race_id = r.race_id AND r.venue='HV'
        GROUP BY t.trainer_id
        ORDER BY wins DESC
    """).fetchall()

    def trail(table, key, name_col):
        rows = conn.execute(f"""
            SELECT e.{key}, COUNT(*) AS rides,
                   SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) AS wins,
                   SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) AS places
            FROM race_entries e
            JOIN races r ON e.race_id = r.race_id
            WHERE r.venue='HV'
              AND r.race_date >= date(?, '-60 days')
              AND e.finish_position IS NOT NULL
            GROUP BY e.{key}
        """, (max_date,)).fetchall()
        return {row[0]: {"rides": row[1], "wins": row[2], "places": row[3]} for row in rows}

    jockey_trail = trail("jockeys", "jockey_id", "jockey_name")
    trainer_trail = trail("trainers", "trainer_id", "trainer_name")

    def pack_career(rows, id_idx, name_idx, runs_idx, wins_idx, places_idx, trail_map=None, extra=None):
        out = []
        for row in rows:
            rid = row[id_idx]
            runs = row[runs_idx] or 0
            wins = row[wins_idx] or 0
            places = row[places_idx] or 0
            rec = {
                "id": rid,
                "name": row[name_idx],
                "runs": runs,
                "wins": wins,
                "places": places,
                "win_pct": (wins / runs * 100) if runs else 0,
                "place_pct": (places / runs * 100) if runs else 0,
            }
            if extra:
                rec.update(extra(row))
            if trail_map and rid in trail_map:
                t = trail_map[rid]
                rec["trail60"] = {
                    "rides": t["rides"],
                    "wins": t["wins"],
                    "places": t["places"],
                    "win_pct": (t["wins"] / t["rides"] * 100) if t["rides"] else 0,
                    "place_pct": (t["places"] / t["rides"] * 100) if t["rides"] else 0,
                }
            out.append(rec)
        return out

    return {
        "as_of": max_date,
        "horses": pack_career(horses, 0, 1, 2, 3, 4,
                              extra=lambda r: {"last_run": r[5]}),
        "jockeys": pack_career(jockeys, 0, 1, 2, 3, 4, trail_map=jockey_trail),
        "trainers": pack_career(trainers, 0, 1, 2, 3, 4, trail_map=trainer_trail),
    }


def build_performance(meeting_summaries: list[dict]) -> dict:
    settled = [m for m in meeting_summaries if m["has_results"]]
    total_top3_hits = sum(m["top3_hits"] for m in settled)
    total_top3_attempts = sum(m["top3_attempts"] for m in settled)
    total_top_hits = sum(m["top_pick_hits"] for m in settled)
    total_top_attempts = sum(m["top_pick_attempts"] for m in settled)
    total_vb_staked = sum(m["value_bet_settled"] or 0 for m in settled)
    total_vb_wins = sum(m["value_bet_wins"] or 0 for m in settled)
    total_vb_pnl = sum(m["value_bet_pnl"] or 0 for m in settled)

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "meetings_total": len(meeting_summaries),
        "meetings_settled": len(settled),
        "top3_precision": (total_top3_hits / total_top3_attempts * 100) if total_top3_attempts else None,
        "top3_hits": total_top3_hits,
        "top3_attempts": total_top3_attempts,
        "top_pick_rate": (total_top_hits / total_top_attempts * 100) if total_top_attempts else None,
        "top_pick_hits": total_top_hits,
        "top_pick_attempts": total_top_attempts,
        "value_bet_staked": total_vb_staked,
        "value_bet_wins": total_vb_wins,
        "value_bet_pnl": total_vb_pnl,
        "value_bet_roi": (total_vb_pnl / total_vb_staked * 100) if total_vb_staked else None,
        "meetings": meeting_summaries,
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "meetings").mkdir(parents=True, exist_ok=True)

    dates = find_meeting_dates()
    print(f"Found {len(dates)} meeting(s).")

    summaries: list[dict] = []
    index: list[dict] = []
    for date in dates:
        merged = merge_meeting(date)
        if not merged:
            continue
        jdump(OUT / "meetings" / f"{date}.json", merged)
        summary = summarise_meeting(merged)
        summaries.append(summary)
        index.append({
            "date": date,
            "race_count": summary["race_count"],
            "has_results": summary["has_results"],
            "top3_precision": summary["top3_precision"],
            "value_bet_count": summary["value_bet_count"],
            "value_bet_roi": summary["value_bet_roi"],
        })
        print(f"  · {date}  races={summary['race_count']}  "
              f"results={'Y' if summary['has_results'] else 'N'}  "
              f"value_bets={summary['value_bet_count']}")

    jdump(OUT / "meetings.json", {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "meetings": index,
    })

    perf = build_performance(summaries)
    jdump(OUT / "performance.json", perf)

    if DB_PATH.exists():
        conn = sqlite3.connect(DB_PATH)
        profiles = build_profiles(conn)
        conn.close()
        jdump(OUT / "profiles.json", profiles)
        print(f"  · profiles: {len(profiles['horses'])} horses, "
              f"{len(profiles['jockeys'])} jockeys, "
              f"{len(profiles['trainers'])} trainers")
    else:
        print("  · DB not found, skipping profiles.json")

    print(f"\n✓ Snapshot written to {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
