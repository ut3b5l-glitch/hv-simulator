#!/usr/bin/env python3
"""
export_consumer.py — build the CONSUMER data snapshot for the Zokki consumer PWA.

Reads the analytic snapshot in `web/public/data/` (produced by export_data.py),
which is the SOURCE OF TRUTH and is never modified, and writes a consumer-shaped
snapshot to `web-consumer/public/data/`:

  * adds a plain-English `verdict` (confidence tag) to every race
  * adds a 2-3 sentence `narrative` race read to every race
      - real Claude API when `--llm` is passed AND ANTHROPIC_API_KEY is set
        (model via ANTHROPIC_MODEL env, default claude-opus-4-7)
      - a high-quality built-in writer otherwise (offline, no key, deterministic)
  * marks backtest / demo meetings (`demo: true`) and EXCLUDES them from the
    lifetime Track Record headline (honest receipts — see DEMO_DATES)
  * drops the quant-only blocks (model_quality, betting, win_edge, value-bet ROI)
    from the consumer performance feed

Usage:
    python3 export_consumer.py            # built-in writer (works offline)
    python3 export_consumer.py --llm      # real Claude narratives (needs API key)
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "web" / "public" / "data"
DST = ROOT / "web-consumer" / "public" / "data"

# Backtest / demo cards retro-scored from history. Real, but NOT genuinely-live
# meetings — kept visible (clearly labelled) but excluded from the headline.
DEMO_DATES = {"2024-11-09", "2026-05-31"}

# "Live chance" threshold (win %) used to count contenders in a race.
LIVE_PCT = 12.0


# ---------------------------------------------------------------------------
# Verdict — a one-line confidence read derived from the win-probability shape.
# ---------------------------------------------------------------------------
def build_verdict(race: dict) -> dict:
    runners = sorted(race["runners"], key=lambda r: r["rank"])
    if not runners:
        return {"label": "No card", "detail": "", "tone": "open"}
    w1 = runners[0]["win_pct"]
    w2 = runners[1]["win_pct"] if len(runners) > 1 else 0.0
    gap = w1 - w2
    live = max(1, sum(1 for r in runners if r["win_pct"] >= LIVE_PCT))
    top = runners[0]["horse_name"]

    if w1 >= 32 and gap >= 9:
        return {"label": "Standout", "detail": f"{top} is a clear top pick", "tone": "standout"}
    if w1 >= 25:
        return {"label": "Confident", "detail": f"{top} the one to beat", "tone": "confident"}
    if w1 >= 18:
        return {"label": "Competitive", "detail": f"{live} genuine chances", "tone": "competitive"}
    return {"label": "Wide open", "detail": f"{live} live chances", "tone": "open"}


# ---------------------------------------------------------------------------
# Built-in narrative writer (offline fallback / default).
# Information & entertainment only — never tells the reader to bet.
# ---------------------------------------------------------------------------
def _form_phrase(last6: str | None) -> str | None:
    if not last6:
        return None
    parts = [p.strip() for p in last6.split("/") if p.strip()]
    nums = [int(p) for p in parts if p.isdigit()]
    if not nums:
        return None
    n = len(nums)
    wins = sum(1 for x in nums if x == 1)
    placed = sum(1 for x in nums if x <= 3)
    if wins >= 2:
        return f"a winner {wins} times in its last {n}"
    if placed >= 3:
        return f"in the frame {placed} of its last {n} starts"
    if placed >= 1:
        return f"placed {placed} of its last {n}"
    return "still searching for its best recent form"


def _is_market_fav(runner: dict, runners: list[dict]) -> bool:
    mkts = [r.get("market_pct") for r in runners if r.get("market_pct") is not None]
    if not mkts or runner.get("market_pct") is None:
        return False
    return runner["market_pct"] >= max(mkts) - 1e-6


def _market_phrase(top: dict, runners: list[dict]) -> str:
    edge = top.get("edge")
    fav = _is_market_fav(top, runners)
    if edge is None:
        return "and the punters are with it" if fav else "and the model leans its way"
    if edge > 3:
        return "and our model rates it more generously than the market"
    if edge < -3:
        return "though the market is even keener than we are"
    return "with the market agreeing" if fav else "broadly in line with the market"


def writer_narrative(race: dict, verdict: dict) -> str:
    runners = sorted(race["runners"], key=lambda r: r["rank"])
    top = runners[0]
    name = top["horse_name"]
    form = _form_phrase(top.get("last_6_runs"))
    mkt = _market_phrase(top, runners)
    jockey = top.get("jockey_name")

    # Sentence 1 — the top pick.
    lead = {
        "standout": f"{name} stands clearly above this field",
        "confident": f"{name} is our pick to beat",
        "competitive": f"We just edge {name} to the front of a competitive race",
        "open": f"This is wide open, but we shade {name}",
    }[verdict["tone"]]
    bits = [lead]
    if form:
        bits[0] += f" — {form}"
    bits[0] += f", {mkt}"
    if jockey:
        bits[0] += f", {jockey} aboard"
    s1 = bits[0] + "."

    # Sentence 2 — danger + any model overlay.
    danger = runners[1] if len(runners) > 1 else None
    overlay = next((r for r in runners if r.get("is_value") and r is not top), None)
    if danger and overlay and overlay is not danger:
        s2 = (f"The chief threat is {danger['horse_name']}, while {overlay['horse_name']} "
              f"is the price our model flags as an overlay.")
    elif danger:
        third = runners[2] if len(runners) > 2 else None
        if third:
            s2 = f"{danger['horse_name']} looks the main danger, with {third['horse_name']} next on the list."
        else:
            s2 = f"{danger['horse_name']} looks the main danger."
    else:
        s2 = ""

    # Sentence 3 — shape, tuned to confidence.
    s3 = {
        "standout": "If it runs to form, the placings should fall in behind it.",
        "confident": "Expect the frame to come from the top of our order.",
        "competitive": "A race to watch unfold rather than one to read too much into.",
        "open": "Hard to be dogmatic here — treat our order as a guide, not gospel.",
    }[verdict["tone"]]

    return " ".join(p for p in (s1, s2, s3) if p)


# ---------------------------------------------------------------------------
# Optional real-Claude narratives (--llm, needs ANTHROPIC_API_KEY).
# ---------------------------------------------------------------------------
_SYSTEM = """You are the race-reading voice of Zokki, a Hong Kong horse-racing \
companion app. You write a short, vivid preview for a single race so a casual \
fan understands the shape of it in ten seconds.

