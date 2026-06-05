/**
 * Win / Place / Show are nested probabilities (win ≤ place ≤ show), so we draw
 * them as one stacked track: the widest faint Show band, the Place band on top,
 * the bright Win band on top of that. The eye reads the nesting directly.
 */
export default function WPSMeter({
  win,
  place,
  show,
  className = "",
}: {
  win: number;
  place: number;
  show: number;
  className?: string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className={className}>
      <div className="relative h-2 w-full overflow-hidden rounded-pill bg-white/[0.06]">
        <div
          className="bar-fill absolute inset-y-0 left-0 rounded-pill bg-gradient-to-r from-accent-cyan/45 to-accent-green/35"
          style={{ width: `${clamp(show)}%` }}
        />
        <div
          className="bar-fill absolute inset-y-0 left-0 rounded-pill bg-gradient-to-r from-accent-blue/80 to-accent-cyan/60"
          style={{ width: `${clamp(place)}%`, animationDelay: "60ms" }}
        />
        <div
          className="bar-fill absolute inset-y-0 left-0 rounded-pill bg-gradient-to-r from-accent-green to-accent-cyan shadow-[0_0_12px_-3px_rgba(13,138,101,0.45)]"
          style={{ width: `${clamp(win)}%`, animationDelay: "120ms" }}
        />
      </div>
      <div className="num mt-1.5 flex items-center gap-3 text-micro2 text-ink-70">
        <Legend dot="bg-accent-green" label="W" value={win} bright />
        <Legend dot="bg-accent-blue" label="P" value={place} />
        <Legend dot="bg-accent-cyan/80" label="S" value={show} />
      </div>
    </div>
  );
}

function Legend({
  dot,
  label,
  value,
  bright = false,
}: {
  dot: string;
  label: string;
  value: number;
  bright?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className={bright ? "text-ink-50" : "text-ink-70"}>
        {label} {value.toFixed(value < 10 ? 1 : 0)}%
      </span>
    </span>
  );
}
