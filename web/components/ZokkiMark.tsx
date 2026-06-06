/* eslint-disable @next/next/no-img-element */
/**
 * Zokki brand mark — the official F-Horseshoe artwork, extracted verbatim from
 * the brand kit.
 *
 *  • default (tile)  — horseshoe + Z on the navy squircle (same as the app icon).
 *  • glyph           — bgless horseshoe + Z for inline use in headers. Tone-aware:
 *                      `light` = white Z (for dark backgrounds), `dark` = navy Z
 *                      (for light backgrounds). The amber horseshoe is constant.
 *
 * Size it with `className` (set a height; width follows the artwork ratio).
 */
export default function ZokkiMark({
  className = "h-7 w-7",
  glyph = false,
  tone = "dark",
}: {
  className?: string;
  glyph?: boolean;
  tone?: "light" | "dark";
}) {
  const src = glyph
    ? tone === "light"
      ? "/icons/zokki-glyph-light.png"
      : "/icons/zokki-glyph-dark.png"
    : "/icons/zokki-mark.png";
  const dims = glyph ? { width: 285, height: 241 } : { width: 256, height: 256 };
  return <img src={src} alt="Zokki" {...dims} className={className} />;
}
