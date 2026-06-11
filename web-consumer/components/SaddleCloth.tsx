/**
 * SaddleCloth — the horse's number, drawn like the cloth it wears at the track.
 * HK racegoers pick and back horses by NUMBER; this square is the app's most
 * load-bearing glyph. White cloth, coal number; the top pick wears butter.
 */
export default function SaddleCloth({
  no,
  size = "md",
  tone = "default",
}: {
  no: number | null | undefined;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "gold" | "muted";
}) {
  const sizes = {
    sm: "h-7 w-7 rounded-[8px] text-callout",
    md: "h-10 w-10 rounded-[10px] text-title",
    lg: "h-14 w-14 rounded-[13px] text-display",
  }[size];
  const tones = {
    default:
      "bg-[#ffffff] text-[#121212] ring-1 ring-[rgba(255,255,255,0.25)] shadow-[0_3px_10px_-2px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.9)]",
    gold: "butter-panel ring-2 ring-accent-gold/70 shadow-[0_4px_16px_-2px_rgba(211,179,88,0.5)]",
    muted:
      "bg-[rgba(255,255,255,0.16)] text-[rgba(255,255,255,0.55)] ring-1 ring-[rgba(255,255,255,0.12)]",
  }[tone];

  return (
    <div className={`num grid shrink-0 place-items-center font-bold ${sizes} ${tones}`}>
      {no ?? "—"}
    </div>
  );
}
