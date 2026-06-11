"use client";

import type { Meeting, Race } from "@/lib/types";
import SaddleCloth from "./SaddleCloth";

const TIER: Record<string, number> = {
  standout: 3,
  confident: 2,
  competitive: 1,
  open: 0,
};

/** The single most confident pick on the card — the "banker". */
export function findBanker(meeting: Meeting): { race: Race; idx: number } | null {
  const live = meeting.races
    .map((race, idx) => ({ race, idx }))
    .filter(({ race }) => !race.has_results && race.runners.length > 0);
  const pool = live.length
    ? live
    : meeting.races.map((race, idx) => ({ race, idx }));
  if (!pool.length) return null;
  return pool.reduce((best, cur) => {
    const t = (r: Race) => TIER[r.verdict?.tone ?? "open"] ?? 0;
    const w = (r: Race) =>
      Math.max(...r.runners.map((x) => x.win_pct), 0);
    return t(cur.race) > t(best.race) ||
      (t(cur.race) === t(best.race) && w(cur.race) > w(best.race))
      ? cur
      : best;
  });
}

export default function BankerStrip({
  meeting,
  trustLine,
  onJump,
}: {
  meeting: Meeting;
  trustLine: string | null;
  onJump: (idx: number) => void;
}) {
  // Settled card → one-line scoreboard for the night.
  if (meeting.has_results) {
    const races = meeting.races;
    const hits = races.reduce((s, r) => s + (r.top3_hits ?? 0), 0);
    const topHits = races.filter((r) => r.top_pick_hit).length;
    return (
      <section className="glass animate-fade-in rounded-card px-4 py-3 shadow-glass-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-callout font-semibold text-ink-60">
            How the card went
          </span>
          <span className="num text-callout font-bold">
            {hits}
            <span className="text-ink-70">/{races.length * 3} picks placed</span>
            <span className="text-ink-90"> · </span>
            {topHits}
            <span className="text-ink-70">/{races.length} top picks hit</span>
          </span>
        </div>
      </section>
    );
  }

  const banker = findBanker(meeting);
  if (!banker) return null;
  const top = [...banker.race.runners].sort((a, b) => a.rank - b.rank)[0];
  if (!top) return null;

  return (
    <section className="animate-fade-in space-y-2">
      <button
        onClick={() => onJump(banker.idx)}
        className="tap glass-gold flex w-full items-center gap-3 rounded-card p-3.5 text-left shadow-glass-2"
      >
        <SaddleCloth no={top.horse_no} size="md" tone="gold" />
        <div className="min-w-0 flex-1">
          <div className="text-micro2 font-semibold uppercase tracking-eyebrow text-accent-gold">
            Banker of the night
          </div>
          <div className="mt-0.5 truncate text-headline font-bold leading-tight">
            {top.horse_name}
            <span className="text-ink-70"> · Race {banker.race.race_number}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-title font-bold leading-none">
            {Math.round(top.win_pct)}
            <span className="ml-0.5 text-caption font-semibold text-ink-70">%</span>
          </div>
          <div className="mt-0.5 text-micro2 uppercase tracking-wide text-ink-80">
            win chance
          </div>
        </div>
      </button>
      {trustLine && (
        <a
          href="/performance"
          className="block px-1 text-caption text-ink-70 underline-offset-2 active:underline"
        >
          {trustLine} <span className="text-ink-80">→ see the full record</span>
        </a>
      )}
    </section>
  );
}
