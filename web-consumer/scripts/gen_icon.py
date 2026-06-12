#!/usr/bin/env python3
"""Generate the Zokki app icon in the Visual Design v1 look.

Coal tile (charcoal gradient + butter bloom + faint grain) cradling the
gold F-Horseshoe glyph — replacing the old navy-squircle badge so the
home-screen icon matches the splash and the in-app dark-glass surfaces.

Run from web-consumer/:  python3 scripts/gen_icon.py
Outputs (overwrites):
  public/icons/icon-512.png        full-bleed, "any maskable"
  public/icons/icon-192.png        full-bleed, "any maskable"
  public/icons/apple-touch-icon.png  180px, iOS rounds the corners itself
  public/icons/icon.svg            <image> wrapper around the 512 PNG

Glyph kept inside the maskable safe zone (~60% width) so Android's circular
/ squircle masks never clip the horseshoe.
"""

import base64
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"
GLYPH = ICONS / "zokki-glyph-light.png"

# Visual Design v1 tokens (globals.css)
GRAD_STOPS = [(0.0, (0x3B, 0x39, 0x35)), (0.55, (0x27, 0x25, 0x22)), (1.0, (0x16, 0x15, 0x13))]
BUTTER = (249, 239, 152)


def tile(size: int) -> Image.Image:
    """Square coal tile: 150deg charcoal gradient + butter bloom + grain."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    t = np.clip((yy / size) * 0.92 + (xx / size) * 0.08, 0, 1)

    img = np.zeros((size, size, 3), dtype=np.float32)
    for (t0, c0), (t1, c1) in zip(GRAD_STOPS, GRAD_STOPS[1:]):
        seg = np.clip((t - t0) / (t1 - t0), 0, 1)
        mask = (t >= t0) if t0 == 0 else (t > t0)
        for ch in range(3):
            img[..., ch] = np.where(mask, c0[ch] + (c1[ch] - c0[ch]) * seg, img[..., ch])

    # Butter bloom rising from lower-centre, echoing the hero panels.
    cx, cy = size * 0.5, size * 0.62
    rx, ry = size * 0.6, size * 0.5
    dist = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    glow = np.clip(1 - dist, 0, 1) ** 1.7 * 0.14
    for ch in range(3):
        img[..., ch] = img[..., ch] * (1 - glow) + BUTTER[ch] * glow

    rng = np.random.default_rng(20260611)
    grain = rng.normal(0, 1, (size, size, 1)).astype(np.float32) * (255 * 0.014)
    img = np.clip(img + grain, 0, 255)
    return Image.fromarray(img.astype(np.uint8), "RGB")


def composed(size: int, glyph_src: Image.Image) -> Image.Image:
    base = tile(size)
    # Glyph spans ~52% of the tile width → comfortably inside the 80% maskable
    # safe zone, with a soft drop shadow for depth on the coal.
    gw = round(size * 0.52)
    gh = round(glyph_src.height * gw / glyph_src.width)
    glyph = glyph_src.resize((gw, gh), Image.LANCZOS)

    gx = (size - gw) // 2
    gy = (size - gh) // 2

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = Image.new("RGBA", glyph.size, (0, 0, 0, 0))
    sd.paste((0, 0, 0, 110), (0, 0), glyph)
    shadow.paste(sd, (gx, gy + round(size * 0.012)), sd)
    from PIL import ImageFilter

    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.012))

    out = base.convert("RGBA")
    out.alpha_composite(shadow)
    out.alpha_composite(glyph, (gx, gy))
    return out.convert("RGB")


def main() -> None:
    glyph_src = Image.open(GLYPH).convert("RGBA")

    master = composed(512, glyph_src)
    master.save(ICONS / "icon-512.png", optimize=True)
    composed(192, glyph_src).save(ICONS / "icon-192.png", optimize=True)
    composed(180, glyph_src).save(ICONS / "apple-touch-icon.png", optimize=True)

    buf = BytesIO()
    master.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<image width="512" height="512" href="data:image/png;base64,{b64}"/></svg>'
    )
    (ICONS / "icon.svg").write_text(svg)

    for f in ("icon-512.png", "icon-192.png", "apple-touch-icon.png", "icon.svg"):
        print(f"wrote public/icons/{f}")


if __name__ == "__main__":
    main()
