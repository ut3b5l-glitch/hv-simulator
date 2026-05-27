import type { Factors } from "@/lib/types";

const LABELS: Record<keyof Factors, string> = {
  barrier_iv: "Barrier",
  jockey: "Jockey",
  trainer: "Trainer",
  horse: "Horse",
  form: "Form",
  class_tf: "Class",
  weight_chg: "Weight Δ",
  rating: "Rating",
  days: "Days",
};

function barColor(v: number) {
  if (v >= 1.4) return "bg-accent-green/80";
  if (v >= 1.1) return "bg-accent-green/55";
  if (v >= 0.9) return "bg-white/35";
  if (v >= 0.7) return "bg-accent-red/45";
  return "bg-accent-red/70";
}

export default function FactorBars({ factors }: { factors: Factors }) {
  const keys = Object.keys(LABELS) as (keyof Factors)[];
  return (
    <div className="grid grid-cols-1 gap-2">
      {keys.map((k) => {
        const v = factors[k] ?? 1;
        const pct = Math.min(100, (v / 2.5) * 100);
        return (
          <div key={k} className="flex items-center gap-3">
            <div className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-white/55">
              {LABELS[k]}
            </div>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className={`absolute inset-y-0 left-0 ${barColor(v)} rounded-full`}
                style={{ width: `${pct}%` }}
              />
              <div className="absolute inset-y-0 left-[40%] w-px bg-white/20" />
            </div>
            <div className="num w-10 text-right text-xs font-medium tabular-nums text-white/85">
              {v.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
