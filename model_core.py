#!/usr/bin/env python3
"""
model_core.py
─────────────────────────────────────────────────────────────────────────────
Central model logic for the Happy Valley Racing Simulator.

Factors (multiplicative, L1-normalised → win probabilities):
  1. Barrier IV     — win-rate index per (distance, course, barrier)
  2. Jockey Factor  — Bayesian-smoothed win rate vs base rate
  3. Trainer Factor — Bayesian-smoothed win rate vs base rate
  4. Horse Factor   — Bayesian exact-trip smoothed, m=10, class-specific prior
  5. Form Factor    — recency-weighted last-5 DB runs; OR last_6_runs from
                      racecard HTML when available (Phase B override)
  6. Rating Factor  — HKJC official rating, field-relative exponential  (Phase B)
  7. Days Factor    — freshness curve on days since last run             (Phase B)
  8. Class Factor   — HKJC class transition: ROSE→1.33, SAME→1.00, DROPPED→0.85
  9. Weight-Change  — weight delta vs prior race: +1-4→1.28, -1-4→0.90, etc.
  [Raw Weight Factor removed Phase 4A — fights the handicapper. Replaced by
   weight-change in Phase 4D, which captures the HKJC rating-adjustment signal.]
  [Going Factor (Phase 4C): built but excluded — insufficient data at 578 races]

Place/show probabilities via the Harville (1973) formula.

Public API
──────────
  build_stats(conn, before_date=None, venue='HV') → stats dict
  score_race(entries, stats, dist, cfg, race_class=None) → ranked list
  harville_probs(win_probs_dict) → {hid: {win, place, show}}
"""

import math
import json
import os

# ── Tunable constants ──────────────────────────────────────────────────────
VENUE               = "HV"
HORSE_M             = 10      # Bayesian prior strength for exact-trip factor
FORM_RUNS           = 5       # recent runs to use for form score
FORM_DECAY          = 0.60    # exponential decay per run (run 0 = 1.0, run 1 = 0.6 …)
EDGE_THRESHOLD      = 5.0     # value bet: model% − market% must exceed this
MIN_MODEL_PCT       = 10.0    # value bet: model win% must exceed this
MIN_SAMPLES_BARRIER = 5
MIN_SAMPLES_JOCKEY  = 5
MIN_SAMPLES_TRAINER = 5
TRAILING_DAYS       = 60      # window for trailing jockey/trainer factor (days)
TRAILING_MIN        = 10      # min rides in window to use trailing instead of career
FACTOR_FLOOR        = 0.20    # minimum for barrier / jockey / trainer factors
HORSE_FLOOR         = 0.50    # minimum for horse exact-trip factor
FORM_FLOOR          = 0.25    # minimum for form factor
FORM_CAP            = 4.00    # maximum for form factor
RATING_K            = 0.02    # rating factor sensitivity: each pt above avg → exp(k*Δ)
RATING_FLOOR        = 0.30
RATING_CAP          = 3.00
DAYS_OPTIMAL_LO     = 14      # freshness window: peak between 14–28 days
DAYS_OPTIMAL_HI     = 28
GOING_M             = 5       # Bayesian prior strength for going factor (sparser than HORSE_M)
GOING_FLOOR         = 0.50
GOING_CAP           = 2.00

# ── Market-blend combiner ("Benter" conditional logit) ───────────────────────
# The single largest source of predictive signal in racing is the betting
# market itself. On Happy Valley's ~11.5-horse fields the 9-factor chain alone
# barely beats random (walk-forward #1-place 34%, top-3 precision 34%); the
# de-vigged market probability lifts that to ~61% / ~51%. This combiner blends
# the market with the log-factors in a race-grouped conditional logit, fitted by
# train_blend.py and persisted to BLEND_COEF_PATH. beta[i] pairs with
# BLEND_FEATURES[i]; index 0 (log_mkt) is the market and is anchored near 1.0.
BLEND_FEATURES = ["log_mkt", "log_jf", "log_tf", "log_hf", "log_ff",
                  "log_biv", "log_cf", "log_wcf", "log_rtf", "log_df"]
