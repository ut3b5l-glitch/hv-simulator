#!/usr/bin/env python3
"""
dashboard.py — Streamlit dashboard for the Happy Valley Simulator.
Read-only: never writes to the DB.

Run:  streamlit run dashboard.py
"""

import sqlite3
import base64
import random
import json
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

import model_core as mc

DB_PATH = Path(__file__).parent / "happy_valley.db"

# ─────────────────────────────────────────────────────────────────────────────
# DB helpers (read-only)
# ─────────────────────────────────────────────────────────────────────────────

def get_conn():
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def get_meeting_dates(conn):
    rows = conn.execute(
        "SELECT DISTINCT race_date FROM races WHERE venue='HV' ORDER BY race_date DESC"
    ).fetchall()
    return [r[0] for r in rows]


def get_races_for_date(conn, date):
    return conn.execute(
        "SELECT race_id, race_number, distance_m, course_config, race_class, going, field_size "
        "FROM races WHERE race_date=? AND venue='HV' ORDER BY race_number",
        (date,),
    ).fetchall()


def get_entries(conn, race_id):
    rows = conn.execute("""
        SELECT e.horse_id, h.horse_name, e.barrier,
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
            "horse_id": r[0], "horse_name": r[1], "barrier": r[2],
            "jockey_id": r[3], "jockey_name": r[4],
            "trainer_id": r[5], "trainer_name": r[6],
            "weight": r[7], "public_odds": r[8], "finish_position": r[9],
            "official_rating": r[10], "rating_change": r[11],
            "days_since_last_run": r[12], "last_6_runs": r[13],
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Page: Today's Races
# ─────────────────────────────────────────────────────────────────────────────

def page_races():
    st.header("Race Predictions")

    conn = get_conn()
    dates = get_meeting_dates(conn)
    if not dates:
        st.warning("No races in the database.")
        return

    selected_date = st.selectbox("Meeting date", dates, index=0)
    races = get_races_for_date(conn, selected_date)
    if not races:
        st.info("No races found for this date.")
        return

    stats = mc.build_stats(conn, before_date=selected_date, venue="HV")

    for race_id, race_no, dist, cfg, race_class, going, field_size in races:
        entries = get_entries(conn, race_id)
        if not entries:
            continue

        runners = mc.score_race(entries, stats, dist, cfg, race_class=race_class, going=going)
        if not runners:
            continue

        has_results = any(r.get("finish_position") for r in runners)
        has_odds = any(r.get("public_odds") for r in runners)

        class_str = race_class or "Class ?"
        going_str = going or "?"
        header = f"Race {race_no} — {dist}m {cfg} | {class_str} | Going: {going_str} | {len(runners)} runners"

        with st.expander(header, expanded=(race_no <= 2)):
            rows = []
            for rank, r in enumerate(runners, 1):
                row = {
                    "#": rank,
                    "Horse": r["horse_name"],
                    "Bar": r["barrier"],
                    "Jockey": r["jockey_name"],
                    "Win%": round(r["win_pct"], 1),
                    "Place%": round(r["place_pct"], 1),
                    "Show%": round(r["show_pct"], 1),
                }
                if has_odds:
                    row["Mkt%"] = round(r["market_pct"], 1)
                    row["Edge"] = round(r["edge"], 1)
                    row["Value"] = "Yes" if r["is_value"] else ""
                if has_results:
                    fp = r.get("finish_position")
                    row["Actual"] = int(fp) if fp else ""
                rows.append(row)

            df = pd.DataFrame(rows)
            pct_cols = [c for c in df.columns if c.endswith("%")]
            col_config = {c: st.column_config.NumberColumn(format="%.1f") for c in pct_cols}

            def highlight_top3(row):
                if row["#"] <= 3:
                    return ["background-color: #1a3a1a"] * len(row)
                return [""] * len(row)

            st.dataframe(
                df.style.apply(highlight_top3, axis=1),
                column_config=col_config,
                use_container_width=True,
                hide_index=True,
            )

            # Factor breakdown in a sub-expander
            with st.expander("Factor breakdown", expanded=False):
                factor_rows = []
                for rank, r in enumerate(runners, 1):
                    frow = {
                        "#": rank,
                        "Horse": r["horse_name"],
                        "Barrier IV": round(r["b_iv"], 2),
                        "Jockey F": round(r["jf"], 2),
                        "Trainer F": round(r["tf"], 2),
                        "Horse F": round(r["hf"], 2),
                        "Form": round(r["ff"], 2),
                        "Class F": round(r.get("cf", 1.0), 2),
                        "Wt Chg F": round(r.get("wcf", 1.0), 2),
                        "Rating": round(r["rtf"], 2),
                        "Days": round(r["df"], 2),
                        "Raw": round(r["raw_score"], 3),
                    }
                    factor_rows.append(frow)
                st.dataframe(pd.DataFrame(factor_rows), use_container_width=True, hide_index=True)

    conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Page: Paper Trades
# ─────────────────────────────────────────────────────────────────────────────

def page_paper_trades():
    st.header("Paper Trades")

    conn = get_conn()
    trades = conn.execute("""
        SELECT pt.trade_id, pt.trade_date, h.horse_name,
               pt.model_win_pct, pt.edge, pt.public_odds,
               pt.result, pt.finish_position, pt.profit
        FROM paper_trades pt
        JOIN horses h ON pt.horse_id = h.horse_id
        ORDER BY pt.trade_date DESC, pt.trade_id DESC
    """).fetchall()

    if not trades:
        st.info("No paper trades recorded yet. Use `phase6_importer.py` to log value bets.")
        conn.close()
        return

    df = pd.DataFrame(trades, columns=[
        "ID", "Date", "Horse", "Model Win%", "Edge%", "Odds",
        "Result", "Finish", "Profit",
    ])

    # Summary metrics
    settled = df[df["Result"].notna()]
    total_trades = len(df)
    settled_count = len(settled)
    wins = len(settled[settled["Result"] == "WIN"])
    total_pnl = settled["Profit"].sum() if len(settled) else 0
    strike_rate = (wins / settled_count * 100) if settled_count else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Trades", total_trades)
    c2.metric("Settled", settled_count)
    c3.metric("Strike Rate", f"{strike_rate:.1f}%")
    c4.metric("P&L", f"{total_pnl:+.1f} units")

    if len(settled) > 1:
        settled_sorted = settled.sort_values("Date")
        settled_sorted["Cumulative P&L"] = settled_sorted["Profit"].cumsum()
        fig = px.line(
            settled_sorted, x="Date", y="Cumulative P&L",
            title="Cumulative P&L",
            markers=True,
        )
        fig.update_layout(template="plotly_dark", height=350)
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("All Trades")
    st.dataframe(df, use_container_width=True, hide_index=True)

    conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Page: Model Health
# ─────────────────────────────────────────────────────────────────────────────

def page_model_health():
    st.header("Model Health")

    conn = get_conn()

    # Rolling precision: for each race date, compute top-3 precision
    race_dates = conn.execute("""
        SELECT DISTINCT race_date FROM races
        WHERE venue='HV'
        ORDER BY race_date
    """).fetchall()
    race_dates = [r[0] for r in race_dates]

    if len(race_dates) < 5:
        st.warning("Not enough race dates for rolling analysis.")
        conn.close()
        return

    st.subheader("Rolling Top-3 Precision")
    st.caption("For each meeting: what fraction of our top-3 picks actually finished top-3?")

    precision_data = []
    for date in race_dates:
        races = get_races_for_date(conn, date)
        stats = mc.build_stats(conn, before_date=date, venue="HV")
        correct = 0
        total = 0
        for race_id, race_no, dist, cfg, race_class, going, field_size in races:
            entries = get_entries(conn, race_id)
            if not entries:
                continue
            has_results = any(e.get("finish_position") for e in entries)
            if not has_results:
                continue
            runners = mc.score_race(entries, stats, dist, cfg, race_class=race_class, going=going)
            if not runners:
                continue
            for rank, r in enumerate(runners[:3], 1):
                fp = r.get("finish_position")
                if fp and fp <= 3:
                    correct += 1
                total += 1

        if total > 0:
            precision_data.append({
                "Date": date,
                "Precision": correct / total * 100,
                "Correct": correct,
                "Total": total,
            })

    if precision_data:
        pdf = pd.DataFrame(precision_data)

        # Rolling averages
        for window, label in [(5, "5-meeting"), (10, "10-meeting")]:
            if len(pdf) >= window:
                pdf[label] = pdf["Precision"].rolling(window).mean()

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=pdf["Date"], y=pdf["Precision"],
            mode="markers", name="Per meeting",
            marker=dict(size=5, opacity=0.4),
        ))
        if "5-meeting" in pdf.columns:
            fig.add_trace(go.Scatter(
                x=pdf["Date"], y=pdf["5-meeting"],
                mode="lines", name="5-meeting avg",
            ))
        if "10-meeting" in pdf.columns:
            fig.add_trace(go.Scatter(
                x=pdf["Date"], y=pdf["10-meeting"],
                mode="lines", name="10-meeting avg",
            ))
        fig.add_hline(y=25.7, line_dash="dash", line_color="red",
                      annotation_text="Random baseline (25.7%)")
        fig.update_layout(
            template="plotly_dark", height=400,
            yaxis_title="Top-3 Precision %",
            xaxis_title="Meeting Date",
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No completed races with results to analyse.")

    # Jockey form heatmap (trailing 60-day win rate)
    st.subheader("Jockey Form (Trailing 60 Days)")
    jockey_data = conn.execute("""
        SELECT j.jockey_name, j.jockey_id,
               SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) as wins,
               SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) as places,
               COUNT(*) as rides
        FROM race_entries e
        JOIN races r ON e.race_id = r.race_id
        JOIN jockeys j ON e.jockey_id = j.jockey_id
        WHERE r.venue = 'HV'
          AND r.race_date >= date((SELECT MAX(race_date) FROM races WHERE venue='HV'), '-60 days')
          AND e.finish_position IS NOT NULL
        GROUP BY j.jockey_id
        HAVING rides >= 5
        ORDER BY wins * 1.0 / rides DESC
    """).fetchall()

    if jockey_data:
        jdf = pd.DataFrame(jockey_data, columns=["Jockey", "ID", "Wins", "Places", "Rides"])
        jdf["Win%"] = (jdf["Wins"] / jdf["Rides"] * 100).round(1)
        jdf["Place%"] = (jdf["Places"] / jdf["Rides"] * 100).round(1)
        jdf = jdf.drop(columns=["ID"])
        st.dataframe(jdf, use_container_width=True, hide_index=True)

    # Trainer form heatmap
    st.subheader("Trainer Form (Trailing 60 Days)")
    trainer_data = conn.execute("""
        SELECT t.trainer_name, t.trainer_id,
               SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) as wins,
               SUM(CASE WHEN e.finish_position <= 3 THEN 1 ELSE 0 END) as places,
               COUNT(*) as rides
        FROM race_entries e
        JOIN races r ON e.race_id = r.race_id
        JOIN trainers t ON e.trainer_id = t.trainer_id
        WHERE r.venue = 'HV'
          AND r.race_date >= date((SELECT MAX(race_date) FROM races WHERE venue='HV'), '-60 days')
          AND e.finish_position IS NOT NULL
        GROUP BY t.trainer_id
        HAVING rides >= 3
        ORDER BY wins * 1.0 / rides DESC
    """).fetchall()

    if trainer_data:
        tdf = pd.DataFrame(trainer_data, columns=["Trainer", "ID", "Wins", "Places", "Rides"])
        tdf["Win%"] = (tdf["Wins"] / tdf["Rides"] * 100).round(1)
        tdf["Place%"] = (tdf["Places"] / tdf["Rides"] * 100).round(1)
        tdf = tdf.drop(columns=["ID"])
        st.dataframe(tdf, use_container_width=True, hide_index=True)

    conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Page: Race Lookup
# ─────────────────────────────────────────────────────────────────────────────

def page_race_lookup():
    st.header("Race Lookup")

    conn = get_conn()

    col1, col2 = st.columns(2)
    with col1:
        dates = get_meeting_dates(conn)
        selected_date = st.selectbox("Date", dates, index=0, key="lookup_date")
    with col2:
        races = get_races_for_date(conn, selected_date)
        race_options = {
            f"R{r[1]} — {r[2]}m {r[3]} ({r[4] or 'Class ?'})": r[0]
            for r in races
        }
        if not race_options:
            st.info("No races for this date.")
            conn.close()
            return
        selected_label = st.selectbox("Race", list(race_options.keys()), key="lookup_race")

    race_id = race_options[selected_label]
    race_info = races[[r[0] for r in races].index(race_id)]
    _, race_no, dist, cfg, race_class, going, field_size = race_info

    entries = get_entries(conn, race_id)
    if not entries:
        st.warning("No entries found.")
        conn.close()
        return

    stats = mc.build_stats(conn, before_date=selected_date, venue="HV")
    runners = mc.score_race(entries, stats, dist, cfg, race_class=race_class, going=going)
    if not runners:
        st.warning("Could not score race.")
        conn.close()
        return

    has_results = any(r.get("finish_position") for r in runners)
    has_odds = any(r.get("public_odds") for r in runners)

    # Summary bar
    st.markdown(f"**{selected_date} Race {race_no}** | {dist}m Course {cfg} | "
                f"{race_class or 'Class ?'} | Going: {going or '?'} | {len(runners)} runners")

    # Results table
    rows = []
    for rank, r in enumerate(runners, 1):
        row = {
            "Rank": rank,
            "Horse": r["horse_name"],
            "Barrier": r["barrier"],
            "Jockey": r["jockey_name"],
            "Trainer": r["trainer_name"],
            "Win%": round(r["win_pct"], 1),
            "Place%": round(r["place_pct"], 1),
            "Show%": round(r["show_pct"], 1),
        }
        if has_odds:
            row["Odds"] = r.get("public_odds") or ""
            row["Mkt%"] = round(r["market_pct"], 1)
            row["Edge"] = round(r["edge"], 1)
            row["Value"] = "Yes" if r["is_value"] else ""
        if has_results:
            fp = r.get("finish_position")
            row["Actual"] = int(fp) if fp else ""
        rows.append(row)

    df = pd.DataFrame(rows)
    pct_cols = [c for c in df.columns if c.endswith("%")]
    col_config = {c: st.column_config.NumberColumn(format="%.1f") for c in pct_cols}

    def highlight_rows(row):
        rank = row["Rank"]
        if has_results:
            fp = row.get("Actual")
            if rank <= 3 and fp and fp <= 3:
                return ["background-color: #1a3a1a"] * len(row)
            elif rank <= 3:
                return ["background-color: #3a2a1a"] * len(row)
        elif rank <= 3:
            return ["background-color: #1a3a1a"] * len(row)
        return [""] * len(row)

    st.dataframe(
        df.style.apply(highlight_rows, axis=1),
        column_config=col_config,
        use_container_width=True, hide_index=True,
    )

    # Factor chart
    st.subheader("Factor Breakdown")
    factor_names = ["Barrier IV", "Jockey", "Trainer", "Horse", "Form", "Class", "Wt Chg", "Rating", "Days"]
    factor_keys = ["b_iv", "jf", "tf", "hf", "ff", "cf", "wcf", "rtf", "df"]

    top3 = runners[:3]
    fig = go.Figure()
    for r in top3:
        fig.add_trace(go.Bar(
            name=r["horse_name"],
            x=factor_names,
            y=[r[k] for k in factor_keys],
        ))
    fig.add_hline(y=1.0, line_dash="dash", line_color="gray", annotation_text="Neutral (1.0)")
    fig.update_layout(
        template="plotly_dark", height=400,
        barmode="group",
        yaxis_title="Factor Value",
        title="Top-3 Factor Comparison",
    )
    st.plotly_chart(fig, use_container_width=True)

    # Accuracy check if results exist
    if has_results:
        st.subheader("Prediction Accuracy")
        correct = sum(1 for rank, r in enumerate(runners[:3], 1)
                      if r.get("finish_position") and r["finish_position"] <= 3)
        st.metric("Top-3 picks in actual top-3", f"{correct}/3")

        actual_winner = next((r for r in runners if r.get("finish_position") == 1), None)
        if actual_winner:
            winner_rank = runners.index(actual_winner) + 1
            st.metric("Actual winner's model rank", f"#{winner_rank} ({actual_winner['horse_name']})")

    conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Page: Race Simulation
# ─────────────────────────────────────────────────────────────────────────────

SILK_COLORS_SIM = [
    "#e63946", "#1d3557", "#f4a261", "#2a9d8f",
    "#e9c46a", "#6a0572", "#f72585", "#4361ee",
    "#fb5607", "#ff006e", "#8338ec", "#06d6a0",
    "#ff9f1c", "#2ec4b6",
]


@st.cache_data
def _load_audio_b64():
    p = Path(__file__).parent / "Mr Farts - Horse Racing Farts.mp3"
    return base64.b64encode(p.read_bytes()).decode() if p.exists() else None


def _simulate_race(runners):
    n = len(runners)
    total_frames = 720

    indices = list(range(n))
    probs = [max(r["win_pct"], 0.5) for r in runners]
    finish_order = []
    remaining = indices[:]
    rem_probs = probs[:]

    for _ in range(n):
        total_p = sum(rem_probs)
        if total_p <= 0:
            finish_order.extend(remaining)
            break
        rv = random.random() * total_p
        cs = 0
        for j, (idx, p) in enumerate(zip(remaining, rem_probs)):
            cs += p
            if cs >= rv:
                finish_order.append(idx)
                remaining.pop(j)
                rem_probs.pop(j)
                break

    winner_frame = int(total_frames * 0.82)
    styles = ["front_runner", "mid_pack", "closer"]

    horses = []
    cum_gap = 0
    for finish_rank, idx in enumerate(finish_order):
        r = runners[idx]

        if finish_rank == 0:
            gap = 0
        elif finish_rank < 3:
            gap = random.randint(5, 15)
        elif finish_rank < 6:
            gap = random.randint(10, 25)
        else:
            gap = random.randint(15, 35)
        cum_gap += gap

        target = winner_frame + cum_gap
        style = random.choice(styles)

        trajectory = []
        for f in range(total_frames):
            t = min(f / target, 1.0) if target > 0 else 1.0
            if style == "front_runner":
                pos = 1 - (1 - t) ** 2.5
            elif style == "closer":
                pos = t ** 2.5
            else:
                pos = 2 * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 2 / 2
            if 0.05 < t < 0.95:
                pos += random.gauss(0, 0.003)
            trajectory.append(round(max(0, min(1, pos)), 4))

        horses.append({
            "name": r["horse_name"],
            "barrier": r["barrier"],
            "jockey": r["jockey_name"],
            "win_pct": round(r["win_pct"], 1),
            "show_pct": round(r["show_pct"], 1),
            "model_rank": idx + 1,
            "finish_rank": finish_rank + 1,
            "actual_finish": r.get("finish_position"),
            "trajectory": trajectory,
            "silk_idx": (r["barrier"] - 1) % len(SILK_COLORS_SIM),
        })

    commentary = []

    def leader_at(frame):
        return max(horses, key=lambda h: h["trajectory"][min(frame, len(h["trajectory"]) - 1)])

    def sorted_at(frame):
        return sorted(horses, key=lambda h: h["trajectory"][min(frame, len(h["trajectory"]) - 1)], reverse=True)

    commentary.append({"frame": 30, "text": "AND THEY'RE OFF!"})
    ldr = leader_at(80)
    commentary.append({"frame": 80, "text": f"{ldr['name']} breaks sharply from barrier {ldr['barrier']}!"})
    ldr = leader_at(200)
    commentary.append({"frame": 200, "text": f"{ldr['name']} leads the field down the back straight."})
    top2 = sorted_at(350)[:2]
    commentary.append({"frame": 350, "text": f"Around the turn — {top2[0]['name']} from {top2[1]['name']}."})
    top3 = sorted_at(500)[:3]
    commentary.append({"frame": 500, "text": f"Into the final straight! {top3[0]['name']} leads, {top3[1]['name']} charging!"})
    top2 = sorted_at(570)[:2]
    g = abs(top2[0]["trajectory"][570] - top2[1]["trajectory"][570])
    if g < 0.03:
        commentary.append({"frame": 570, "text": f"Neck and neck! {top2[0]['name']} and {top2[1]['name']}!"})
    else:
        commentary.append({"frame": 570, "text": f"{top2[0]['name']} is pulling away!"})

    winner = next(h for h in horses if h["finish_rank"] == 1)
    second = next(h for h in horses if h["finish_rank"] == 2)
    third = next(h for h in horses if h["finish_rank"] == 3)
    commentary.append({
        "frame": winner_frame + 15,
        "text": f"{winner['name']} WINS! {second['name']} second, {third['name']} third!",
    })

    return {
        "horses": horses,
        "total_frames": total_frames,
        "winner_frame": winner_frame,
        "commentary": commentary,
    }


_RACE_HTML = """<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;flex-direction:column;align-items:center;overflow:hidden;position:relative;font-family:'Helvetica Neue',Arial,sans-serif}
canvas{display:block;max-width:100%}
#overlay{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);cursor:pointer;z-index:10}
#overlay.hidden{display:none}
.sb{text-align:center;color:#fff}
.sb h2{font-size:32px;margin-bottom:10px}
.sb p{font-size:14px;opacity:.7}
.sb .em{font-size:52px;margin-bottom:14px}
</style></head><body>
<div id="overlay" onclick="go()">
<div class="sb"><div class="em">&#127943;</div><h2>Click to Start Race</h2>
<p>__RACE_INFO__</p></div></div>
<canvas id="c" width="1200" height="700"></canvas>
<script>
var horses=__HORSES_DATA__;
var commentary=__COMMENTARY_DATA__;
var TOTAL=__TOTAL_FRAMES__,WFRAME=__WINNER_FRAME__,NUM=__NUM_HORSES__;
var audioSrc=__AUDIO_SRC__;
var audio=null;
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var W=1200,H=700;
var LANE_H=Math.min(42,Math.floor(480/NUM));
var TT=95,TH=LANE_H*NUM+10,TB=TT+TH,IT=TB+15;
var SX=95,FX=1130,TL=FX-SX;
var SILKS=['#e63946','#1d3557','#f4a261','#2a9d8f','#e9c46a','#6a0572','#f72585','#4361ee','#fb5607','#ff006e','#8338ec','#06d6a0','#ff9f1c','#2ec4b6'];
var S={READY:0,COUNT:1,RACE:2,DONE:3};
var state=S.READY,rf=0,cf=0,ac='',ci=0;

function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}

