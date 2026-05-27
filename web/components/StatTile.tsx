import GlassCard from "./GlassCard";

export default function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "gold";
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    good: "text-accent-green",
    bad: "text-accent-red",
    gold: "text-accent-gold",
  };
  return (
    <GlassCard className="p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/55">
        {label}
      </div>
      <div className={`num mt-1.5 text-2xl font-semibold ${tones[tone]}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-white/55">{hint}</div>
      )}
    </GlassCard>
  );
}