# Map each non-market feature name to its key in the augmented runner dict.
_BLEND_FACTOR_KEY = {
    "log_jf": "jf", "log_tf": "tf", "log_hf": "hf", "log_ff": "ff",
    "log_biv": "b_iv", "log_cf": "cf", "log_wcf": "wcf",
    "log_rtf": "rtf", "log_df": "df",
}
BLEND_COEF_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "blend_coef.json")
_BLEND_CACHE = {}   # path → coef dict (or None)

# Going condition grouping — maps raw DB strings to 3 buckets
GOING_GROUP = {
    "GOOD TO FIRM":     "FIRM",
    "GOOD":             "GOOD",
    "GOOD TO YIELDING": "SOFT",
}

def _going_group(raw_going):
    """Map raw going string to FIRM/GOOD/SOFT bucket. Default GOOD for unknown."""
    if not raw_going:
        return "GOOD"
    return GOING_GROUP.get(raw_going.strip().upper(), "GOOD")


# ─────────────────────────────────────────────────────────────────────────────
# Stats builder
# ─────────────────────────────────────────────────────────────────────────────

def build_stats(conn, before_date=None, venue=VENUE):
    """
    Build all factor caches from completed races strictly before before_date.
    Pass before_date=None (or omit) to use all available historical data
    (correct for the live importer; never for backtesting).
    """
    cutoff = before_date if before_date else "9999-12-31"
    v = venue
    stats = {"venue": v, "cutoff": cutoff}

    # ── Global base rate ────────────────────────────────────────────────────
    r = conn.execute("""
        SELECT COUNT(DISTINCT r.race_id), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue = ? AND r.race_date < ? AND e.finish_position IS NOT NULL
    """, (v, cutoff)).fetchone()
    races_n, runners_n = r
    stats["base_rate"] = races_n / runners_n if runners_n else 0.10

    # ── Class-specific base rates ────────────────────────────────────────────
    rows = conn.execute("""
        SELECT r.race_class, COUNT(DISTINCT r.race_id), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue = ? AND r.race_date < ?
          AND e.finish_position IS NOT NULL AND r.race_class IS NOT NULL
        GROUP BY r.race_class
    """, (v, cutoff)).fetchall()
    stats["base_rate_by_class"] = {
        cls: (rc / rn if rn else stats["base_rate"])
        for cls, rc, rn in rows
    }

    # ── Barrier IV ───────────────────────────────────────────────────────────
    barrier_raw = {
        (dist, cfg, bar): (wins, runs)
        for dist, cfg, bar, wins, runs in conn.execute("""
            SELECT r.distance_m, r.course_config, e.barrier,
                   SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END), COUNT(*)
            FROM races r JOIN race_entries e ON r.race_id = e.race_id
            WHERE r.venue=? AND r.race_date<? AND e.finish_position IS NOT NULL
            GROUP BY r.distance_m, r.course_config, e.barrier
        """, (v, cutoff)).fetchall()
    }
    cond_base = {
        (dist, cfg): (rc / rn if rn else stats["base_rate"])
        for dist, cfg, rc, rn in conn.execute("""
            SELECT r.distance_m, r.course_config,
                   COUNT(DISTINCT r.race_id), COUNT(*)
            FROM races r JOIN race_entries e ON r.race_id = e.race_id
            WHERE r.venue=? AND r.race_date<? AND e.finish_position IS NOT NULL
            GROUP BY r.distance_m, r.course_config
        """, (v, cutoff)).fetchall()
    }
    stats["barrier_iv"] = {
        (dist, cfg, bar): (
            max(FACTOR_FLOOR, (wins / runs) / cond_base.get((dist, cfg), stats["base_rate"]))
            if runs >= MIN_SAMPLES_BARRIER else 1.0
        )
        for (dist, cfg, bar), (wins, runs) in barrier_raw.items()
    }

    # ── Jockey factor (career) ───────────────────────────────────────────────
    stats["jockey"] = {
        jid: (
            max(FACTOR_FLOOR, (wins / rides) / stats["base_rate"])
            if rides >= MIN_SAMPLES_JOCKEY else 1.0
        )
        for jid, wins, rides in conn.execute("""
            SELECT e.jockey_id,
                   SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END), COUNT(*)
            FROM races r JOIN race_entries e ON r.race_id = e.race_id
            WHERE r.venue=? AND r.race_date<?
              AND e.finish_position IS NOT NULL AND e.jockey_id IS NOT NULL
            GROUP BY e.jockey_id
        """, (v, cutoff)).fetchall()
    }

    # ── Trainer factor (career) ──────────────────────────────────────────────
    stats["trainer"] = {
        tid: (
            max(FACTOR_FLOOR, (wins / rides) / stats["base_rate"])
            if rides >= MIN_SAMPLES_TRAINER else 1.0
        )
        for tid, wins, rides in conn.execute("""
            SELECT e.trainer_id,
                   SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END), COUNT(*)
            FROM races r JOIN race_entries e ON r.race_id = e.race_id
            WHERE r.venue=? AND r.race_date<?
              AND e.finish_position IS NOT NULL AND e.trainer_id IS NOT NULL
            GROUP BY e.trainer_id
        """, (v, cutoff)).fetchall()
    }

    # ── Trailing jockey / trainer factors (last TRAILING_DAYS days) ──────────
    # Override career factor when enough recent rides are available.
    # This captures riders who are hot/cold in the current spell.
    # cutoff sentinel "9999-12-31" → trailing window = all available data
    # (safe: will just reconfirm career factor using the same rows).
    if cutoff == "9999-12-31":
        # live mode: trailing window = last TRAILING_DAYS days of available data
        max_date = conn.execute(
            "SELECT MAX(race_date) FROM races WHERE venue=?", (v,)
        ).fetchone()[0] or "2000-01-01"
        trailing_lo = conn.execute(
            "SELECT date(?, ?)", (max_date, f"-{TRAILING_DAYS} days")
        ).fetchone()[0] or "0001-01-01"
        trailing_hi = "9999-12-31"
    else:
        trailing_lo = conn.execute(
            "SELECT date(?, ?)", (cutoff, f"-{TRAILING_DAYS} days")
        ).fetchone()[0] or "0001-01-01"
        trailing_hi = cutoff

    for jid, wins, rides in conn.execute("""
        SELECT e.jockey_id,
               SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date>=? AND r.race_date<?
          AND e.finish_position IS NOT NULL AND e.jockey_id IS NOT NULL
        GROUP BY e.jockey_id
    """, (v, trailing_lo, trailing_hi)).fetchall():
        if rides >= TRAILING_MIN:
            stats["jockey"][jid] = max(
                FACTOR_FLOOR, (wins / rides) / stats["base_rate"]
            )

    for tid, wins, rides in conn.execute("""
        SELECT e.trainer_id,
               SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date>=? AND r.race_date<?
          AND e.finish_position IS NOT NULL AND e.trainer_id IS NOT NULL
        GROUP BY e.trainer_id
    """, (v, trailing_lo, trailing_hi)).fetchall():
        if rides >= TRAILING_MIN:
            stats["trainer"][tid] = max(
                FACTOR_FLOOR, (wins / rides) / stats["base_rate"]
            )

    # ── Horse exact-trip ─────────────────────────────────────────────────────
    stats["horse_exact"] = {
        (hid, dist, cfg): (wins, runs)
        for hid, dist, cfg, wins, runs in conn.execute("""
            SELECT e.horse_id, r.distance_m, r.course_config,
                   SUM(CASE WHEN e.finish_position=1 THEN 1 ELSE 0 END), COUNT(*)
            FROM races r JOIN race_entries e ON r.race_id = e.race_id
            WHERE r.venue=? AND r.race_date<?
              AND e.finish_position IS NOT NULL AND e.horse_id IS NOT NULL
            GROUP BY e.horse_id, r.distance_m, r.course_config
        """, (v, cutoff)).fetchall()
    }

    # ── Recent form (newest FORM_RUNS runs per horse, ordered newest first) ──
    recent_form = {}
    for hid, pos, field_size in conn.execute("""
        SELECT e.horse_id, e.finish_position, COALESCE(r.field_size, 12)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date<?
          AND e.finish_position IS NOT NULL AND e.horse_id IS NOT NULL
        ORDER BY e.horse_id, r.race_date DESC, r.race_number DESC
    """, (v, cutoff)).fetchall():
        bucket = recent_form.setdefault(hid, [])
        if len(bucket) < FORM_RUNS:
            bucket.append((pos, field_size))
    stats["recent_form"] = recent_form

    # ── Horse last class (most recent completed race at HV) ──────────────────
    # Used by _class_factor() to compute class transition (rose/same/dropped).
    # NOTE: In HKJC, rising in class signals positive momentum (rating increased)
    # and dropping signals negative momentum — the OPPOSITE of Western racing.
    # Empirical place rates (Phase 4B): ROSE 36.3%, SAME 27.3%, DROPPED 23.3%.
    stats["horse_last_class"] = {}
    for hid, last_class in conn.execute("""
        SELECT e.horse_id, r.race_class
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date<? AND e.finish_position IS NOT NULL
          AND e.horse_id IS NOT NULL AND r.race_class IS NOT NULL
        ORDER BY e.horse_id, r.race_date DESC, r.race_number DESC
    """, (v, cutoff)).fetchall():
        if hid not in stats["horse_last_class"]:
            stats["horse_last_class"][hid] = last_class

    # ── Horse last weight (most recent completed race at HV) ─────────────────
    # Used by _weight_change_factor() to compute the delta from prior to current.
    # In HKJC, weight additions reflect improved ratings (positive momentum);
    # weight drops reflect rating declines (negative momentum) — same direction
    # as the class factor.
    # Empirical place rates: Drop 1-4 lbs 24.0%, Unchanged 26.7%, Add 1-4 lbs 34.2%.
    stats["horse_last_weight"] = {}
    for hid, last_weight in conn.execute("""
        SELECT e.horse_id, e.weight
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date<? AND e.finish_position IS NOT NULL
          AND e.horse_id IS NOT NULL AND e.weight IS NOT NULL AND e.weight > 0
        ORDER BY e.horse_id, r.race_date DESC, r.race_number DESC
    """, (v, cutoff)).fetchall():
        if hid not in stats["horse_last_weight"]:
            stats["horse_last_weight"][hid] = last_weight

    # ── Going factor ─────────────────────────────────────────────────────────
    # Per-going-group base place rate (top-3 finish rate), used as Bayesian prior.
    # Empirically ~26% for all three groups at HV — stored per group for precision.
    going_group_totals = {}  # grp → (placed, runs)
    for grp, placed, runs in conn.execute("""
        SELECT
            CASE WHEN r.going LIKE '%YIELD%' THEN 'SOFT'
                 WHEN r.going LIKE '%FIRM%'  THEN 'FIRM'
                 ELSE 'GOOD' END AS grp,
            SUM(e.is_placed), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date<? AND e.finish_position IS NOT NULL
        GROUP BY 1
    """, (v, cutoff)).fetchall():
        going_group_totals[grp] = (placed, runs)

    overall_placed = sum(p for p, _ in going_group_totals.values())
    overall_runs   = sum(r for _, r in going_group_totals.values())
    overall_place_rate = overall_placed / overall_runs if overall_runs else 0.26

    stats["going_base_rate"] = {
        grp: (p / r if r else overall_place_rate)
        for grp, (p, r) in going_group_totals.items()
    }

    # Per (horse, going_group): (placed, runs) for Bayesian smoothing
    horse_going = {}
    for hid, going_raw, placed, runs in conn.execute("""
        SELECT e.horse_id,
            CASE WHEN r.going LIKE '%YIELD%' THEN 'SOFT'
                 WHEN r.going LIKE '%FIRM%'  THEN 'FIRM'
                 ELSE 'GOOD' END AS grp,
            SUM(e.is_placed), COUNT(*)
        FROM races r JOIN race_entries e ON r.race_id = e.race_id
        WHERE r.venue=? AND r.race_date<? AND e.finish_position IS NOT NULL
          AND e.horse_id IS NOT NULL
        GROUP BY e.horse_id, 2
    """, (v, cutoff)).fetchall():
        horse_going[(hid, going_raw)] = (placed, runs)
    stats["horse_going"] = horse_going

    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Individual factor functions
