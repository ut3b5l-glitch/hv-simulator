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
        mono: ["SF Mono", "ui-monospace", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        ink: {
          50: "rgba(255,255,255,0.92)",
          60: "rgba(255,255,255,0.70)",
          70: "rgba(255,255,255,0.55)",
          80: "rgba(255,255,255,0.38)",
          90: "rgba(255,255,255,0.22)",
        },
        glass: {
          surface: "rgba(255,255,255,0.06)",
          surfaceStrong: "rgba(255,255,255,0.10)",
          border: "rgba(255,255,255,0.12)",
          borderStrong: "rgba(255,255,255,0.20)",
        },
        accent: {
          gold: "#f5c542",
          green: "#34d399",
          red: "#fb7185",
          blue: "#60a5fa",
          purple: "#a78bfa",
        },
      },
      backdropBlur: { xs: "8px" },
      borderRadius: { squircle: "22px" },
      boxShadow: {
        glass:
          "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
        glassHover:
          "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