var blds=[];
for(var bx=15;bx<W;bx+=rnd(16,32)){
  var bw=rnd(10,26),bh=rnd(20,78),ls=[];
  for(var wy=90-bh+4;wy<88;wy+=7)for(var wx=bx+2;wx<bx+bw-2;wx+=5)
    if(Math.random()>.35)ls.push({x:wx,y:wy,a:.2+Math.random()*.6});
  blds.push({x:bx,w:bw,h:bh,ls:ls});
}
var strs=[];
for(var i=0;i<45;i++)strs.push({x:rnd(8,W-8),y:rnd(3,78),s:Math.random()>.6?1.5:1,p:Math.random()*6.28});

function drawSky(){
  var g=ctx.createLinearGradient(0,0,0,95);
  g.addColorStop(0,'#04101f');g.addColorStop(1,'#0f2040');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,95);
  ctx.fillStyle='#fff';
  for(var i=0;i<strs.length;i++){var s=strs[i];
    ctx.globalAlpha=.3+Math.sin(rf*.03+s.p)*.25;
    ctx.fillRect(s.x,s.y,s.s,s.s);}
  ctx.globalAlpha=1;
  for(var i=0;i<blds.length;i++){var b=blds[i];
    ctx.fillStyle='#0d1f35';ctx.fillRect(b.x,90-b.h,b.w,b.h);
    for(var j=0;j<b.ls.length;j++){var l=b.ls[j];
      ctx.globalAlpha=l.a*(.7+Math.sin(rf*.02+l.x)*.3);
      ctx.fillStyle='#ffd700';ctx.fillRect(l.x,l.y,2,3);}
    ctx.globalAlpha=1;}
}

