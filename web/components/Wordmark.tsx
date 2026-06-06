import ZokkiMark from "./ZokkiMark";

/**
 * Zokki horizontal lockup — the F·Horseshoe mark + the lowercase "zokki"
 * wordmark with the amber accent dot (the brand-kit preferred forms).
 * `light` sits on the dark gradient hero; `dark` is for plain page headers.
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
      <ZokkiMark
        glyph
        tone={tone}
        className="h-7 w-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
      />
      <span className="inline-flex items-end leading-none">
        <span
          className={`text-callout font-extrabold lowercase tracking-tight ${
            light ? "text-mint" : "text-ink-50"
          }`}
        >
          zokki
        </span>
        <span
          aria-hidden
          className="mb-[0.14em] ml-[0.1em] h-[0.26em] w-[0.26em] rounded-full bg-accent-gold"
        />
      </span>
    </span>
  );
}
