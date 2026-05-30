#!/usr/bin/env python3
"""
regen_predictions.py — rebuild predictions_<date>.json with the market-blend model.

Re-scores a past meeting from the DB using the production blend
(`score_race(blend_coef="auto")`) and writes the same JSON schema that
wednesday_agent.build_predictions produces, so export_data.py / the PWA pick it
up unchanged.

Leak-free: factor stats are built from races strictly BEFORE the meeting date,
so a horse's form/jockey factors never see that meeting's own results. The
blend coefficients come from blend_coef.json (the live production model).

Usage:
  python3 regen_predictions.py 2026-05-13 2026-05-27
"""
import sqlite3
import json
import sys
from datetime import datetime

import model_core as mc

DB = "happy_valley.db"
VENUE = "HV"


def load_entries_for_race(conn, race_id):
    rows = conn.execute("""
        SELECT e.horse_id, h.horse_name, e.barrier, e.horse_no,
               e.jockey_id, j.jockey_name, e.trainer_id, t.trainer_name,
               e.weight, e.public_odds, e.finish_position,
               e.official_rating, e.rating_change, e.days_since_last_run, e.last_6_runs
        FROM race_entries e
        JOIN horses h   ON h.horse_id   = e.horse_id
        LEFT JOIN jockeys  j ON j.jockey_id  = e.jockey_id
        LEFT JOIN trainers t ON t.trainer_id = e.trainer_id
        WHERE e.race_id = ?
    """, (race_id,)).fetchall()
    cols = ["horse_id", "horse_name", "barrier", "horse_no", "jockey_id",
            "jockey_name", "trainer_id", "trainer_name", "weight", "public_odds",
            "finish_position", "official_rating", "rating_change",
            "days_since_last_run", "last_6_runs"]
    return [dict(zip(cols, r)) for r in rows]


def regen(conn, meeting_date):
    races = conn.execute("""
        SELECT race_id, race_number, distance_m, course_config, race_class,
               going, field_size
        FROM races WHERE venue=? AND race_date=?
        ORDER BY race_number
    """, (VENUE, meeting_date)).fetchall()
    if not races:
        print(f"  {meeting_date}: no races in DB — skipped")
        return None

    # Factor stats strictly before this meeting (no same-day result leakage)
    stats = mc.build_stats(conn, before_date=meeting_date, venue=VENUE)

    races_out = []
    for race_id, rno, dist, cfg, rclass, going, field_size in races:
        entries = load_entries_for_race(conn, race_id)
        runners = mc.score_race(entries, stats, dist, cfg,
                                race_class=rclass, going=going,
                                blend_coef="auto")
        if not runners:
            continue
        top3 = [r["horse_name"] for r in runners[:3]]
        runners_out = [{
            "horse_name": r["horse_name"],
            "horse_id": r["horse_id"],
            "barrier": r["barrier"],
            "jockey": r.get("jockey_name") or "",
            "trainer": r.get("trainer_name") or "",
            "weight": r["weight"],
            "public_odds": r.get("public_odds"),
            "win_pct": round(r["win_pct"], 1),
            "place_pct": round(r["place_pct"], 1),
            "show_pct": round(r["show_pct"], 1),
            "market_pct": round(r.get("market_pct", 0), 1),
            "edge": round(r.get("edge", 0), 1),
            "is_value": r.get("is_value", False),
            "pred_rank": rank,
            "horse_no": r.get("horse_no"),
        } for rank, r in enumerate(runners, 1)]
        races_out.append({
            "race_number": rno,
            "race_id": race_id,
            "distance_m": dist,
            "course_config": cfg,
            "race_class": rclass,
            "going": going,
            "field_size": field_size or len(runners_out),
            "top3": top3,
            "runners": runners_out,
        })

    return {
        "meeting_date": meeting_date,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "model": "market-blend (Phase 5)",
        "venue": VENUE,
        "races": races_out,
    }


def main():
    dates = sys.argv[1:]
    if not dates:
        print("usage: python3 regen_predictions.py YYYY-MM-DD [YYYY-MM-DD ...]")
        return
    conn = sqlite3.connect(DB)
    for d in dates:
        out = regen(conn, d)
        if out is None:
            continue
        path = f"predictions_{d}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        nfav = sum(1 for r in out["races"]
                   if r["runners"] and r["runners"][0]["pred_rank"] == 1)
        print(f"  {d}: wrote {path}  ({len(out['races'])} races, blended)")
    conn.close()


if __name__ == "__main__":
    main()
