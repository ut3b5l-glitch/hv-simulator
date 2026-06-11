import { getTrackRecord } from "@/lib/data";
import { pct, formatDate } from "@/lib/format";
import StatTile from "@/components/StatTile";
import GlassCard from "@/components/GlassCard";
import PageHeader from "@/components/PageHeader";
import ProbBar, { type BarTone } from "@/components/ProbBar";
import EmptyState from "@/components/EmptyState";

// Compact "13 May – 3 Jun 2026" range for the sample disclosure.
function fmtRange(from?: string | null, to?: string | null): string | null {
  if (!from || !to) return null;
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const d1 = new Date(from + "T00:00:00");
  const d2 = new Date(to + "T00:00:00");
  return `${d1.toLocaleDateString("en-GB", opt)} – ${d2.toLocaleDateString(
    "en-GB",
    opt,
  )} ${d2.getFullYear()}`;
}

// One labelled bar in the honest "How we compare" block.
function CompareRow({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: number;
  tone: BarTone;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className={`text-caption ${strong ? "font-semibold text-ink-50" : "text-ink-70"}`}>
          {label}
        </span>
        <span
          className={`num text-body ${
            strong ? "font-semibold text-accent-green" : "text-ink-60"
          }`}
        >
          {pct(value, 0)}
        </span>
      </div>
      <ProbBar value={value} tone={tone} height={strong ? 7 : 5} />
    </div>
  );
}

export default async function TrackRecordPage() {
  const tr = await getTrackRecord();
  if (!tr) {
    return (
      <EmptyState
        title="No track record yet"
        hint="Settle a meeting, then run python export_consumer.py to publish it."
      />
    );
  }

  const h = tr.headline;
  const topPick = h.top_pick_rate ?? 0;
  const range = fmtRange(h.date_from, h.date_to);
  const hasBaseline = h.baseline_fav_rate != null;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        hero
        eyebrow="Lifetime"
        title="Track Record"
        subtitle={
          <span className="num">
            {h.meetings} live meetings · {h.races} races
            {range && <span className="text-ink-70"> · {range}</span>}
          </span>
        }
      />

      {/* The honest headline — receipts, not promises. */}
      <GlassCard className="p-4">
        <p className="text-body leading-relaxed text-ink-50">
          Our single top-rated pick finishes in the{" "}
          <span className="font-semibold text-accent-green">top three</span> about{" "}
          <span className="num font-semibold text-accent-green">{pct(topPick, 0)}</span> of the
          time. Every pick we&apos;ve ever published is below — the wins{" "}
          <span className="font-medium">and</span> the misses, nothing hidden.
        </p>
        <p className="mt-2 text-caption text-ink-70">
          Zokki is a race-reading companion, not a tipping service. We never tell you to bet — we
          read the race and keep an honest scorecard. Figures cover live meetings only; scratched
          and abandoned races are excluded.
        </p>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Top pick places"
          value={pct(h.top_pick_rate, 0)}
          hint={`${h.top_pick_hits} of ${h.top_pick_attempts} races`}
          progress={h.top_pick_rate ?? 0}
          barTone="win"
        />
        <StatTile
          label="Three picks, in the frame"
          value={pct(h.top3_precision, 0)}
          hint={`${h.top3_hits} of ${h.top3_attempts} picks`}
          progress={h.top3_precision ?? 0}
          barTone="place"
        />
      </div>

      {/* Same-sample baselines — the headline number never stands in a vacuum. */}
      {hasBaseline && (
        <section>
          <h2 className="eyebrow mb-2 px-1">How we compare</h2>
          <GlassCard className="p-4">
            <div className="space-y-3">
              <CompareRow label="Our top pick" value={topPick} tone="win" strong />
              <CompareRow
                label="Backing the favourite"
                value={h.baseline_fav_rate ?? 0}
                tone="market"
              />
              <CompareRow
                label="A random pick"
                value={h.baseline_random_rate ?? 0}
                tone="neutral"
              />
            </div>
            <p className="mt-3 text-caption text-ink-70">
              Top-three strike rate across the same {h.races} races. We land far above guesswork
              and run neck-and-neck with the market favourite — we don&apos;t claim a secret edge,
              we make the read fast, clear, and fully receipted.
            </p>
          </GlassCard>
        </section>
      )}

      <section>
        <h2 className="eyebrow mb-2 px-1">Every meeting</h2>
        <div className="space-y-2">
          {tr.meetings.map((m, i) => {
            const prec = m.top3_precision ?? 0;
            return (
              <GlassCard
                key={m.date}
                className="stagger p-3.5"
                style={{ ["--i" as string]: i }}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide ${
                          m.venue === "ST"
                            ? "bg-accent-cyan/15 text-accent-cyan"
                            : "bg-accent-gold/15 text-accent-gold"
                        }`}
                      >
                        {m.venue === "ST" ? "Sha Tin" : "Happy Valley"}
                      </span>
                      {m.demo && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-60">
                          Backtest
                        </span>
                      )}
                      <span className="text-body font-semibold">{formatDate(m.date)}</span>
                    </div>
                    <div className="num mt-0.5 text-micro text-ink-70">
                      {m.race_count} races · top pick {pct(m.top_pick_rate, 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-headline font-semibold">{pct(m.top3_precision, 0)}</div>
                    <div className="eyebrow text-[0.5625rem]">in frame</div>
                  </div>
                </div>
                <ProbBar
                  value={prec}
                  tone={prec >= 50 ? "win" : prec >= 33 ? "place" : "market"}
                  height={4}
                  className="mt-2.5"
                />
              </GlassCard>
            );
          })}
        </div>
        <p className="mt-3 px-2 text-center text-micro text-ink-70">
          Backtest cards are retro-scored from history and are not counted in the headline above.
        </p>
      </section>
    </div>
  );
}