# ─────────────────────────────────────────────────────────────────────────────

def _horse_factor(stats, hid, dist, cfg, race_class=None):
    """Bayesian-smoothed exact-trip win rate vs class-specific base rate."""
    base = (
        stats["base_rate_by_class"].get(race_class, stats["base_rate"])
        if race_class else stats["base_rate"]
    )
    wins, runs = stats["horse_exact"].get((hid, dist, cfg), (0, 0))
    if runs == 0:
        return 1.0
    smoothed = (wins + HORSE_M * base) / (runs + HORSE_M)
    return max(HORSE_FLOOR, smoothed / base)


def _form_factor(stats, hid):
    """
    Recency-weighted form factor from last FORM_RUNS runs.
    Finish position is normalised within field size so a 4th of 14 != 4th of 6.
    Base expectation = mid-field finish (normalised score ≈ 0.50) → factor 1.0.
    """
    runs = stats["recent_form"].get(hid, [])
    if not runs:
        return 1.0
    weighted, total_w = 0.0, 0.0
    for i, (pos, field_size) in enumerate(runs):
        norm = 1.0 - (pos - 1) / max(field_size - 1, 1)   # 1st=1.0, last=0.0
        w = FORM_DECAY ** i
        weighted += w * norm
        total_w  += w
    avg_norm = weighted / total_w
    return max(FORM_FLOOR, min(FORM_CAP, avg_norm / 0.50))