Rules:
- Exactly 2-3 sentences. Plain, warm, confident language. No jargon, no numbers \
dumped raw, no factor names.
- Information & entertainment ONLY. Never instruct the reader to bet, never use \
the words "bet", "stake", or "wager". You may say a horse "looks overrated by \
the market" or "is the value angle" as analysis.
- Lead with the top pick and why. Name the chief danger. Close on the shape of \
the race (confident standout vs. wide open).
- Use the horses' names. Do not invent facts beyond what is provided."""


def _race_facts(race: dict, verdict: dict) -> str:
    runners = sorted(race["runners"], key=lambda r: r["rank"])[:6]
    lines = [
        f'Race {race.get("race_number")}: {race.get("distance_m")}m, '
        f'{race.get("race_class") or "class ?"}, {len(race["runners"])} runners.',
        f'Confidence read: {verdict["label"]} ({verdict["detail"]}).',
        "Our order (win %):",
    ]
    for r in runners:
        extra = []
        if r.get("last_6_runs"):
            extra.append(f'recent form {r["last_6_runs"]}')
        if r.get("jockey_name"):
            extra.append(f'jockey {r["jockey_name"]}')
        if r.get("is_value"):
            extra.append("model flags as an overlay vs market")
        tail = f' ({"; ".join(extra)})' if extra else ""
        lines.append(f'  {r["rank"]}. {r["horse_name"]} — {r["win_pct"]:.0f}%{tail}')
    return "\n".join(lines)


