import GlassCard from "./GlassCard";
import ProbBar, { BarTone } from "./ProbBar";

const TONES: Record<string, string> = {
  default: "text-white",
  good: "text-accent-green",
  bad: "text-accent-red",
  gold: "text-accent-gold",
};

export default function StatTile({
  label,
  value,
  hint,
  tone = "default",
  progress,
  barTone = "win",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "gold";
  /** Optional 0–100 value to render a footer progress bar. */
  progress?: number;
  barTone?: BarTone;
}) {
  return (
    <GlassCard className="flex flex-col p-4">
      <div className="eyebrow">{label}</div>
      <div className={`num mt-1.5 text-stat font-semibold ${TONES[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-caption text-ink-70">{hint}</div>}
      {progress !== undefined && (
        <ProbBar value={progress} tone={barTone} height={5} className="mt-2.5" />
      )}
    </GlassCard>
  );
}
