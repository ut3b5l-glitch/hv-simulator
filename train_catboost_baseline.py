#!/usr/bin/env python3
"""
train_catboost_baseline.py — confirmatory ML baseline (Phase 5 sanity check).

Purpose
───────
Independent check of whether a gradient-boosted tree (CatBoost), given the same
leak-safe historical features an ML pipeline would build, beats the hand-crafted
factor model / market blend at Happy Valley. Mirrors the public hkjc-ml-research
setup (LightGBM/CatBoost, market-free vs market-aware, log-loss + Brier) so the
numbers are directly comparable.

This file is OFFLINE research only. It does NOT touch model_core.py, the blend
coefficients, export_data.py, or the deployed PWA. It reads happy_valley.db and
prints a report.

Method
──────
  • Runner-level table, one row per (race, horse), HV finishers only.
  • Features engineered with strict leak-safety: every horse/jockey/trainer stat
    is an expanding or rolling aggregate SHIFTED by one start (current race
    excluded). Two feature sets:
        market-free   — fundamentals only
        market-aware  — fundamentals + log(win_odds)
  • PRIMARY eval is a leak-free EXPANDING WALK-FORWARD: the recent tail of the
    history is cut into folds; for each fold the model is retrained on all races
    strictly before it, then predicts that fold. Predictions are pooled across
    folds so the headline number is not a single lucky split. (A single
    newest-split run overfits badly on HV's ~7k rows — see the docstring note in
    git history; walk-forward is the trustworthy view.)
  • Target: win (finish_position == 1).
  • Metrics: per-runner binary log-loss + Brier (Jerry's numbers), plus
    race-normalized win probabilities → top-pick win rate and winner-in-top-3.

Run:  python3 train_catboost_baseline.py
"""
from __future__ import annotations

import sqlite3
import warnings

import numpy as np
import pandas as pd

warnings.simplefilter("ignore")

DB = "happy_valley.db"
VENUE = "HV"
TEST_FRAC = 0.20      # newest 20% of races held out for test
SEED = 42


# ── Load ─────────────────────────────────────────────────────────────────────
def load_frame(conn) -> pd.DataFrame:
    df = pd.read_sql_query(
        """
        SELECT e.race_id, e.horse_id, e.jockey_id, e.trainer_id,
               e.barrier, e.weight, e.public_odds, e.finish_position,
               r.race_date, r.race_number, r.distance_m, r.course_config,
               r.track_surface, r.field_size
        FROM race_entries e JOIN races r ON e.race_id = r.race_id
        WHERE r.venue = ? AND e.finish_position IS NOT NULL
        """,
        conn, params=(VENUE,),
    )
    df["race_date"] = pd.to_datetime(df["race_date"])
    # Sort within a race by a PRE-RACE key (barrier), never by finish_position,
    # so the shift-based priors can't pick up within-race outcome ordering.
    df = df.sort_values(["race_date", "race_number", "barrier"]).reset_index(drop=True)
    df["win"] = (df["finish_position"] == 1).astype(int)
    df["top3"] = (df["finish_position"] <= 3).astype(int)
    return df


