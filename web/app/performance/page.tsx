import { getPerformance } from "@/lib/data";
import { pct, signed, formatDate } from "@/lib/format";
import StatTile from "@/components/StatTile";
import GlassCard from "@/components/GlassCard";
import PageHeader from "@/components/PageHeader";
import ProbBar from "@/components/ProbBar";
import EmptyState from "@/components/EmptyState";

export default async function PerformancePage() {
  const perf = await getPerformance();
  if (!perf) {
    return (
      <EmptyState
        title="No performance data yet"
        hint="Settle a meeting, then run python export_data.py to publish stats."
      />
    );
  }

  const roiTone =
    perf.value_bet_roi === null ? "default" : perf.value_bet_roi >= 0 ? "good" : "bad";

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Lifetime"
        title="Performance"
        subtitle={
          <span className="num">
            {perf.meetings_settled}/{perf.meetings_total} meetings settled
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Top-3 Precision"
          value={pct(perf.top3_precision)}
          hint={`${perf.top3_hits}/${perf.top3_attempts} picks`}
          progress={perf.top3_precision ?? 0}
          barTone="win"
        />
        <StatTile
          label="Top Pick Hits"
          value={pct(perf.top_pick_rate)}
          hint={`${perf.top_pick_hits}/${perf.top_pick_attempts} races`}
          progress={perf.top_pick_rate ?? 0}
          barTone="place"
        />
        <StatTile
          label="Value Bet ROI"
          value={perf.value_bet_roi === null ? "—" : signed(perf.value_bet_roi, 1, "%")}
          hint={`${perf.value_bet_wins}/${perf.value_bet_staked} settled`}
          tone={roiTone}
        />
        <StatTile
          label="Value P&L"
          value={signed(perf.value_bet_pnl, 2)}
          hint="units · 1u per bet"
          tone={perf.value_bet_pnl >= 0 ? "good" : "bad"}
        />
      </div>

      <section>
        <h2 className="eyebrow mb-2 px-1">Recent Meetings</h2>
        <div className="space-y-2">
          {perf.meetings.map((m, i) => {
            const prec = m.top3_precision ?? 0;
            return (
              <GlassCard
                key={m.meeting_date}
                className="stagger p-3.5"
                style={{ ["--i" as string]: i }}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-semibold">{formatDate(m.meeting_date)}</div>
                    <div className="num mt-0.5 text-micro text-ink-70">
                      {m.race_count} races · {m.value_bet_count} value bets
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-headline font-semibold">{pct(m.top3_precision, 0)}</div>
                    <div className="eyebrow text-[0.5625rem]">Top-3</div>
                  </div>
                  <div className="w-12 text-right">
                    <div
                      className={`num text-headline font-semibold ${
                        m.value_bet_roi === null
                          ? "text-ink-70"
                          : m.value_bet_roi >= 0
                            ? "text-accent-green"
                            : "text-accent-red"
                      }`}
                    >
                      {m.value_bet_roi === null ? "—" : signed(m.value_bet_roi, 0, "%")}
                    </div>
                    <div className="eyebrow text-[0.5625rem]">ROI</div>
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
      </section>

      <p className="px-2 text-center text-micro text-ink-80">
        Random baseline ≈ 25.7% top-3 · physical ceiling ≈ 52% for ~11.5-horse fields.
      </p>
    </div>
  );
}
