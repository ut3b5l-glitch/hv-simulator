"use client";

import type { Race, Runner, Verdict } from "@/lib/types";
import SaddleCloth from "./SaddleCloth";
import FormGlance from "./FormGlance";
import { ShareIcon } from "./Icons";

export type Career = { runs?: number; wins: number; places: number };

const VERDICT_TONE: Record<Verdict["tone"], string> = {
  standout: "bg-accent-green/15 text-accent-green ring-accent-green/30",
  confident: "bg-accent-gold/15 text-accent-gold ring-accent-gold/30",
  competitive: "bg-accent-blue/15 text-accent-blue ring-accent-blue/30",
  open: "bg-white/10 text-ink-60 ring-white/15",
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Result badge for a settled pick: Won / Placed 2nd / 7th. */
function ResultBadge({ pos }: { pos: number | null | undefined }) {
  if (pos == null)
    return <span className="text-caption text-ink-80">—</span>;
  if (pos === 1)
    return (
      <span className="rounded-pill bg-accent-gold/18 px-2.5 py-1 text-caption font-bold text-accent-gold ring-1 ring-accent-gold/40">
        Won
      </span>
    );
  if (pos <= 3)
    return (
      <span className="rounded-pill bg-accent-green/14 px-2.5 py-1 text-caption font-bold text-accent-green ring-1 ring-accent-green/30">
        {ordinal(pos)} · placed
      </span>
    );
  return (
    <span className="rounded-pill bg-white/[0.07] px-2.5 py-1 text-caption font-semibold text-ink-70 ring-1 ring-white/10">
      {ordinal(pos)}
    </span>
  );
}

function PickRow({
  runner,
  career,
  big,
  hasResults,
  index,
}: {
  runner: Runner;
  career?: Career | null;
  big: boolean;
  hasResults: boolean;
  index: number;
}) {
  return (
    <div
      className="stagger flex items-center gap-3"
      style={{ ["--i" as string]: index + 1 }}
    >
      <SaddleCloth
        no={runner.horse_no}
        size={big ? "lg" : "md"}
        tone={big ? "gold" : "default"}
      />
      <div className="min-w-0 flex-1">
        {/* Long HK names (single unbreakable words) step down a size rather
            than truncate — the pick's name must never be cut off. */}
        <div
          className={`truncate font-bold leading-tight ${
            big
              ? runner.horse_name.length > 14
                ? "text-headline"
                : "text-title"
              : "text-body"
          }`}
        >
          {runner.horse_name}
        </div>
        {runner.jockey_name && (
          <div className="mt-0.5 truncate text-micro text-ink-70">
            {runner.jockey_name}
            {runner.barrier != null && (
              <span className="num"> · barrier {runner.barrier}</span>
            )}
          </div>
        )}
        <div className="mt-1">
          <FormGlance last6={runner.last_6_runs} career={career} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        {hasResults ? (
          <ResultBadge pos={runner.actual_position} />
        ) : (
          <>
            <div
              className={`num font-bold leading-none ${
                big ? "text-stat" : "text-title"
              }`}
            >
              {Math.round(runner.win_pct)}
              <span className="ml-0.5 text-caption font-semibold text-ink-70">%</span>
            </div>
            <div className="mt-0.5 text-micro2 uppercase tracking-wide text-ink-80">
              win chance
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PickPodium({
  race,
  careers,
}: {
  race: Race;
  careers: Record<number, Career>;
}) {
  const picks = [...race.runners].sort((a, b) => a.rank - b.rank).slice(0, 3);
  if (!picks.length) return null;
  const verdict = race.verdict;
  const settled = race.has_results;

  const hits = picks.filter(
    (p) => p.actual_position != null && p.actual_position <= 3,
  ).length;
  const weWon = picks.some((p) => p.actual_position === 1);
  const winner = settled
    ? race.runners.find((r) => r.actual_position === 1) ?? null
    : null;
  const numbers = picks.every((p) => p.horse_no != null)
    ? picks.map((p) => p.horse_no)
    : null;

  async function share() {
    const lines = picks.map(
      (p, i) => `${i + 1}. №${p.horse_no ?? "?"} ${p.horse_name}`,
    );
    const text = `Zokki — Race ${race.race_number} picks:\n${lines.join("\n")}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* user dismissed the sheet — nothing to do */
    }
  }

  return (
    <section className="glass rounded-card p-4 shadow-glass-2">
      {/* Race context — quiet; the picks are the headline. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">
            Race {race.race_number}
            <span className="text-ink-90"> · </span>
            <span className="num normal-case tracking-normal">
              {race.distance_m}m · {race.race_class ?? ""}
            </span>
          </div>
          <div className="mt-1.5 text-headline font-bold leading-tight">
            {settled ? "How our three ran" : "Our three for this race"}
          </div>
        </div>
        {verdict && (
          <span
            className={`shrink-0 rounded-pill px-2.5 py-1 text-micro font-semibold uppercase tracking-wide ring-1 ${VERDICT_TONE[verdict.tone]}`}
          >
            {verdict.label}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3.5">
        {picks.map((p, i) => (
          <PickRow
            key={p.horse_name}
            runner={p}
            career={p.horse_id != null ? careers[p.horse_id] : null}
            big={i === 0}
            hasResults={settled}
            index={i}
          />
        ))}
      </div>

      {/* The walkaway line — the numbers you carry to the window. */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t hairline pt-3">
        {settled ? (
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              {picks.map((p, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    p.actual_position != null && p.actual_position <= 3
                      ? p.actual_position === 1
                        ? "bg-accent-gold"
                        : "bg-accent-green"
                      : "bg-white/15"
                  }`}
                />
              ))}
            </span>
            <span className="text-caption font-semibold text-ink-60">
              {weWon
                ? `Our ${hits === 3 ? "three swept the places" : "pick won it"}`
                : hits > 0
                  ? `${hits} of our three placed`
                  : "Not our race"}
            </span>
            {winner && !weWon && (
              <span className="text-caption text-ink-70">
                · winner №{winner.horse_no} {winner.horse_name}
              </span>
            )}
          </div>
        ) : numbers ? (
          <div className="flex items-baseline gap-2">
            <span className="text-micro2 uppercase tracking-eyebrow text-ink-80">
              Your numbers
            </span>
            <span className="num text-title font-bold tracking-tight">
              {numbers.join(" · ")}
            </span>
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={share}
          aria-label="Share these picks"
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-pill glass-tile text-ink-60"
        >
          <ShareIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
