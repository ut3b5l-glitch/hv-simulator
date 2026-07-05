import "server-only";
import type { Meeting, Race, Runner, TrackRecord } from "@/lib/types";

/**
 * Grounding digests for the AI analyst. The server builds these from the same
 * JSON snapshots the pages render — the client never supplies grounding text,
 * so the model can't be fed a forged "summary" and the payloads stay tiny.
 */

const VENUE: Record<string, string> = { HV: "Happy Valley", ST: "Sha Tin" };

export function venueName(v?: string): string {
  return VENUE[v ?? "HV"] ?? "Happy Valley";
}

function pct(n: number | null | undefined): string {
  return n == null ? "–" : `${n.toFixed(1)}%`;
}

function runnerLine(x: Runner): string {
  const bits: string[] = [
    `${x.rank}. ${x.horse_name}${x.horse_no != null ? ` (#${x.horse_no})` : ""}`,
    `win ${pct(x.win_pct)}, top3 ${pct(x.show_pct)}`,
  ];
  if (x.public_odds != null) {
    bits.push(`odds ${x.public_odds}${x.market_pct != null ? ` (market ${pct(x.market_pct)})` : ""}`);
  }
  if (x.edge != null) bits.push(`edge ${x.edge > 0 ? "+" : ""}${x.edge.toFixed(1)}pt${x.is_value ? " VALUE" : ""}`);
  if (x.jockey_name) bits.push(`J ${x.jockey_name}`);
  if (x.trainer_name) bits.push(`T ${x.trainer_name}`);
  if (x.barrier != null) bits.push(`gate ${x.barrier}`);
  if (x.official_rating != null) bits.push(`OR ${x.official_rating}`);
  if (x.last_6_runs) bits.push(`last6 ${x.last_6_runs}`);
  if (x.days_since_last_run != null) bits.push(`${x.days_since_last_run}d since run`);
  if (x.actual_position != null) bits.push(`FINISHED P${x.actual_position}`);
  return bits.join(" · ");
}

/** Which model factors stand out for a runner, in plain words. */
function factorNotes(x: Runner): string {
  const f = x.factors;
  if (!f) return "";
  const notes: string[] = [];
  if (f.barrier_iv >= 1.3) notes.push("favourable draw");
  else if (f.barrier_iv <= 0.75) notes.push("awkward draw");
  if (f.jockey >= 1.25) notes.push("jockey in form");
  if (f.trainer >= 1.25) notes.push("yard firing");
  if (f.form >= 1.3) notes.push("strong recent form");
  else if (f.form <= 0.75) notes.push("poor recent form");
  if (f.class_tf > 1.05) notes.push("class rise (positive HKJC signal)");
  if (f.rating > 1.1) notes.push("rating on the up");
  return notes.length ? ` [signals: ${notes.join(", ")}]` : "";
}

/** Full digest for one race — the grounding for a deep-dive briefing. */
export function raceDigest(meeting: Meeting, race: Race): string {
  const head =
    `${venueName(meeting.venue)} ${meeting.meeting_date} — Race ${race.race_number} · ` +
    `${race.distance_m}m · ${race.race_class ?? ""}${race.going ? ` · going ${race.going}` : ""} · ${race.field_size} runners`;
  const verdict = race.verdict ? `Model verdict: ${race.verdict.label} — ${race.verdict.detail}` : "";
  const read = race.narrative ? `Published read: ${race.narrative}` : "";
  const top = race.runners
    .slice(0, 8)
    .map((x) => runnerLine(x) + factorNotes(x))
    .join("\n");
  const rest = race.runners
    .slice(8)
    .map((x) => `${x.rank}. ${x.horse_name} — win ${pct(x.win_pct)}`)
    .join("; ");
  const result = race.has_results && race.actual_top3?.length
    ? `RESULT (already run): top three ${race.actual_top3.join(", ")} — model got ${race.top3_hits}/3 of its picks in the frame.`
    : "This race has not been run yet.";
  return [head, verdict, read, "Model-ranked field:", top, rest && `Rest of field: ${rest}`, result]
    .filter(Boolean)
    .join("\n");
}

/** Meeting-level digest — the grounding for the Ask Zokki chat. */
export function meetingDigest(meeting: Meeting, record: TrackRecord | null): string {
  const head = `${venueName(meeting.venue)} meeting, ${meeting.meeting_date} — ${meeting.races.length} races${meeting.has_results ? " (results in)" : ""}.`;
  const races = meeting.races
    .map((r) => {
      const v = r.verdict ? ` — ${r.verdict.label}` : "";
      const res = r.has_results && r.actual_top3?.length ? ` | result: ${r.actual_top3.join(", ")}` : "";
      return `R${r.race_number} (${r.distance_m}m, ${r.race_class ?? ""}): model top three ${r.top3.join(", ")}${v}${res}`;
    })
    .join("\n");
  const h = record?.headline;
  const rec =
    h && h.top_pick_rate != null
      ? `Live track record across ${h.top_pick_attempts} races: top pick hits the top three ${Math.round(h.top_pick_rate)}% of the time` +
        (h.baseline_fav_rate != null ? ` (market favourite: ${Math.round(h.baseline_fav_rate)}%, random: ${Math.round(h.baseline_random_rate ?? 0)}%).` : ".")
      : "";
  return [head, races, rec].filter(Boolean).join("\n\n");
}
