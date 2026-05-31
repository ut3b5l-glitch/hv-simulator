import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

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
        // `--fg` is the foreground channel: white in dark mode, near-black in
        // light. Routing `white` + `ink` through it flips every white-based
        // text/overlay/border (bg-white/10, text-ink-70, ring-white/15, …)
        // between themes with no per-callsite changes.
        white: "rgb(var(--fg) / <alpha-value>)",
        ink: {
          50: "rgb(var(--fg) / 0.94)",
          60: "rgb(var(--fg) / 0.72)",
          70: "rgb(var(--fg) / 0.56)",
          80: "rgb(var(--fg) / 0.40)",
          90: "rgb(var(--fg) / 0.24)",
        },
        glass: {
          surface: "rgb(var(--fg) / 0.055)",
          surfaceStrong: "rgb(var(--fg) / 0.10)",
          border: "rgb(var(--fg) / 0.11)",
          borderStrong: "rgb(var(--fg) / 0.20)",
        },
        // Accents are themed too — light mode uses deeper, higher-contrast
        // values so gold/green/red stay legible on frosted-white surfaces.
        accent: {
          gold: "rgb(var(--c-gold) / <alpha-value>)",
          green: "rgb(var(--c-green) / <alpha-value>)",
          red: "rgb(var(--c-red) / <alpha-value>)",
          blue: "rgb(var(--c-blue) / <alpha-value>)",
          purple: "rgb(var(--c-purple) / <alpha-value>)",
          indigo: "rgb(var(--c-indigo) / <alpha-value>)",
          cyan: "rgb(var(--c-cyan) / <alpha-value>)",
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
  plugins: [
    // `light:` variant — targeted overrides for the few spots where a white
    // value sits on a coloured surface and must not flip (solid active chips).
    plugin(({ addVariant }) => {
      addVariant("light", '[data-theme="light"] &');
    }),
  ],
};

export default config;
