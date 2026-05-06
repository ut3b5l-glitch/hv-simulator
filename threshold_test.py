#!/usr/bin/env python3
"""
threshold_test.py
Tests ExactTrip-m10 (best ranking config) at different value thresholds.
"""

import sqlite3

DB_PATH = "happy_valley.db"
TOP_N_TEST = 200
MIN_SAMPLES_BARRIER = 5
MIN_SAMPLES_JOCKEY = 5
MIN_SAMPLES_TRAINER = 5


def get_connection():
    return sqlite3.connect(DB_PATH)


def load_races(conn):
    c = conn.execute("""
        SELECT r.race_id, r.race_date, r.distance_m, r.course_config
        FROM races r
        WHERE r.venue = 'HV'
        ORDER BY r.race_date ASC, r.race_number ASC
    """)
    return c.fetchall()


def load_entries(conn, race_id):
    c = conn.execute("""
        SELECT horse_id, barrier, jockey_id, trainer_id, public_odds, finish_position
        FROM race_entries
        WHERE race_id = ?
    """, (race_id,))
    return c.fetchall()


def odds_to_prob(odds):
    if odds is None or odds <= 0:
        return 0.0
    return 1.0 / odds


def build_stats(conn, before_date):
    stats = {}

    c = conn.execute("""
        SELECT COUNT(DISTINCT r.race_id), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue='HV' AND r.race_date < ?
    """, (before_date,))
    races_total, runners_total = c.fetchone()
    stats['base_rate'] = races_total / runners_total if runners_total else 0.1

    c = conn.execute("""
        SELECT r.distance_m, r.course_config, e.barrier,
               SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END) as wins,
               COUNT(*) as runs
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue='HV' AND r.race_date < ?
        GROUP BY r.distance_m, r.course_config, e.barrier
    """, (before_date,))
    barrier = {}
    for dist, cfg, bar, wins, runs in c.fetchall():
        barrier[(dist, cfg, bar)] = (wins, runs)

    c = conn.execute("""
        SELECT r.distance_m, r.course_config, COUNT(DISTINCT r.race_id), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue='HV' AND r.race_date < ?
        GROUP BY r.distance_m, r.course_config
    """, (before_date,))
    cond_base = {}
    for dist, cfg, rc, rn in c.fetchall():
        cond_base[(dist, cfg)] = rc / rn if rn else stats['base_rate']

    barrier_iv = {}
    for (dist, cfg, bar), (wins, runs) in barrier.items():
        if runs >= MIN_SAMPLES_BARRIER:
            b = cond_base.get((dist, cfg), stats['base_rate'])
            barrier_iv[(dist, cfg, bar)] = max(0.20, (wins/runs) / b)
        else:
            barrier_iv[(dist, cfg, bar)] = 1.0
    stats['barrier_iv'] = barrier_iv

    c = conn.execute("""
        SELECT e.jockey_id,
               SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END) as wins,
               COUNT(*) as rides
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue='HV' AND r.race_date < ? AND e.jockey_id IS NOT NULL
        GROUP BY e.jockey_id
    """, (before_date,))
    jockey = {}
    for jid, wins, rides in c.fetchall():
        if rides >= MIN_SAMPLES_JOCKEY:
            jockey[jid] = max(0.20, (wins/rides) / stats['base_rate'])
        else:
            jockey[jid] = 1.0
    stats['jockey'] = jockey

    c = conn.execute("""
        SELECT e.trainer_id,
               SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END) as wins,
               COUNT(*) as rides
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue='HV' AND r.race_date < ? AND e.trainer_id IS NOT NULL
        GROUP BY e.trainer_id
    """, (before_date,))
    trainer = {}
    for tid, wins, rides in c.fetchall():
        if rides >= MIN_SAMPLES_TRAINER:
            trainer[tid] = max(0.20, (wins/rides) / stats['base_rate'])
        else:
            trainer[tid] = 1.0
    stats['trainer'] = trainer

    c = conn.execute("""
        SELECT e.horse_id, r.distance_m, r.course_config,
               SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END) as wins,
               COUNT(*) as runs
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue='HV' AND r.race_date < ? AND e.horse_id IS NOT NULL
        GROUP BY e.horse_id, r.distance_m, r.course_config
    """, (before_date,))
    stats['horse_exact'] = {(hid,dist,cfg): (wins,runs) for hid,dist,cfg,wins,runs in c.fetchall()}

    return stats


