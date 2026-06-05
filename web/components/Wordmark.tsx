/**
 * Zokki brand wordmark — a rounded "Z" chip + the name. `light` sits on the
 * dark gradient hero; `dark` is the muted navy mark for plain page headers.
 */
export default function Wordmark({
  tone = "dark",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const light = tone === "light";
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`grid h-6 w-6 place-items-center rounded-[7px] text-[0.82rem] font-extrabold leading-none ${
          light
            ? "bg-[rgba(255,255,255,0.16)] text-mint ring-1 ring-[rgba(255,255,255,0.22)]"
            : "bg-navy text-mint shadow-glass-1"
        }`}
      >
        Z
      </span>
      <span
        className={`text-callout font-extrabold tracking-tight ${
          light ? "text-mint" : "text-ink-50"
        }`}
      >
        Zokki
      </span>
    </span>
  );
}