function drawTrack(){
  for(var x=0;x<W;x+=25){
    ctx.fillStyle=(Math.floor(x/25)%2===0)?'#1e5c15':'#237219';
    ctx.fillRect(x,TT,25,TH);}
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.setLineDash([4,8]);
  for(var i=1;i<NUM;i++){var y=TT+i*LANE_H;
    ctx.beginPath();ctx.moveTo(SX,y);ctx.lineTo(FX+20,y);ctx.stroke();}
  ctx.setLineDash([]);
  ctx.fillStyle='#ddd';ctx.fillRect(0,TT-3,W,3);ctx.fillRect(0,TB,W,3);
  for(var x=20;x<W;x+=40){ctx.fillStyle='#bbb';ctx.fillRect(x,TT-8,2,8);ctx.fillRect(x,TB,2,8);}
  if(state<=S.COUNT){ctx.fillStyle='#444';
    for(var i=0;i<NUM;i++){var y=TT+i*LANE_H+2;
      ctx.fillRect(SX-28,y,28,LANE_H-4);ctx.strokeStyle='#666';ctx.lineWidth=1;ctx.strokeRect(SX-28,y,28,LANE_H-4);}}
  var fs=6;
  for(var fy=TT;fy<TB;fy+=fs)for(var fx=0;fx<3;fx++){
    ctx.fillStyle=((Math.floor(fy/fs)+fx)%2===0)?'#fff':'#cc0000';
    ctx.fillRect(FX+fx*fs,fy,fs,fs);}
  ctx.save();ctx.translate(FX+28,TT+TH/2);ctx.rotate(-Math.PI/2);
  ctx.fillStyle='#fff';ctx.font='bold 11px Helvetica';ctx.textAlign='center';ctx.fillText('FINISH',0,0);ctx.restore();
}