def _class_factor(last_class, current_class):
    """
    Class transition factor based on HKJC empirical place rates (Phase 4B).

    In HKJC, class is determined by official rating — rising signals momentum
    (rating went up from good runs); dropping signals poor form. Effect is the
    OPPOSITE of Western racing: risers outperform, droppers underperform.

    Empirical place rates from 5,229 transitions:
      ROSE (moved to lower-numbered/better class): 36.3%  → factor 1.33
      SAME:                                        27.3%  → factor 1.00
      DROPPED (moved to higher-numbered/worse class): 23.3% → factor 0.85

    Returns 1.0 if either class is unknown.
    """
    if not last_class or not current_class:
        return 1.0
    try:
        prev_n = int(last_class.split()[-1])
        curr_n = int(current_class.split()[-1])
    except (ValueError, IndexError):
        return 1.0
    if curr_n < prev_n:    # moved to better (lower-numbered) class
        return 1.33
    elif curr_n > prev_n:  # moved to worse (higher-numbered) class
        return 0.85
    return 1.00


def _going_factor(stats, hid, going_grp):
    """
    Bayesian-smoothed going preference factor (Phase 4C).

    Measures whether this horse places more or less often on the current going
    vs the field-average place rate for that going type. Smoothed with GOING_M
    phantom runs to shrink sparse samples toward the base rate.

    Factor = smoothed_place_rate / going_base_rate
    Returns 1.0 if going_grp is None or horse has no going history.
    """
    if not going_grp:
        return 1.0
    base = stats["going_base_rate"].get(going_grp, 0.26)
    placed, runs = stats["horse_going"].get((hid, going_grp), (0, 0))
    if runs == 0:
        return 1.0
    smoothed = (placed + GOING_M * base) / (runs + GOING_M)
    return max(GOING_FLOOR, min(GOING_CAP, smoothed / base))


