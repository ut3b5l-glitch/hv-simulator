import GlassCard from "./GlassCard";
import ProbBar from "./ProbBar";
import { num } from "@/lib/format";
import type { ModelQuality } from "@/lib/types";

function ScoreCol({
  label,
  brier,
  logloss,
  highlight = false,
}: {
  label: string;
  brier?: number;
  logloss?: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "rounded-tile bg-white/[0.05] py-2" : "py-2"}>
      <div className="eyebrow text-[0.5625rem]">{label}</div>
      <div
        className={`num mt-1 text-headline font-semibold ${
          highlight ? "text-accent-green" : "text-white"
        }`}
      >
        {brier === undefined ? "—" : brier.toFixed(4)}
      </div>
      <div className="eyebrow text-[0.5rem] text-ink-60">Brier</div>
      <div className="num mt-1 text-caption text-ink-70">
        {logloss === undefined ? "—" : logloss.toFixed(3)} LL
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: "market" | "win"; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={`h-1.5 w-1.5 rounded-pill ${
          tone === "win" ? "bg-emerald-400" : "bg-white/40"
        }`}
      />
      {label}
    </span>
  );
}

/**
 * Backtest-derived trust panel for the Performance page: probability-quality
 * scores (Brier / log-loss) for the blend vs the market vs an ML reference, and
 * a reliability chart (predicted vs actual win% per bin). All numbers come from
 * a leak-free walk-forward in validate_blend.py, published via export_data.py.
 */
export default function ModelCalibration({ mq }: { mq: ModelQuality }) {
  const blend = mq.metrics.blend;
  const market = mq.metrics.market;
  if (!blend) return null;

  const bins = mq.calibration;
  const scaleMax =
    Math.max(...bins.flatMap((b) => [b.pred, b.actual]), 1) * 1.08;

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="eyebrow mb-1">Model Calibration</h2>
        <p className="text-micro text-ink-70">
          Leak-free walk-forward over {mq.n_races} races · {mq.n_meetings} meetings.
          Lower Brier / log-loss = sharper, more honest probabilities.
        </p>
      </div>

      <GlassCard className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <ScoreCol label="Blend" brier={blend.brier} logloss={blend.logloss} highlight />
          <ScoreCol label="Market" brier={market?.brier} logloss={market?.logloss} />
          <ScoreCol
            label="ML ref*"
            brier={mq.reference.brier}
            logloss={mq.reference.logloss}
          />
        </div>
        <p className="mt-3 text-[0.625rem] leading-snug text-ink-60">
          *Reference: {mq.reference.label}. The blend matches the market — it rides an
          efficient market rather than beating it, and a gradient-boosted ML model does
          not beat it on HV data.
        </p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">Predicted vs actual win%</span>
          <span className="flex items-center gap-3 text-[0.5625rem] text-ink-70">
            <Legend tone="market" label="predicted" />
            <Legend tone="win" label="actual" />
          </span>
        </div>

        <div className="space-y-2.5">
          {bins.map((b) => {
            const gap = b.pred - b.actual;
            const calibrated = Math.abs(gap) <= 2;
            return (
              <div
                key={b.lo}
                className="grid grid-cols-[3.4rem_1fr_2.8rem] items-center gap-2.5"
              >
                <span className="num text-micro text-ink-70">
                  {b.hi >= 100 ? `${b.lo}%+` : `${b.lo}–${b.hi}%`}
                </span>
                <div className="space-y-1">
                  <ProbBar value={b.pred} max={scaleMax} tone="market" height={4} animate={false} />
                  <ProbBar value={b.actual} max={scaleMax} tone="win" height={4} />
                </div>
                <span
                  className={`num text-right text-micro ${
                    calibrated
                      ? "text-ink-60"
                      : gap > 0
                        ? "text-accent-gold"
                        : "text-accent-green"
                  }`}
                >
                  {gap >= 0 ? "+" : ""}
                  {num(gap, 1)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[0.625rem] leading-snug text-ink-60">
          Gap = predicted − actual (pts). Within ±2 is well-calibrated; the top bins
          (rare strong favourites) are mildly overconfident.
        </p>
      </GlassCard>
    </section>
  );
}