def claude_narrative(client, model: str, race: dict, verdict: dict) -> str:
    msg = client.messages.create(
        model=model,
        max_tokens=300,
        system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": _race_facts(race, verdict)}],
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()


def make_narrator(use_llm: bool):
    """Return (fn(race, verdict) -> str, label). Falls back to the writer on any error."""
    if not use_llm:
        return (lambda race, v: writer_narrative(race, v)), "built-in writer"
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("  [--llm] ANTHROPIC_API_KEY not set — using built-in writer.")
        return (lambda race, v: writer_narrative(race, v)), "built-in writer"
    try:
        from anthropic import Anthropic
    except ImportError:
        print("  [--llm] `anthropic` not installed (pip install anthropic) — using built-in writer.")
        return (lambda race, v: writer_narrative(race, v)), "built-in writer"

    client = Anthropic()
    model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-7")

    def fn(race, v):
        try:
            return claude_narrative(client, model, race, v)
        except Exception as exc:  # best-effort: one bad race never breaks the export
            print(f"  [--llm] race {race.get('race_number')} fell back ({exc}).")
            return writer_narrative(race, v)

    return fn, f"Claude ({model})"


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
def transform_meeting(path: Path, narrate) -> dict:
    meeting = json.loads(path.read_text())
    meeting["demo"] = meeting.get("meeting_date") in DEMO_DATES
    for race in meeting["races"]:
        verdict = build_verdict(race)
        race["verdict"] = verdict
        race["narrative"] = narrate(race, verdict)
    return meeting


def _market_fav(runners: list[dict]) -> dict | None:
    """The market favourite = shortest odds = highest implied (market) probability."""
    mkts = [r for r in runners if r.get("market_pct") is not None]
    return max(mkts, key=lambda r: r["market_pct"]) if mkts else None


def build_track_record(meeting_files: dict[str, dict]) -> dict:
    """Lifetime receipts. Headline counts EXCLUDE demo cards.

    The headline also carries honest, SAME-SAMPLE baselines so the accuracy
    figure can never be read in a vacuum (per the June-2026 market-validation
    report): how often the market favourite landed top-3 over the identical live
    races, and the random-pick expectation from the actual field sizes.
    """
    rows = []
    h3 = a3 = hp = ap = 0
    fav_hits = fav_att = 0          # market favourite top-3, live sample
    rand_sum = 0.0; rand_n = 0      # Σ 3/field_size over live races
    live_dates: list[str] = []
    for date, m in meeting_files.items():
        if not m.get("has_results"):
            continue
        races = m["races"]
        m_h3 = sum(r.get("top3_hits", 0) for r in races)
        m_a3 = 3 * len(races)
        m_hp = sum(1 for r in races if r.get("top_pick_hit"))
        m_ap = len(races)
        demo = m.get("demo", False)
        rows.append({
            "date": date,
            "venue": m.get("venue", "HV"),
            "race_count": len(races),
            "demo": demo,
            "top3_precision": (m_h3 / m_a3 * 100) if m_a3 else None,
            "top_pick_rate": (m_hp / m_ap * 100) if m_ap else None,
        })
        if demo:
            continue
        h3 += m_h3; a3 += m_a3; hp += m_hp; ap += m_ap
        live_dates.append(date)
        for r in races:
            runners = r.get("runners", [])
            fav = _market_fav(runners)
            pos = fav.get("actual_position") if fav else None
            if pos is not None:
                fav_att += 1
                if pos <= 3:
                    fav_hits += 1
            fs = r.get("field_size") or len(runners)
            if fs:
                rand_sum += 3.0 / fs
                rand_n += 1
    rows.sort(key=lambda r: r["date"], reverse=True)
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "headline": {
            "meetings": sum(1 for r in rows if not r["demo"]),
            "races": sum(r["race_count"] for r in rows if not r["demo"]),
            "date_from": min(live_dates) if live_dates else None,
            "date_to": max(live_dates) if live_dates else None,
            "top3_precision": (h3 / a3 * 100) if a3 else None,
            "top3_hits": h3, "top3_attempts": a3,
            "top_pick_rate": (hp / ap * 100) if ap else None,
            "top_pick_hits": hp, "top_pick_attempts": ap,
            # Same-sample honesty baselines.
            "baseline_fav_rate": (fav_hits / fav_att * 100) if fav_att else None,
            "baseline_fav_hits": fav_hits, "baseline_fav_attempts": fav_att,
            "baseline_random_rate": (rand_sum / rand_n * 100) if rand_n else None,
        },
        "meetings": rows,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", action="store_true", help="use the Claude API for narratives")
    args = ap.parse_args()

    if not SRC.exists():
        raise SystemExit(f"source snapshot not found: {SRC} (run export_data.py first)")
    (DST / "meetings").mkdir(parents=True, exist_ok=True)

    narrate, label = make_narrator(args.llm)
    print(f"Narrator: {label}")

    # Meetings.
    index = json.loads((SRC / "meetings.json").read_text())
    meeting_files: dict[str, dict] = {}
    for entry in index["meetings"]:
        date = entry["date"]
        src_path = SRC / "meetings" / f"{date}.json"
        if not src_path.exists():
            continue
        m = transform_meeting(src_path, narrate)
        meeting_files[date] = m
        (DST / "meetings" / f"{date}.json").write_text(json.dumps(m, indent=2))
        entry["demo"] = date in DEMO_DATES
        print(f"  {date} {entry.get('venue','?'):>2} · {len(m['races'])} races"
              f"{' · demo' if entry['demo'] else ''}")
    (DST / "meetings.json").write_text(json.dumps(index, indent=2))

    # Track Record (consumer performance feed).
    track = build_track_record(meeting_files)
    (DST / "performance.json").write_text(json.dumps(track, indent=2))
    hb = track["headline"]
    print(f"Track Record: {hb['meetings']} live meetings, {hb['races']} races "
          f"({hb.get('date_from')}..{hb.get('date_to')}), "
          f"top-3 {hb['top3_precision']:.0f}% · top pick {hb['top_pick_rate']:.0f}%")
    if hb.get("baseline_fav_rate") is not None:
        print(f"  baselines (same sample): favourite {hb['baseline_fav_rate']:.0f}% · "
              f"random {hb['baseline_random_rate']:.0f}%")

    # profiles.json is consumer-safe as-is; copy verbatim if present.
    src_prof = SRC / "profiles.json"
    if src_prof.exists():
        (DST / "profiles.json").write_text(src_prof.read_text())

    print(f"\nWrote consumer snapshot → {DST}")


if __name__ == "__main__":
    main()
