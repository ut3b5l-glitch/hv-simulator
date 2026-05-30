import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SF Mono",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "monospace",
        ],
      },
      // ── Type scale ────────────────────────────────────────────────
      // Semantic sizes paired with line-height + tracking so callsites
      // never hand-tune text-[13px]/leading values again.
      fontSize: {
        micro2: ["0.625rem", { lineHeight: "0.85rem", letterSpacing: "0.08em" }],
        micro: ["0.6875rem", { lineHeight: "0.95rem", letterSpacing: "0.02em" }],
        caption: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0" }],
        callout: ["0.8125rem", { lineHeight: "1.15rem", letterSpacing: "-0.005em" }],
        body: ["0.9375rem", { lineHeight: "1.35rem", letterSpacing: "-0.01em" }],
        headline: ["1.0625rem", { lineHeight: "1.3rem", letterSpacing: "-0.015em" }],
        title: ["1.3125rem", { lineHeight: "1.55rem", letterSpacing: "-0.02em" }],
        stat: ["1.75rem", { lineHeight: "1.9rem", letterSpacing: "-0.022em" }],
        display: ["2rem", { lineHeight: "2.1rem", letterSpacing: "-0.03em" }],
      },
      // Tracked-out eyebrow labels use a utility; expose the value too.
      letterSpacing: {
        eyebrow: "0.16em",
      },
      colors: {
        ink: {
          50: "rgba(255,255,255,0.94)",
          60: "rgba(255,255,255,0.72)",
          70: "rgba(255,255,255,0.56)",
          80: "rgba(255,255,255,0.40)",
          90: "rgba(255,255,255,0.24)",
        },
        glass: {
          surface: "rgba(255,255,255,0.055)",
          surfaceStrong: "rgba(255,255,255,0.10)",
          border: "rgba(255,255,255,0.11)",
          borderStrong: "rgba(255,255,255,0.20)",
        },
        accent: {
          gold: "#f5c971",
          green: "#3ddc97",
          red: "#fb7185",
          blue: "#5fa8ff",
          purple: "#a78bfa",
          indigo: "#818cf8",
          cyan: "#34d6e0",
        },
      },
      backdropBlur: { xs: "8px" },
      borderRadius: {
        chip: "11px",
        tile: "14px",
        card: "20px",
        squircle: "22px",
        pill: "999px",
      },
      boxShadow: {
        // Layered glass depth — each level sits a little higher off the page.
        "glass-1": "0 1px 1px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-2":
          "0 8px 30px -6px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        "glass-3":
          "0 18px 50px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)",
        // Back-compat aliases used by existing markup.
        glass: "0 8px 30px -6px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        glassHover:
          "0 18px 50px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)",
        "glow-gold": "0 0 0 1px rgba(245,201,113,0.35), 0 6px 24px -6px rgba(245,201,113,0.4)",
        "glow-green": "0 0 0 1px rgba(61,220,151,0.3), 0 6px 24px -8px rgba(61,220,151,0.35)",
        "glow-indigo": "0 8px 28px -8px rgba(129,140,248,0.5)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-back": "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "grow-x": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "expand-down": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "grow-x": "grow-x 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "expand-down": "expand-down 0.28s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
        sheen: "sheen 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