def _weight_factors(entries):
    """
    Per-race weight factor dict. Lighter relative to field average → factor > 1.
    entries: list of dicts with 'horse_id' and 'weight'.
    """
    valid = [(e["horse_id"], e.get("weight") or 0) for e in entries if e.get("weight") and e.get("weight") > 0]
    if not valid:
        return {e["horse_id"]: 1.0 for e in entries}
    avg_w = sum(w for _, w in valid) / len(valid)
    wf = {}
    for e in entries:
        w = e.get("weight") or 0
        wf[e["horse_id"]] = (avg_w / w) if w > 0 else 1.0
    return wf


def _weight_change_factor(current_weight, last_weight):
    """
    Weight-change factor based on HKJC empirical place rates (Phase 4D).

    In HKJC, weight changes reflect official rating adjustments — adding weight
    signals the handicapper rewarding good recent form. The effect mirrors the
    class transition factor: increases indicate positive momentum.

    Empirical place rates (5,229 transitions with prior weight):
      Drop 5+ lbs:  26.4% → factor 0.99 → rounded to 1.00 (noise)
      Drop 1-4 lbs: 24.0% → factor 0.90
      Unchanged:    26.7% → factor 1.00
      Add 1-4 lbs:  34.2% → factor 1.28
      Add 5+ lbs:   28.3% → factor 1.06

    Returns 1.0 if either weight is unknown.
    """
    if not current_weight or not last_weight or current_weight <= 0 or last_weight <= 0:
        return 1.0
    delta = current_weight - last_weight
    if delta <= -5:
        return 1.00   # large drops: noise, no reliable signal
    elif delta < 0:
        return 0.90   # small drop (1-4 lbs): declining form
    elif delta == 0:
        return 1.00   # unchanged
    elif delta <= 4:
        return 1.28   # moderate gain (1-4 lbs): improving form — strongest signal
    else:
        return 1.06   # large gain (5+ lbs): positive but dampened


