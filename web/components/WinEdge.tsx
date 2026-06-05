import GlassCard from "./GlassCard";
import ProbBar from "./ProbBar";
import { signed } from "@/lib/format";
import type { WinEdge as WinEdgeData, WinEdgeVenue } from "@/lib/types";

const VENUE_NAME: Record<string, string> = {
  HV: "Happy Valley",
  ST: "Sha Tin",
};

const VERDICT: Record<string, { text: string; tone: string }> = {
  real_edge: { text: "Beats the market favourite", tone: "text-accent-green" },
  rides_market: { text: "Rides the favourite — no edge", tone: "text-ink-70" },
  worse_than_market: { text: "Worse than the favourite", tone: "text-accent-red" },
};

function roiTone(v: number) {
  return v > 0 ? "text-accent-green" : v < 0 ? "text-accent-red" : "text-ink-70";
}

function VenueBlock({ v }: { v: WinEdgeVenue }) {
  const blend = v.rankers.blend;
  const market = v.rankers.market;
  const verdict = v.verdict ? VERDICT[v.verdict] : null;

  // Map ROI (~ -40%..+10%) to a 0..100 bar, breakeven at the right end.
  const bar = (roi: number) => Math.max(0, Math.min(100, (roi + 40) * 2));

  const rows: { label: string; r: typeof blend; strong?: boolean }[] = [
    { label: "Model #1 (blend)", r: blend, strong: true },
    { label: "Market favourite", r: market },
    { label: "Pure factors", r: v.rankers.model },
  ];

  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-body font-semibold">{VENUE_NAME[v.venue] ?? v.venue}</div>
        <div className="num text-micro text-ink-60">
          {v.n_races} races · {v.n_meetings} mtgs
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map(({ label, r, strong }) => (
          <div key={label}>
            <div className="flex items-center justify-between">
              <span className={`text-caption ${strong ? "text-white" : "text-ink-70"}`}>
                {label}
              </span>
              <span className={`num text-caption font-semibold ${roiTone(r.roi_pct)}`}>
                {signed(r.roi_pct, 2, "%")}{" "}
                <span className="text-ink-50">· {r.win_pct.toFixed(0)}% win</span>
              </span>
            </div>
            <ProbBar
              value={bar(r.roi_pct)}
              tone={strong ? "win" : "market"}
              height={strong ? 5 : 3}
              className="mt-1"
            />
          </div>
        ))}
      </div>

      {verdict && (
        <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
          <span className={`text-caption font-medium ${verdict.tone}`}>{verdict.text}</span>
          {v.edge_gap_pts !== null && (
            <span className="num text-micro text-ink-60">
              {signed(v.edge_gap_pts, 2)} pts vs market
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}

/**
 * Win-Edge stress test panel. Leak-free, large-sample ROI of backing the model's
 * #1 pick to WIN, flat stake, vs the market favourite and pure factors. This is
 * the honest replacement for the tiny live-meeting figure — it shows the model
 * has genuine ranking skill (beats the favourite) but does not beat the win-pool
 * takeout. Published by export_data.py from edge_backtest.py's win_edge.json.
 */
export default function WinEdge({ data }: { data: WinEdgeData }) {
  const venues = Object.values(data.venues ?? {}).sort((a, b) =>
    a.venue.localeCompare(b.venue),
  );
  if (!venues.length) return null;

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="eyebrow mb-1">Win-Edge Stress Test</h2>
        <p className="text-micro text-ink-70">
          Flat HK$10 to WIN on the model&apos;s #1 pick, every race, leak-free
          walk-forward over all history. The honest read: the model out-ranks the
          favourite, but no system beats the ~17.5% win-pool takeout.
        </p>
      </div>

      {venues.map((v) => (
        <VenueBlock key={v.venue} v={v} />
      ))}
    </section>
  );
}