def compute_horse_factor(stats, hid, dist, cfg, m):
    base = stats['base_rate']
    wins, runs = stats['horse_exact'].get((hid, dist, cfg), (0, 0))
    if runs == 0:
        return 1.0
    smoothed = (wins + m * base) / (runs + m)
    f = smoothed / base if base > 0 else 1.0
    return max(0.50, f)


def simulate_race(entries, stats, dist, cfg, edge_threshold, min_prob):
    scores = {}
    mkt_probs = {}
    winner = None
    places = set()

    for hid, barrier, jid, tid, odds, pos in entries:
        b_iv = stats['barrier_iv'].get((dist, cfg, barrier), 1.0)
        jf = stats['jockey'].get(jid, 1.0)
        tf = stats['trainer'].get(tid, 1.0)
        hf = compute_horse_factor(stats, hid, dist, cfg, m=10)

        scores[hid] = b_iv * jf * tf * hf
        mkt_probs[hid] = odds_to_prob(odds)

        if pos == 1:
            winner = hid
        if pos is not None and pos <= 3:
            places.add(hid)

    total = sum(scores.values())
    if total == 0:
        return None
    model_probs = {hid: s/total for hid, s in scores.items()}

    top_pick = max(model_probs, key=model_probs.get)
    top_win = 1 if top_pick == winner else 0
    top_place = 1 if top_pick in places else 0

    value_bets = []
    for hid in model_probs:
        mp = model_probs[hid] * 100
        mkp = mkt_probs[hid] * 100
        if mp - mkp > edge_threshold and mp > min_prob:
            value_bets.append(hid)

    vb_count = len(value_bets)
    vb_profit = 0.0
    if vb_count > 0:
        for hid in value_bets:
            odds = next((e[4] for e in entries if e[0] == hid), None)
            if odds and odds > 0:
                if hid == winner:
                    vb_profit += (odds - 1.0)
                else:
                    vb_profit -= 1.0

    return {
        'top_pick_win': top_win,
        'top_pick_place': top_place,
        'vb_count': vb_count,
        'vb_profit': vb_profit,
    }


def main():
    conn = get_connection()
    races = load_races(conn)
    print(f"Loaded {len(races)} HV races.\n")

    train_races = races[:-TOP_N_TEST]
    test_races = races[-TOP_N_TEST:]
    train_cutoff = test_races[0][1]
    print(f"Training on {len(train_races)} races (before {train_cutoff})")
    print(f"Testing on {len(test_races)} races\n")

    stats = build_stats(conn, train_cutoff)

    # Test edge thresholds
    thresholds = [2, 3, 4, 5, 6]
    min_probs = [6, 8, 10]

    print("=" * 70)
    print("THRESHOLD TEST: ExactTrip-m10")
    print("=" * 70)

    for edge in thresholds:
        for min_p in min_probs:
            results = []
            for race_id, rdate, dist, cfg_code in test_races:
                entries = load_entries(conn, race_id)
                r = simulate_race(entries, stats, dist, cfg_code, edge, min_p)
                if r:
                    results.append(r)

            n = len(results)
            top_wins = sum(r['top_pick_win'] for r in results)
            top_places = sum(r['top_pick_place'] for r in results)
            vb_total = sum(r['vb_count'] for r in results)
            vb_profit = sum(r['vb_profit'] for r in results)
            roi = (vb_profit / vb_total) * 100 if vb_total > 0 else 0

            print(f"\nEdge > {edge}% | Min Model > {min_p}%")
            print(f"  Top Pick Win:   {top_wins}/{n} = {top_wins/n*100:.1f}%")
            print(f"  Top Pick Place: {top_places}/{n} = {top_places/n*100:.1f}%")
            if vb_total:
                print(f"  Value Bets:     {vb_total}  |  ROI: {roi:.1f}%")
            else:
                print(f"  Value Bets:     NONE")

    print("\n" + "=" * 70)


if __name__ == '__main__':
    main()
