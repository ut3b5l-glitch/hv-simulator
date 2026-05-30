export type BarTone = "win" | "place" | "show" | "market" | "gold" | "indigo" | "neutral";

const FILL: Record<BarTone, string> = {
  win: "bg-gradient-to-r from-emerald-400 to-teal-300",
  place: "bg-gradient-to-r from-sky-400 to-blue-400",
  show: "bg-gradient-to-r from-cyan-400/90 to-teal-400/80",
  market: "bg-gradient-to-r from-white/40 to-white/25",
  gold: "bg-gradient-to-r from-amber-300 to-yellow-200",
  indigo: "bg-gradient-to-r from-violet-400 to-indigo-400",
  neutral: "bg-white/30",
};

const GLOW: Record<BarTone, string> = {
  win: "shadow-[0_0_12px_-2px_rgba(61,220,151,0.55)]",
  place: "shadow-[0_0_12px_-2px_rgba(95,168,255,0.5)]",
  show: "shadow-[0_0_10px_-3px_rgba(52,214,224,0.45)]",
  market: "",
  gold: "shadow-[0_0_12px_-2px_rgba(245,201,113,0.6)]",
  indigo: "shadow-[0_0_12px_-2px_rgba(129,140,248,0.55)]",
  neutral: "",
};

/**
 * A single horizontal probability bar. `value`/`max` are percentages; the
 * fill reveals with a left-anchored scaleX so it reads as "filling up".
 */
export default function ProbBar({
  value,
  max = 100,
  tone = "win",
  height = 6,
  animate = true,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: BarTone;
  height?: number;
  animate?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`relative w-full overflow-hidden rounded-pill bg-white/[0.06] ${className}`}
      style={{ height }}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-pill ${FILL[tone]} ${GLOW[tone]} ${
          animate ? "bar-fill" : ""
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