# ─────────────────────────────────────────────────────────────────────────────
# Phase B factor functions (activate only when racecard data is present)
# ─────────────────────────────────────────────────────────────────────────────

def _rating_factor(entries):
    """
    Field-relative official rating factor (Phase B).
    Uses HKJC handicap rating per horse vs field average.
    Factor = exp(RATING_K × (horse_rating − field_avg)).
    Returns {horse_id: 1.0} for all if fewer than 2 runners have ratings.
    """
    valid = [
        (e["horse_id"], e["official_rating"])
        for e in entries
        if e.get("official_rating") and e["official_rating"] > 0
    ]
    if len(valid) < 2:
        return {e["horse_id"]: 1.0 for e in entries}

    avg = sum(r for _, r in valid) / len(valid)
    rf = {}
    for e in entries:
        r = e.get("official_rating")
        if r and r > 0:
            rf[e["horse_id"]] = max(RATING_FLOOR,
                                    min(RATING_CAP, math.exp(RATING_K * (r - avg))))
        else:
            rf[e["horse_id"]] = 1.0
    return rf


def _days_factor(days):
    """
    Freshness factor based on days since last run (Phase B).
    Peak boost for 14–28 days. Penalty for very short or very long gaps.
    Returns 1.0 if days is None (unknown).
    """
    if days is None:
        return 1.0
    if days < 7:
        return 0.88   # possible injury recovery, insufficient training
    elif days <= DAYS_OPTIMAL_HI:
        return 1.06   # optimal freshness window
    elif days <= 42:
        return 1.00   # slightly past peak but fine
    elif days <= 70:
        return 0.95   # ring-rusty
    else:
        return 0.88   # long layoff


def _html_form_factor(last_6_runs_str, field_size=12):
    """
    Form factor derived from the racecard 'Last 6 Runs' string, e.g. '4/6/1/12/14/3'.
    Overrides DB form factor when available — racecard data includes all-venue runs
    and is more complete for lightly-raced horses.
    Non-numeric tokens (F=fell, U=unseated, V=void, -=no run) are skipped.
    """
    if not last_6_runs_str:
        return None   # signal: fall back to DB form factor

    positions = []
    for token in last_6_runs_str.split("/"):
        token = token.strip()
        try:
            positions.append(int(token))
        except ValueError:
            pass   # skip F, U, V, WV, -, etc.

    if not positions:
        return None   # no usable runs — fall back to DB form

    weighted, total_w = 0.0, 0.0
    for i, pos in enumerate(positions[:FORM_RUNS]):
        norm = 1.0 - (pos - 1) / max(field_size - 1, 1)   # 1st=1.0, last≈0.0
        w = FORM_DECAY ** i
        weighted += w * norm
        total_w  += w

    avg_norm = weighted / total_w
    return max(FORM_FLOOR, min(FORM_CAP, avg_norm / 0.50))


# ─────────────────────────────────────────────────────────────────────────────
# Harville formula
# ─────────────────────────────────────────────────────────────────────────────

