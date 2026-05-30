#!/usr/bin/env python3
"""
regen_predictions.py — rebuild predictions_<date>.json with the market-blend model.

Re-scores a past meeting from the DB using the production blend
(`score_race(blend_coef="auto")`) and writes the EXACT JSON schema that
wednesday_agent.build_predictions produces, so export_data.py / the PWA pick it
up unchanged (same keys, same factor block, same field names).

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
        SELECT race_id, race_number, distance_m, course_config, track_surface,
               race_class, going, field_size
        FROM races WHERE venue=? AND race_date=?
        ORDER BY race_number
    """, (VENUE, meeting_date)).fetchall()
    if not races:
        print(f"  {meeting_date}: no races in DB — skipped")
        return None

    # Factor stats strictly before this meeting (no same-day result leakage)
    stats = mc.build_stats(conn, before_date=meeting_date, venue=VENUE)

    races_out = []
    for race_id, rno, dist, cfg, surface, rclass, going, field_size in races:
        entries = load_entries_for_race(conn, race_id)
        runners = mc.score_race(entries, stats, dist, cfg,
                                race_class=rclass, going=going,
                                blend_coef="auto")
        if not runners:
            continue
        runner_dicts = []
        for rank, r in enumerate(runners, 1):
            runner_dicts.append({
                "rank":             rank,
                "horse_name":       r["horse_name"],
                "horse_id":         r["horse_id"],
                "horse_no":         r.get("horse_no"),
                "barrier":          r["barrier"],
                "jockey_name":      r.get("jockey_name") or "",
                "trainer_name":     r.get("trainer_name") or "",
                "official_rating":  r.get("official_rating"),
                "days_since_last_run": r.get("days_since_last_run"),
                "last_6_runs":      r.get("last_6_runs"),
                "win_pct":          round(r["win_pct"], 2),
                "place_pct":        round(r["place_pct"], 2),
                "show_pct":         round(r["show_pct"], 2),
                "public_odds":      r.get("public_odds"),
                "market_pct":       round(r.get("market_pct", 0.0), 2),
                "edge":             round(r.get("edge", 0.0), 2),
                "is_value":         r.get("is_value", False),
                "factors": {
                    "barrier_iv": round(r["b_iv"], 3),
                    "jockey":     round(r["jf"], 3),
                    "trainer":    round(r["tf"], 3),
                    "horse":      round(r["hf"], 3),
                    "form":       round(r["ff"], 3),
                    "class_tf":   round(r.get("cf", 1.0), 3),
                    "weight_chg": round(r.get("wcf", 1.0), 3),
                    "rating":     round(r["rtf"], 3),
                    "days":       round(r["df"], 3),
                },
            })
        top3 = [r["horse_name"] for r in runner_dicts[:3]]
        races_out.append({
            "race_id":       race_id,
            "race_number":   rno,
            "distance_m":    dist,
            "course_config": cfg,
            "track_surface": surface or "Turf",
            "race_class":    rclass,
            "going":         going,
            "field_size":    len(runner_dicts),
            "top3":          top3,
            "runners":       runner_dicts,
        })

    return {
        "meeting_date": meeting_date,
        "fetched_at":   datetime.now().isoformat(timespec="seconds"),
        "races":        races_out,
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
        print(f"  {d}: wrote {path}  ({len(out['races'])} races, blended)")
    conn.close()


if __name__ == "__main__":
    main()