function drawHorse(x,y,si,phase,name,bar){
  ctx.save();ctx.translate(x,y);
  var sc=Math.min(1,LANE_H/42);ctx.scale(sc,sc);
  var silk=SILKS[si%SILKS.length];
  var la=Math.sin(phase),lb=Math.sin(phase+2.2);
  ctx.strokeStyle='#5a2d0c';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-18,-2);ctx.quadraticCurveTo(-28,-8+Math.sin(phase*1.5)*4,-24,3);ctx.stroke();
  ctx.strokeStyle='#6b3310';ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-10,7);ctx.lineTo(-10+lb*8,18);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-14,7);ctx.lineTo(-14+la*8,18);ctx.stroke();
  ctx.fillStyle='#8b4513';ctx.beginPath();ctx.ellipse(0,0,18,9,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#6b3310';ctx.lineWidth=1;ctx.stroke();
  ctx.strokeStyle='#6b3310';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(10,7);ctx.lineTo(10+la*9,18);ctx.stroke();
  ctx.beginPath();ctx.moveTo(6,7);ctx.lineTo(6+lb*9,18);ctx.stroke();
  ctx.fillStyle='#8b4513';
  ctx.beginPath();ctx.moveTo(14,-4);ctx.lineTo(22,-14);ctx.lineTo(18,-16);ctx.lineTo(10,-6);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.ellipse(24,-16,7,4.5,-.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(27,-17,1.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#7a3b10';ctx.beginPath();ctx.moveTo(21,-20);ctx.lineTo(19,-25);ctx.lineTo(23,-21);ctx.fill();
  ctx.fillStyle=silk;ctx.beginPath();ctx.ellipse(0,-12,5,7,-.15,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f0d5a8';ctx.beginPath();ctx.arc(2,-20,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=silk;ctx.beginPath();ctx.arc(2,-22,4,Math.PI,0);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 7px Helvetica';ctx.textAlign='center';ctx.fillText(bar.toString(),0,-10);
  ctx.restore();
  ctx.fillStyle='#fff';ctx.font='10px Helvetica';ctx.textAlign='center';
  ctx.globalAlpha=.9;ctx.fillText(name,x,y-22*sc);ctx.globalAlpha=1;
}

function drawInfo(){
  ctx.fillStyle='#111';ctx.fillRect(0,IT,W,H-IT);
  ctx.fillStyle='#888';ctx.font='12px Helvetica';ctx.textAlign='left';
  ctx.fillText('__RACE_INFO__',20,IT+20);
  ctx.fillStyle='#ffd700';ctx.font='bold 18px Helvetica';ctx.textAlign='center';
  ctx.fillText(ac,W/2,IT+55);
  if(state===S.RACE){var pct=rf/TOTAL;
    ctx.fillStyle='#333';ctx.fillRect(20,IT+75,W-40,6);
    ctx.fillStyle='#2a9d8f';ctx.fillRect(20,IT+75,(W-40)*pct,6);}
  if(state>=S.RACE){
    var sr=[...horses].sort(function(a,b){
      var fa=Math.min(rf,a.trajectory.length-1),fb=Math.min(rf,b.trajectory.length-1);
      return b.trajectory[fb]-a.trajectory[fa];});
    ctx.textAlign='right';ctx.font='11px Helvetica';
    var cols=['#ffd700','#c0c0c0','#cd7f32'];
    for(var i=0;i<Math.min(3,sr.length);i++){
      ctx.fillStyle=cols[i];ctx.fillText((i+1)+'. '+sr[i].name,W-20,IT+20+i*16);}}
}

function drawCount(n){
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#ffd700';ctx.font='bold 120px Helvetica';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(n.toString(),W/2,H/2-30);
  ctx.font='24px Helvetica';ctx.fillStyle='#fff';ctx.fillText('GET READY',W/2,H/2+50);
  ctx.textBaseline='alphabetic';
}

function rrect(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
}

function drawResults(){
  ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(0,0,W,H);
  var cw=720,ch=Math.min(480,80+NUM*28+40),cx=(W-cw)/2,cy=(H-ch)/2-10;
  ctx.fillStyle='#1a1a2e';ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
  rrect(cx,cy,cw,ch,12);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffd700';ctx.font='bold 26px Helvetica';ctx.textAlign='center';
  ctx.fillText('RACE RESULTS',W/2,cy+38);
  ctx.fillStyle='#666';ctx.font='12px Helvetica';ctx.textAlign='left';
  ctx.fillText('POS',cx+25,cy+68);ctx.fillText('HORSE',cx+65,cy+68);
  ctx.fillText('JOCKEY',cx+280,cy+68);ctx.fillText('MODEL',cx+445,cy+68);
  ctx.fillText('WIN%',cx+510,cy+68);ctx.fillText('ACTUAL',cx+585,cy+68);
  ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx+15,cy+75);ctx.lineTo(cx+cw-15,cy+75);ctx.stroke();
  var sr=[...horses].sort(function(a,b){return a.finish_rank-b.finish_rank;});
  var pc=['#ffd700','#c0c0c0','#cd7f32'];
  for(var i=0;i<Math.min(sr.length,12);i++){var h=sr[i],ry=cy+92+i*28;
    ctx.fillStyle=i<3?pc[i]:'#aaa';ctx.font=i<3?'bold 14px Helvetica':'13px Helvetica';ctx.textAlign='left';
    ctx.fillText((i+1).toString(),cx+30,ry);
    ctx.fillStyle=SILKS[h.silk_idx];ctx.beginPath();ctx.arc(cx+55,ry-4,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=i<3?'#fff':'#bbb';ctx.font=i<3?'bold 13px Helvetica':'13px Helvetica';
    ctx.fillText(h.name,cx+65,ry);
    ctx.fillStyle='#999';ctx.font='12px Helvetica';ctx.fillText(h.jockey,cx+280,ry);
    ctx.fillStyle='#2a9d8f';ctx.fillText('#'+h.model_rank,cx+450,ry);
    ctx.fillText(h.win_pct+'%',cx+510,ry);
    if(h.actual_finish!==null&&h.actual_finish!==undefined){
      ctx.fillStyle=h.actual_finish<=3?'#4caf50':'#999';ctx.fillText('P'+h.actual_finish,cx+590,ry);
    }else{ctx.fillStyle='#555';ctx.fillText('-',cx+590,ry);}
  }
  ctx.fillStyle='#555';ctx.font='13px Helvetica';ctx.textAlign='center';
  ctx.fillText('Click to run again',W/2,cy+ch-12);
}

function render(){
  ctx.clearRect(0,0,W,H);drawSky();drawTrack();
  for(var i=0;i<horses.length;i++){var h=horses[i];
    var fi=Math.min(rf,h.trajectory.length-1);
    var pos=(state>=S.RACE)?h.trajectory[fi]:0;
    var x=SX+pos*TL,li=h.barrier-1,y=TT+li*LANE_H+LANE_H/2;
    var spd=(state===S.RACE&&fi>0)?(h.trajectory[fi]-h.trajectory[Math.max(0,fi-1)])*800:0;
    var ph=rf*(.3+spd*2);
    drawHorse(x,y,h.silk_idx,ph,h.name,h.barrier);}
  drawInfo();
  if(state===S.COUNT){var n=3-Math.floor(cf/60);if(n>0)drawCount(n);
    cf++;if(cf>=180){state=S.RACE;ac="AND THEY'RE OFF!";}}
  if(state===S.RACE){rf++;
    while(ci<commentary.length&&commentary[ci].frame<=rf){ac=commentary[ci].text;ci++;}
    if(rf>=TOTAL)state=S.DONE;}
  if(state===S.DONE&&rf>TOTAL+90)drawResults();
  else if(state===S.DONE)rf++;
  if(state!==S.READY)requestAnimationFrame(render);
}

function go(){
  document.getElementById('overlay').classList.add('hidden');
  if(audioSrc){audio=new Audio(audioSrc);audio.volume=0.5;audio.play().catch(function(){});}
  state=S.COUNT;cf=0;rf=0;ci=0;ac='';render();
}

canvas.addEventListener('click',function(){
  if(state===S.DONE&&rf>TOTAL+90){
    state=S.COUNT;cf=0;rf=0;ci=0;ac='';
    if(audio){audio.currentTime=0;audio.play().catch(function(){});}
    render();}
});

drawSky();drawTrack();
for(var i=0;i<horses.length;i++){var h=horses[i];
  var li=h.barrier-1,y=TT+li*LANE_H+LANE_H/2;
  drawHorse(SX,y,h.silk_idx,0,h.name,h.barrier);}
drawInfo();
</script></body></html>"""


def _build_race_html(sim_data, audio_b64, race_info_str):
    audio_val = "null"
    if audio_b64:
        audio_val = '"data:audio/mp3;base64,' + audio_b64 + '"'
    return (_RACE_HTML
        .replace("__HORSES_DATA__", json.dumps(sim_data["horses"]))
        .replace("__COMMENTARY_DATA__", json.dumps(sim_data["commentary"]))
        .replace("__TOTAL_FRAMES__", str(sim_data["total_frames"]))
        .replace("__WINNER_FRAME__", str(sim_data["winner_frame"]))
        .replace("__NUM_HORSES__", str(len(sim_data["horses"])))
        .replace("__RACE_INFO__", race_info_str)
        .replace("__AUDIO_SRC__", audio_val)
    )


def page_simulation():
    st.header("Race Simulation")

    conn = get_conn()

    col1, col2 = st.columns(2)
    with col1:
        dates = get_meeting_dates(conn)
        selected_date = st.selectbox("Date", dates, index=0, key="sim_date")
    with col2:
        races = get_races_for_date(conn, selected_date)
        race_options = {
            f"R{r[1]} — {r[2]}m {r[3]} ({r[4] or 'Class ?'})": r[0]
            for r in races
        }
        if not race_options:
            st.info("No races for this date.")
            conn.close()
            return
        selected_label = st.selectbox("Race", list(race_options.keys()), key="sim_race")

    race_id = race_options[selected_label]
    race_info = races[[r[0] for r in races].index(race_id)]
    _, race_no, dist, cfg, race_class, going, field_size = race_info

    entries = get_entries(conn, race_id)
    if not entries:
        st.warning("No entries found.")
        conn.close()
        return

    stats = mc.build_stats(conn, before_date=selected_date, venue="HV")
    runners = mc.score_race(entries, stats, dist, cfg, race_class=race_class, going=going)
    if not runners:
        st.warning("Could not score race.")
        conn.close()
        return

    race_info_str = (f"{selected_date} Race {race_no} | {dist}m Course {cfg} | "
                     f"{race_class or 'Class ?'} | {len(runners)} runners")
    st.markdown(f"**{race_info_str}**")

    quick = []
    for rank, r in enumerate(runners[:5], 1):
        quick.append({"#": rank, "Horse": r["horse_name"], "Win%": round(r["win_pct"], 1),
                       "Show%": round(r["show_pct"], 1), "Jockey": r["jockey_name"]})
    st.dataframe(pd.DataFrame(quick), use_container_width=True, hide_index=True)

    if st.button("Start Race!", type="primary"):
        sim_data = _simulate_race(runners)
        audio_b64 = _load_audio_b64()
        html = _build_race_html(sim_data, audio_b64, race_info_str)
        components.html(html, height=720, scrolling=False)

    conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Main app
# ─────────────────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="HV Simulator",
    page_icon="horse_racing",
    layout="wide",
)

st.title("Happy Valley Simulator")

page = st.sidebar.radio("Navigation", [
    "Race Predictions",
    "Paper Trades",
    "Model Health",
    "Race Lookup",
    "Race Simulation",
])

if page == "Race Predictions":
    page_races()
elif page == "Paper Trades":
    page_paper_trades()
elif page == "Model Health":
    page_model_health()
elif page == "Race Lookup":
    page_race_lookup()
elif page == "Race Simulation":
    page_simulation()