def harville_probs(win_probs):
    """
    Convert win probabilities to place (top-2) and show (top-3) probabilities.

    Harville (1973):
      P(i 2nd | k won)      = w_i / (1 − w_k)
      P(i 3rd | k won, j 2nd) = w_i / (1 − w_k − w_j)

    win_probs : dict {horse_id: probability}, values should sum ≈ 1.0
    Returns   : dict {horse_id: {'win': float, 'place': float, 'show': float}}
    """
    horses = list(win_probs.keys())
    w = win_probs
    p2 = {h: 0.0 for h in horses}
    p3 = {h: 0.0 for h in horses}

    for i in horses:
        for k in horses:
            if k == i:
                continue
            dk = 1.0 - w[k]
            if dk < 1e-9:
                continue
            p2[i] += w[k] * (w[i] / dk)

            for j in horses:
                if j == i or j == k:
                    continue
                dkj = 1.0 - w[k] - w[j]
                if dkj < 1e-9:
                    continue
                p3[i] += w[k] * (w[j] / dk) * (w[i] / dkj)

    return {
        h: {
            "win":   w[h],
            "place": w[h] + p2[h],
            "show":  w[h] + p2[h] + p3[h],
        }
        for h in horses
    }


# ─────────────────────────────────────────────────────────────────────────────
# Market-blend combiner
# ─────────────────────────────────────────────────────────────────────────────

def load_blend_coef(path=BLEND_COEF_PATH):
    """Load persisted conditional-logit coefficients (or None). Cached per path."""
    if path in _BLEND_CACHE:
        return _BLEND_CACHE[path]
    coef = None
    try:
        with open(path) as f:
            coef = json.load(f)
    except (FileNotFoundError, ValueError, OSError):
        coef = None
    _BLEND_CACHE[path] = coef
    return coef


def _devig_market(augmented):
    """De-vigged market win prob per horse_id. None unless EVERY runner has odds."""
    valid = [(hid, 1.0 / rd["public_odds"])
             for hid, rd in augmented.items()
             if rd.get("public_odds") and rd["public_odds"] > 0]
    if len(valid) < len(augmented) or len(valid) < 2:
        return None
    s = sum(v for _, v in valid)
    return {hid: v / s for hid, v in valid}


def _blend_win_probs(augmented, coef):
    """
    Conditional-logit blend of the de-vigged market probability and the log
    fundamental factors:  P(win_i) = softmax_i( Σ_k beta_k · log feature_{i,k} ).
    Returns {horse_id: win_prob}, or None if odds are incomplete (caller keeps
    the pure-factor probabilities as a fallback).
    """
    if not coef:
        return None
    market = _devig_market(augmented)
    if market is None:
        return None
    features, beta = coef["features"], coef["beta"]
    utils = {}
    for hid, rd in augmented.items():
        u = 0.0
        for fname, b in zip(features, beta):
            val = market[hid] if fname == "log_mkt" else rd.get(_BLEND_FACTOR_KEY.get(fname, ""), 1.0)
            u += b * math.log(max(val, 1e-9))
        utils[hid] = u
    mx = max(utils.values())
    exps = {hid: math.exp(u - mx) for hid, u in utils.items()}
    tot = sum(exps.values())
    if tot <= 0:
        return None
    return {hid: e / tot for hid, e in exps.items()}


# ─────────────────────────────────────────────────────────────────────────────
# Full race scorer — the main API call
# ─────────────────────────────────────────────────────────────────────────────

