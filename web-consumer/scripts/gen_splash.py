#!/usr/bin/env python3
"""Generate the iOS PWA startup splash images in the Visual Design v1 look.

Charcoal studio gradient + butter bloom + photographic grain, the bgless
F-Horseshoe glyph, the lowercase "zokki" wordmark with the gold dot, and the
HONG KONG RACING strapline — matching components/SplashScreen.tsx.

Run from web-consumer/:  python3 scripts/gen_splash.py
Outputs to public/icons/splash/apple-splash-{W}x{H}.png (overwrites).

Font: scripts/urbanist-var.ttf (Urbanist variable, OFL — from google/fonts).
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SPLASH_DIR = ROOT / "public" / "icons" / "splash"
GLYPH = ROOT / "public" / "icons" / "zokki-glyph-light.png"
FONT = Path(__file__).resolve().parent / "urbanist-var.ttf"

# Device sizes registered in app/layout.tsx appleWebApp.startupImage.
SIZES = [
    (750, 1334), (1242, 2208), (1125, 2436), (828, 1792), (1242, 2688),
    (1170, 2532), (1284, 2778), (1179, 2556), (1290, 2796), (1206, 2622),
    (1320, 2868),
]

# Visual Design v1 tokens (globals.css)
GRAD_STOPS = [(0.0, (0x3B, 0x39, 0x35)), (0.55, (0x27, 0x25, 0x22)), (1.0, (0x16, 0x15, 0x13))]
BUTTER = (249, 239, 152)
GOLD = (0xD3, 0xB3, 0x58)
MINT = (0xF7, 0xF4, 0xE8)


def font_at(size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([weight])
    return f


def background(w: int, h: int) -> Image.Image:
    """150deg charcoal gradient + butter bloom + grain."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # 150deg ≈ mostly vertical with a touch of horizontal drift.
    t = (yy / h) * 0.92 + (xx / w) * 0.08
    t = np.clip(t, 0, 1)

    img = np.zeros((h, w, 3), dtype=np.float32)
    for (t0, c0), (t1, c1) in zip(GRAD_STOPS, GRAD_STOPS[1:]):
        seg = np.clip((t - t0) / (t1 - t0), 0, 1)
        mask = (t >= t0) if t0 == 0 else (t > t0)
        for ch in range(3):
            img[..., ch] = np.where(mask, c0[ch] + (c1[ch] - c0[ch]) * seg, img[..., ch])

    # Butter bloom behind the lockup (radial, centred slightly below middle).
    cx, cy = w * 0.5, h * 0.50
    rx, ry = w * 0.62, h * 0.26
    dist = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    glow = np.clip(1 - dist, 0, 1) ** 1.6 * 0.16
    for ch in range(3):
        img[..., ch] = img[..., ch] * (1 - glow) + BUTTER[ch] * glow

    # Fine grain so the gradient reads photographic, like the app backdrop.
    rng = np.random.default_rng(20260611)
    grain = rng.normal(0, 1, (h, w, 1)).astype(np.float32) * (255 * 0.018)
    img = np.clip(img + grain, 0, 255)

    return Image.fromarray(img.astype(np.uint8), "RGB")


def compose(w: int, h: int, glyph_src: Image.Image) -> Image.Image:
    img = background(w, h)
    draw = ImageDraw.Draw(img)
    s = h / 812  # scale relative to the CSS reference viewport

    # Glyph — h-20 (80pt) in the component.
    gh = round(80 * s)
    gw = round(glyph_src.width * gh / glyph_src.height)
    glyph = glyph_src.resize((gw, gh), Image.LANCZOS)
    gy = round(h * 0.46) - gh
    img.paste(glyph, ((w - gw) // 2, gy), glyph)

    # Wordmark: "zokki" (2rem, extrabold) + gold dot.
    word_font = font_at(round(32 * s), 800)
    word = "zokki"
    bbox = draw.textbbox((0, 0), word, font=word_font)
    ww, wh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    dot_r = round(32 * s * 0.13)
    total_w = ww + round(dot_r * 1.6)
    wx = (w - total_w) // 2 - bbox[0]
    wy = gy + gh + round(20 * s) - bbox[1]
    draw.text((wx, wy), word, font=word_font, fill=MINT)
    dot_cx = wx + bbox[0] + ww + round(dot_r * 1.9)
    dot_cy = wy + bbox[3] - dot_r
    draw.ellipse(
        (dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r), fill=GOLD
    )

    # Strapline: HONG KONG RACING, tracking 0.32em, mint/55.
    tag_size = round(11.2 * s)
    tag_font = font_at(tag_size, 600)
    tag = "HONG KONG RACING"
    tracking = round(tag_size * 0.32)
    widths = [draw.textlength(c, font=tag_font) for c in tag]
    tag_w = sum(widths) + tracking * (len(tag) - 1)
    tx = (w - tag_w) / 2
    ty = wy + bbox[3] + round(14 * s)
    fill = tuple(round(m * 0.55 + c * 0.45) for m, c in zip(MINT, (0x27, 0x25, 0x22)))
    for c, cw in zip(tag, widths):
        draw.text((tx, ty), c, font=tag_font, fill=fill)
        tx += cw + tracking
    return img


def main() -> None:
    glyph_src = Image.open(GLYPH).convert("RGBA")
    SPLASH_DIR.mkdir(parents=True, exist_ok=True)
    for w, h in SIZES:
        out = SPLASH_DIR / f"apple-splash-{w}x{h}.png"
        compose(w, h, glyph_src).save(out, optimize=True)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
