import { Fragment } from "react";
import GlassCard from "./GlassCard";
import { signed, formatDate } from "@/lib/format";
import type { Betting } from "@/lib/types";

const SHORT: Record<string, string> = {
  win_top1: "Win #1",
  place_box3: "Place",
  quinella_place_box3: "Q-Place",
  quinella_box3: "Quinella",
};

/**
 * Betting-returns panel for the Performance page. Shows lifetime flat-stake P&L
 * for four strategies on the model's top-3 picks (Win on #1, Place box, Quinella
 * Place box, Quinella box), using official HKJC dividends. Published by
 * export_data.py (build_betting → bet_report.compute).
 */
export default function BettingReturns({ betting }: { betting: Betting }) {
  const { strategies, per_meeting, unit } = betting;
  if (!strategies?.length) return null;
  const best = strategies.reduce((a, b) => (b.net > a.net ? b : a));

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="eyebrow mb-1">Betting Returns</h2>
        <p className="text-micro text-ink-70">
          If you&apos;d flat-staked HK${unit.toFixed(0)} on the model&apos;s top-3 every race.
          Dividends include the stake. Lifetime, all settled meetings.
        </p>
      </div>

      <GlassCard className="space-y-3 p-4">
        {strategies.map((s) => {
          const tone =
            s.net > 0 ? "text-accent-green" : s.net < 0 ? "text-accent-red" : "text-ink-70";
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-body font-medium">{s.label}</div>
                <div className="num text-micro text-ink-60">
                  HK${s.staked.toFixed(0)} staked → HK${s.returned.toFixed(0)} back
                </div>
              </div>
              <div className="text-right">
                <div className={`num text-headline font-semibold ${tone}`}>{signed(s.net, 0)}</div>
                <div className="eyebrow text-[0.5625rem]">{signed(s.roi_pct, 0, "%")} ROI</div>
              </div>
            </div>
          );
        })}
      </GlassCard>

      <p className="px-2 text-micro text-ink-70">
        Best lifetime play: <span className="text-white">{best.label}</span>{" "}
        <span className={best.net >= 0 ? "text-accent-green" : "text-accent-red"}>
          ({signed(best.net, 0)} HK$, {signed(best.roi_pct, 0, "%")})
        </span>
      </p>

      {per_meeting.length > 1 && (
        <GlassCard className="p-4">
          <div className="eyebrow mb-2.5">By meeting · net HK$</div>
          <div className="grid grid-cols-[auto_repeat(4,1fr)] items-center gap-x-2 gap-y-2 text-right">
            <div className="eyebrow text-left text-[0.5625rem] text-ink-60">Date</div>
            {strategies.map((s) => (
              <div key={s.key} className="eyebrow text-[0.5625rem] text-ink-60">
                {SHORT[s.key] ?? s.label}
              </div>
            ))}
            {per_meeting.map((m) => (
              <Fragment key={m.date}>
                <div className="num text-left text-caption text-ink-80">{formatDate(m.date)}</div>
                {strategies.map((s) => {
                  const v = m.nets[s.key] ?? 0;
                  return (
                    <div
                      key={s.key}
                      className={`num text-caption ${
                        v > 0 ? "text-accent-green" : v < 0 ? "text-accent-red" : "text-ink-60"
                      }`}
                    >
                      {signed(v, 0)}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </GlassCard>
      )}
    </section>
  );
}