# ── Leak-safe feature engineering ────────────────────────────────────────────
def _expanding_prior(df, group_cols, flag, name):
    """Cumulative count of `flag` over prior starts within group (current row excluded)."""
    g = df.groupby(group_cols)[flag]
    return g.cumsum().shift(1).where(df.groupby(group_cols).cumcount() > 0, np.nan).rename(name)


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["ones"] = 1

    # Race context (all known pre-race)
    df["draw_norm"] = df["barrier"] / df["field_size"].clip(lower=1)
    df["log_win_odds"] = np.log(df["public_odds"].where(df["public_odds"] > 0))
    df["mkt_prob"] = (1.0 / df["public_odds"]).where(df["public_odds"] > 0)

    def prior_block(keys, prefix):
        gc = df.groupby(keys)
        n = gc.cumcount()                                   # prior starts
        starts = n.rename(f"{prefix}_prev_starts")
        wins = gc["win"].cumsum().shift(1).rename(f"{prefix}_prev_wins")
        top3 = gc["top3"].cumsum().shift(1).rename(f"{prefix}_prev_top3")
        out = pd.concat([starts, wins, top3], axis=1)
        out.loc[n == 0, [f"{prefix}_prev_wins", f"{prefix}_prev_top3"]] = np.nan
        with np.errstate(invalid="ignore", divide="ignore"):
            out[f"{prefix}_prev_win_rate"] = out[f"{prefix}_prev_wins"] / starts.replace(0, np.nan)
            out[f"{prefix}_prev_top3_rate"] = out[f"{prefix}_prev_top3"] / starts.replace(0, np.nan)
        return out

    df = pd.concat([df,
                    prior_block(["horse_id"], "horse"),
                    prior_block(["jockey_id"], "jockey"),
                    prior_block(["trainer_id"], "trainer"),
                    prior_block(["horse_id", "jockey_id"], "hj"),
                    prior_block(["horse_id", "trainer_id"], "ht")], axis=1)

    # Same-distance / same-config horse top-3 rate (leak-safe)
    for keys, nm in [(["horse_id", "distance_m"], "horse_dist"),
                     (["horse_id", "course_config"], "horse_cfg")]:
        gc = df.groupby(keys)
        n = gc.cumcount()
        t3 = gc["top3"].cumsum().shift(1)
        with np.errstate(invalid="ignore", divide="ignore"):
            df[f"{nm}_top3_rate"] = (t3 / n.replace(0, np.nan)).where(n > 0, np.nan)

    # Recency: rolling mean finish pos (prior starts only) + days since last run
    g = df.groupby("horse_id")
    df["horse_avg_pos_last3"] = g["finish_position"].apply(
        lambda s: s.shift(1).rolling(3, min_periods=1).mean()).reset_index(level=0, drop=True)
    df["horse_avg_pos_last5"] = g["finish_position"].apply(
        lambda s: s.shift(1).rolling(5, min_periods=1).mean()).reset_index(level=0, drop=True)
    df["horse_days_since"] = g["race_date"].diff().dt.days

    # Jockey / trainer hot form: rolling win rate over last 30 prior rides
    for key, pre in [("jockey_id", "jockey"), ("trainer_id", "trainer")]:
        gg = df.groupby(key)
        df[f"{pre}_winrate_last30"] = gg["win"].apply(
            lambda s: s.shift(1).rolling(30, min_periods=5).mean()).reset_index(level=0, drop=True)

    return df


FUNDAMENTAL = [
    "field_size", "draw_norm", "weight", "distance_m",
    "horse_prev_starts", "horse_prev_win_rate", "horse_prev_top3_rate",
    "jockey_prev_starts", "jockey_prev_win_rate", "jockey_prev_top3_rate",
    "trainer_prev_starts", "trainer_prev_win_rate", "trainer_prev_top3_rate",
    "hj_prev_starts", "hj_prev_win_rate",
    "ht_prev_starts", "ht_prev_win_rate",
    "horse_dist_top3_rate", "horse_cfg_top3_rate",
    "horse_avg_pos_last3", "horse_avg_pos_last5", "horse_days_since",
    "jockey_winrate_last30", "trainer_winrate_last30",
]
MARKET = ["log_win_odds", "mkt_prob"]


# ── Metrics ──────────────────────────────────────────────────────────────────
def binary_logloss(y, p):
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def brier(y, p):
    return float(np.mean((p - y) ** 2))


def race_normalise(df_test, p):
    out = np.empty_like(p)
    tmp = df_test.assign(_p=p)
    for _, idx in tmp.groupby("race_id").groups.items():
        sel = tmp.index.get_indexer(idx)
        s = p[sel].sum()
        out[sel] = p[sel] / s if s > 0 else 1.0 / len(sel)
    return out


def ranking_metrics(df_test, p_norm):
    tmp = df_test.assign(_p=p_norm)
    n = win = cover = 0
    prec = 0.0
    for _, grp in tmp.groupby("race_id"):
        if grp["win"].sum() == 0:
            continue
        n += 1
        order = grp.sort_values("_p", ascending=False)
        top3_actual = set(grp[grp["top3"] == 1]["horse_id"])
        top_pick = order.iloc[0]
        win += int(top_pick["win"] == 1)
        cover += int(top_pick["horse_id"] in top3_actual)
        picks = set(order.head(3)["horse_id"])
        prec += len(picks & top3_actual) / 3.0
    return dict(n=n, top_win=win / n * 100, winner_in_top3=cover / n * 100,
                top3_prec=prec / n * 100)


