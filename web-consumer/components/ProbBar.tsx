export type BarTone = "win" | "place" | "show" | "market" | "gold" | "indigo" | "neutral";

// Fills are built from the Zokki accent tokens so every bar lives in the
// Visual Design v1 family. Two-stop gradients fade an accent toward butter.
const FILL: Record<BarTone, string> = {
  win: "bg-gradient-to-r from-accent-green to-accent-yellow",
  place: "bg-gradient-to-r from-accent-blue to-accent-cyan",
  show: "bg-gradient-to-r from-accent-cyan to-accent-green",
  market: "bg-gradient-to-r from-white/35 to-white/20",
  gold: "bg-gradient-to-r from-accent-gold to-accent-yellow",
  indigo: "bg-gradient-to-r from-accent-blue to-white/45",
  neutral: "bg-white/25",
};

const GLOW: Record<BarTone, string> = {
  win: "shadow-[0_0_12px_-3px_rgba(107,195,75,0.45)]",
  place: "shadow-[0_0_12px_-3px_rgba(164,180,194,0.35)]",
  show: "shadow-[0_0_10px_-3px_rgba(197,203,162,0.4)]",
  market: "",
  gold: "shadow-[0_0_12px_-3px_rgba(211,179,88,0.45)]",
  indigo: "shadow-[0_0_12px_-3px_rgba(164,180,194,0.35)]",
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
