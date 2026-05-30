import type { Factors } from "@/lib/types";

const LABELS: Record<keyof Factors, string> = {
  barrier_iv: "Barrier",
  jockey: "Jockey",
  trainer: "Trainer",
  horse: "Horse",
  form: "Form",
  class_tf: "Class",
  weight_chg: "Weight",
  rating: "Rating",
  days: "Days",
};

// Factors are multiplicative around 1.0 — a value of 1.0 is neutral, >1 helps,
// <1 hurts. So we render a diverging bar from a centre baseline: the fill grows
// right (green) for tailwinds and left (red) for headwinds. Domain clamped to
// [0.5, 2.0] which covers the engine's realistic range; centre maps to 50%.
const LO = 0.5;
const HI = 2.0;
const CENTER = 1.0;

function geometry(v: number) {
  const c = ((CENTER - LO) / (HI - LO)) * 100; // centre position (%)
  const p = ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * 100;
  const positive = v >= CENTER;
  return {
    left: positive ? c : p,
    width: Math.max(0.5, Math.abs(p - c)),
    positive,
    inert: Math.abs(v - CENTER) < 0.012,
  };
}

export default function FactorBars({ factors }: { factors: Factors }) {
  const keys = Object.keys(LABELS) as (keyof Factors)[];
  const centerPct = ((CENTER - LO) / (HI - LO)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-micro2 uppercase tracking-wide text-ink-80">
        <span>Factor contributions</span>
        <span>×{CENTER.toFixed(1)} neutral</span>
      </div>
      <div className="space-y-1.5">
        {keys.map((k, idx) => {
          const v = factors[k] ?? 1;
          const g = geometry(v);
          return (
            <div key={k} className="flex items-center gap-2.5">
              <div className="w-14 shrink-0 text-micro text-ink-70">{LABELS[k]}</div>
              <div className="relative h-2 flex-1 overflow-hidden rounded-pill bg-white/[0.05]">
                {/* neutral baseline */}
                <div
                  className="absolute inset-y-0 w-px bg-white/25"
                  style={{ left: `${centerPct}%` }}
                />
                {!g.inert && (
                  <div
                    className={`bar-fill absolute inset-y-[1px] rounded-pill ${
                      g.positive
                        ? "bg-gradient-to-r from-emerald-400/70 to-teal-300/80"
                        : "bg-gradient-to-l from-rose-400/70 to-red-400/80"
                    }`}
                    style={{
                      left: `${g.left}%`,
                      width: `${g.width}%`,
                      animationDelay: `${idx * 30}ms`,
                    }}
                  />
                )}
              </div>
              <div
                className={`num w-9 text-right text-caption font-semibold tabular-nums ${
                  g.inert
                    ? "text-ink-80"
                    : g.positive
                      ? "text-accent-green"
                      : "text-accent-red"
                }`}
              >
                {v.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