def score_race(entries, stats, dist, cfg, race_class=None, going=None,
               blend_coef=None):
    """
    Score all runners and return Harville probabilities, sorted by show% (top-3 order).

    entries : list of dicts, each containing:
                horse_id, horse_name (optional), barrier,
                jockey_id, trainer_id, weight,
                public_odds (None if unknown), finish_position (None if future)
    stats   : output of build_stats()
    dist    : distance_m of the race
    cfg     : course_config of the race
    race_class : race_class string or None

    Returns : list of runner dicts, sorted by show_pct descending.
              Each dict includes all input fields plus:
                b_iv, jf, tf, hf, ff, rtf, df, cf, wcf  ← individual factors
                gf  ← going factor (diagnostic only, not in multiplicative chain)
                raw_score
                win_pct, place_pct, show_pct   ← Harville probabilities × 100
                market_pct                      ← 1/odds × 100, or 0 if no odds
                edge                            ← win_pct − market_pct
                is_value                        ← bool (5% edge AND 10% min model)
    """
    if not entries:
        return []

    going_grp = _going_group(going)            # map raw string → FIRM/GOOD/SOFT

    # Per-race factors (need full field context)
    rf_map  = _rating_factor(entries)          # Phase B: 1.0 if no ratings

    # Typical field size for normalising html form positions
    field_size = len(entries)

    raw_scores = {}
    augmented  = {}
    for e in entries:
        hid  = e["horse_id"]
        b_iv = stats["barrier_iv"].get((dist, cfg, e.get("barrier")), 1.0)
        jf   = stats["jockey"].get(e.get("jockey_id"),  1.0)
        tf   = stats["trainer"].get(e.get("trainer_id"), 1.0)
        hf   = _horse_factor(stats, hid, dist, cfg, race_class=race_class)

        # Form: use racecard HTML last_6_runs when present, else DB history
        # Use constant 12 (HV average field size) — last_6_runs positions came
        # from past races with unknown, varying field sizes.
        html_ff = _html_form_factor(e.get("last_6_runs"), field_size=12)
        ff = html_ff if html_ff is not None else _form_factor(stats, hid)

        rtf = rf_map.get(hid, 1.0)                    # Phase B: rating factor
        df  = _days_factor(e.get("days_since_last_run"))  # Phase B: days factor
        cf  = _class_factor(stats["horse_last_class"].get(hid), race_class)
        wcf = _weight_change_factor(e.get("weight"), stats["horse_last_weight"].get(hid))
        # Going factor (Phase 4C): infrastructure built but excluded from chain.
        # Walk-forward showed regression (-0.8% precision) — insufficient data
        # per horse at current DB volume (avg 0.3 SOFT entries/horse). Re-enable
        # after 2+ seasons of data accumulate.
        gf  = _going_factor(stats, hid, going_grp)        # computed, not applied

        raw = b_iv * jf * tf * hf * ff * rtf * df * cf * wcf

        raw_scores[hid] = raw
        augmented[hid]  = {**e, "b_iv": b_iv, "jf": jf, "tf": tf,
                            "hf": hf, "ff": ff,
                            "rtf": rtf, "df": df,          # Phase B factors
                            "cf": cf,                      # class transition
                            "wcf": wcf,                    # weight change
                            "gf": gf,                      # going (diagnostic only)
                            "raw_score": raw}

    total = sum(raw_scores.values())
    if total == 0:
        return []

    win_probs = {hid: s / total for hid, s in raw_scores.items()}

    # ── Market blend (opt-in) ────────────────────────────────────────────────
    # blend_coef="auto" loads the persisted coefficients; a dict uses it
    # directly; None keeps the pure factor model (default — keeps backtests
    # honest). Falls back to factor probs when any runner lacks odds.
    if blend_coef is not None:
        coef = load_blend_coef() if blend_coef == "auto" else blend_coef
        blended = _blend_win_probs(augmented, coef)
        if blended is not None:
            win_probs = blended

    h_probs   = harville_probs(win_probs)

    # Build result list sorted by show_pct so we can assign ranks
    unsorted = []
    for hid, rd in augmented.items():
        odds    = rd.get("public_odds")
        mkt_pct = (1.0 / odds * 100) if (odds and odds > 0) else 0.0
        hp      = h_probs[hid]
        win_pct = hp["win"] * 100
        unsorted.append({
            **rd,
            "win_pct":    win_pct,
            "place_pct":  hp["place"] * 100,
            "show_pct":   hp["show"]  * 100,
            "market_pct": mkt_pct,
            "edge":       win_pct - mkt_pct,
        })

    unsorted.sort(key=lambda x: x["show_pct"], reverse=True)

    # Value bets: must have edge AND be in model's top-3 predictions
    # Rationale: no reason to bet a horse our model ranks outside the podium
    results = []
    for rank, r in enumerate(unsorted, 1):
        r["is_value"] = (
            r["market_pct"] > 0
            and r["edge"] > EDGE_THRESHOLD
            and r["win_pct"] > MIN_MODEL_PCT
            and rank <= 3
        )
        results.append(r)

    return results