# ── Train one CatBoost, return test-row win probabilities ────────────────────
def fit_predict(train, test, feats):
    from catboost import CatBoostClassifier, Pool

    Xtr = train[feats].astype(float).fillna(-1.0)
    Xte = test[feats].astype(float).fillna(-1.0)
    ytr = train["win"].values

    cut = max(1, int(len(train) * 0.85))   # chronological val tail for early stop
    model = CatBoostClassifier(
        iterations=1200, learning_rate=0.03, depth=6,
        l2_leaf_reg=6.0, loss_function="Logloss", eval_metric="Logloss",
        random_seed=SEED, verbose=False, early_stopping_rounds=80,
    )
    model.fit(Pool(Xtr.iloc[:cut], ytr[:cut]),
              eval_set=Pool(Xtr.iloc[cut:], ytr[cut:]), use_best_model=True)
    return model.predict_proba(Xte)[:, 1], model


def pooled_metrics(label, frames, probs):
    """frames/probs: lists (one per fold) of test DataFrame + prob array. Pool all."""
    df_all = pd.concat(frames, ignore_index=True)
    p_all = np.concatenate(probs)
    p_norm = race_normalise(df_all, p_all)
    y = df_all["win"].values
    rank = ranking_metrics(df_all, p_norm)
    return {"label": label, "logloss": binary_logloss(y, p_norm),
            "brier": brier(y, p_norm), **rank}


def walk_forward(df, n_tail=240, folds=6):
    """Leak-free expanding walk-forward over the most recent `n_tail` races."""
    race_dates = (df[["race_id", "race_date"]].drop_duplicates()
                  .sort_values("race_date").reset_index(drop=True))
    n_tail = min(n_tail, len(race_dates) - 50)
    tail = race_dates.tail(n_tail).reset_index(drop=True)
    bounds = np.linspace(0, n_tail, folds + 1).astype(int)

    coll = {"market": ([], []), "free": ([], []), "aware": ([], [])}
    fold_rows = []
    for k in range(folds):
        ids = set(tail["race_id"].iloc[bounds[k]:bounds[k + 1]])
        if not ids:
            continue
        fold_start = tail["race_date"].iloc[bounds[k]]
        train = df[df["race_date"] < fold_start].copy()
        test = df[df["race_id"].isin(ids)].copy()
        if len(train) < 200 or test.empty:
            continue

        # market needs no training
        coll["market"][0].append(test)
        coll["market"][1].append(test["mkt_prob"].fillna(0.0).values)
        p_free, _ = fit_predict(train, test, FUNDAMENTAL)
        coll["free"][0].append(test); coll["free"][1].append(p_free)
        p_aware, m_aware = fit_predict(train, test, FUNDAMENTAL + MARKET)
        coll["aware"][0].append(test); coll["aware"][1].append(p_aware)
        fold_rows.append((str(fold_start.date()), len(test), m_aware.get_best_iteration()))

    return coll, fold_rows


def main():
    conn = sqlite3.connect(DB)
    df = load_frame(conn)
    conn.close()
    df = add_features(df)

    print("=" * 78)
    print("  CatBoost confirmatory baseline — Happy Valley (HV only, leak-free walk-forward)")
    print("=" * 78)
    print(f"  rows {len(df)}   races {df['race_id'].nunique()}   "
          f"features {len(FUNDAMENTAL)} fundamental (+{len(MARKET)} market)")

    coll, fold_rows = walk_forward(df)
    print(f"  walk-forward: {len(fold_rows)} folds, "
          f"{sum(n for _, n, _ in fold_rows)} pooled test rows, retrained each fold")
    print("-" * 78)

    results = [
        pooled_metrics("market (de-vig)", *coll["market"]),
        pooled_metrics("CatBoost market-free", *coll["free"]),
        pooled_metrics("CatBoost market-aware", *coll["aware"]),
    ]
    print(f"  {'model':<24} {'LogLoss':>8} {'Brier':>7} "
          f"{'#1 Win':>7} {'Win-in-T3':>10} {'T3 Prec':>8}  races")
    print("  " + "-" * 72)
    for r in results:
        print(f"  {r['label']:<24} {r['logloss']:>8.4f} {r['brier']:>7.4f} "
              f"{r['top_win']:>6.1f}% {r['winner_in_top3']:>9.1f}% "
              f"{r['top3_prec']:>7.1f}% {r['n']:>5}")
    print("=" * 78)
    print("  Reference — hkjc-ml-research CatBoost market-aware (all-HKJC, 64k rows):")
    print("    LogLoss 0.2354   Brier 0.0657   #1 Win 32.70%   Win-in-T3 62.14%")
    print("  Reference — HV market-blend (validate_blend.py, leak-free walk-forward):")
    print("    #1 Win ~28%   #1 Place(Win-in-T3) ~60%   Top-3 precision ~50%")
    print("=" * 78)


if __name__ == "__main__":
    main()
