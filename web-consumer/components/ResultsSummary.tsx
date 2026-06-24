import type { Meeting, Race } from "@/lib/types";
import SaddleCloth from "./SaddleCloth";
import { CheckIcon } from "./Icons";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Our rank-1 pick for a race, with its number and where it actually finished. */
function topPick(race: Race) {
  const r = [...race.runners].sort((a, b) => a.rank - b.rank)[0];
  return r
    ? { name: r.horse_name, no: r.horse_no, pos: r.actual_position ?? null }
    : null;
}

/** The result chip for our top pick: Won / placed 3rd / 7th / missed. */
function TopPickChip({ race }: { race: Race }) {
  const p = topPick(race);
  if (!p) return null;
  const tone =
    p.pos === 1
      ? "bg-accent-gold/18 text-accent-gold ring-accent-gold/40"
      : p.pos != null && p.pos <= 3
        ? "bg-accent-green/14 text-accent-green ring-accent-green/30"
        : "bg-white/[0.07] text-ink-70 ring-white/10";
  const verb =
    p.pos === 1
      ? "won"
      : p.pos != null && p.pos <= 3
        ? `${ordinal(p.pos)} · placed`
        : p.pos != null
          ? `${ordinal(p.pos)} · missed`
          : "missed";
  return (
    <span
      className={`shrink-0 rounded-pill px-2.5 py-1 text-micro font-semibold ring-1 ${tone}`}
    >
      <span className="text-ink-80/80">Top pick</span> №{p.no} · {verb}
    </span>
  );
}

function RaceResult({ race }: { race: Race }) {
  // The board's two halves: what actually happened, and where our card matched.
  const podium = [...race.finishers]
    .filter((f) => f.position <= 3)
    .sort((a, b) => a.position - b.position);
  const tippedNames = new Set(race.top3);
  const winnerName = race.actual_top3[0];

  return (
    <section className="glass rounded-card p-4 shadow-glass-1">
      <div className="flex items-baseline justify-between gap-3">
        <div className="eyebrow">
          Race {race.race_number}
          <span className="text-ink-90"> · </span>
          <span className="num normal-case tracking-normal text-ink-80">
            {race.distance_m}m{race.race_class ? ` · ${race.race_class}` : ""}
          </span>
        </div>
        <span className="num shrink-0 text-micro2 text-ink-80">
          {race.top3_hits}/3 ours
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {podium.map((f, i) => {
          const tipped = tippedNames.has(f.horse_name);
          const won = f.horse_name === winnerName;
          return (
            <li
              key={`${f.position}-${f.horse_no ?? f.horse_name}`}
              className="flex items-center gap-3"
            >
              <span
                className={`w-9 shrink-0 text-micro2 font-semibold uppercase tracking-wide ${
                  won ? "text-accent-gold" : "text-ink-80"
                }`}
              >
                {ordinal(f.position)}
              </span>
              <SaddleCloth no={f.horse_no} size="sm" tone={won ? "gold" : "default"} />
              <span
                className={`min-w-0 flex-1 truncate text-body ${
                  won ? "font-bold" : "font-medium text-ink-50"
                }`}
              >
                {f.horse_name}
              </span>
              {tipped && (
                <span
                  aria-label="our pick"
                  title="Our pick"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-green/15 text-accent-green ring-1 ring-accent-green/30"
                >
                  <CheckIcon className="h-3 w-3" />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3.5 flex items-center justify-between gap-3 border-t hairline pt-3">
        <span className="flex items-center gap-2">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < race.top3_hits ? "bg-accent-green" : "bg-white/15"
                }`}
              />
            ))}
          </span>
          <span className="text-caption text-ink-70">
            {race.top3_hits} of our 3 placed
          </span>
        </span>
        <TopPickChip race={race} />
      </div>
    </section>
  );
}

function Tally({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-card p-3.5 text-center shadow-glass-1">
      <div className="text-micro2 uppercase tracking-wide text-ink-80">{label}</div>
      <div className="num mt-1 text-title font-bold leading-none">{value}</div>
      {sub && <div className="num mt-1 text-micro2 text-ink-80">{sub}</div>}
    </div>
  );
}

export default function ResultsSummary({ meeting }: { meeting: Meeting }) {
  const settled = meeting.races.filter((r) => r.has_results);
  const remaining = meeting.races.length - settled.length;

  if (settled.length === 0) {
    return (
      <section className="glass rounded-card p-6 text-center shadow-glass-1">
        <div className="text-headline font-bold">Results land here</div>
        <p className="mx-auto mt-2 max-w-xs text-caption leading-relaxed text-ink-70">
          As each race is called, its winners and how our three picks fared will
          appear below — the card fills in race by race through the night.
        </p>
      </section>
    );
  }

  const attempts = settled.length * 3;
  const totalHits = settled.reduce((s, r) => s + (r.top3_hits || 0), 0);
  const wins = settled.filter((r) => topPick(r)?.pos === 1).length;
  const hitPct = attempts ? Math.round((totalHits / attempts) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Tally
          label="Races in"
          value={`${settled.length}`}
          sub={`of ${meeting.races.length}`}
        />
        <Tally label="Top-3 hit" value={`${totalHits}/${attempts}`} sub={`${hitPct}%`} />
        <Tally label="Top pick won" value={`${wins}`} sub={`of ${settled.length}`} />
      </div>

      <div className="flex items-center gap-2.5 px-1 text-micro2 text-ink-80">
        <span className="flex items-center gap-1 text-accent-green">
          <CheckIcon className="h-3.5 w-3.5" /> our pick
        </span>
        <span className="text-ink-90">·</span>
        <span>gold = race winner</span>
      </div>

      <div className="space-y-3">
        {settled
          .slice()
          .sort((a, b) => a.race_number - b.race_number)
          .map((race) => (
            <RaceResult key={race.race_id} race={race} />
          ))}
      </div>

      {remaining > 0 && (
        <p className="px-2 pb-2 pt-1 text-center text-micro text-ink-80">
          {remaining} more {remaining === 1 ? "race" : "races"} still to run tonight.
        </p>
      )}
    </div>
  );
}
