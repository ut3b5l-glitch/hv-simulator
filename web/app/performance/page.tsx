import { getPerformance } from "@/lib/data";
import { pct, signed, formatDate } from "@/lib/format";
import StatTile from "@/components/StatTile";
import GlassCard from "@/components/GlassCard";

export default async function PerformancePage() {
  const perf = await getPerformance();
  if (!perf) {
    return (
      <div className="pt-10 text-center text-white/60">No performance data yet.</div>
    );
  }

  const roiTone =
    perf.value_bet_roi === null
      ? "default"
      : perf.value_bet_roi >= 0
        ? "good"
        : "bad";

  return (
    <div className="space-y-5 pb-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
          Lifetime
        </div>
        <h1 className="mt-0.5 text-[28px] font-semibold leading-tight">Performance</h1>
        <div className="mt-0.5 text-xs text-white/55">
          {perf.meetings_settled}/{perf.meetings_total} meetings settled
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Top-3 Precision"
          value={pct(perf.top3_precision)}
          hint={`${perf.top3_hits}/${perf.top3_attempts}`}
          tone="default"
        />
        <StatTile
          label="Top Pick Hits"
          value={pct(perf.top_pick_rate)}
          hint={`${perf.top_pick_hits}/${perf.top_pick_attempts}`}
          tone="default"
        />
        <StatTile
          label="Value Bet ROI"
          value={
            perf.value_bet_roi === null ? "—" : signed(perf.value_bet_roi, 1, "%")
          }
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
        <h2 className="mb-2 px-1 text-[11px] uppercase tracking-[0.14em] text-white/55">
          Recent Meetings
        </h2>
        <div className="space-y-2">
          {perf.meetings.map((m) => (
            <GlassCard key={m.meeting_date} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {formatDate(m.meeting_date)}
                </div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  {m.race_count} races · {m.value_bet_count} value bets
                </div>
              </div>
              <div className="text-right">
                <div className="num text-sm font-semibold">
                  {pct(m.top3_precision, 0)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">
                  Top-3
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`num text-sm font-semibold ${
                    m.value_bet_roi === null
                      ? "text-white/60"
                      : m.value_bet_roi >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                  }`}
                >
                  {m.value_bet_roi === null ? "—" : signed(m.value_bet_roi, 0, "%")}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">
                  ROI
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
