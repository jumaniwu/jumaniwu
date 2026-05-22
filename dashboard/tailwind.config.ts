import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Terminal palette ──────────────────────────────────────────
        term: {
          bg:        "#0D0D0D",   // near-black main background
          panel:     "#111211",   // panel fill
          border:    "#2A2A2A",   // rigid border colour
          "border-bright": "#3D3D3D",
          green:     "#00FF41",   // profit / buy (Matrix green)
          "green-dim":"#00C832",
          red:       "#FF2B4A",   // loss / sell
          "red-dim": "#CC1F38",
          yellow:    "#FFD200",   // warning
          orange:    "#FF8C00",   // alert
          cyan:      "#00E5FF",   // info
          magenta:   "#FF00FF",   // special
          white:     "#E8E6DF",   // primary text
          muted:     "#6B6B6B",   // secondary text
          "muted-2": "#444444",
        },
      },
      fontFamily: {
        mono: ["'Fira Code'", "'Roboto Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        "term-green": "0 0 8px rgba(0,255,65,0.4)",
        "term-red":   "0 0 8px rgba(255,43,74,0.4)",
        "term-cyan":  "0 0 8px rgba(0,229,255,0.3)",
        "term-glow":  "inset 0 0 20px rgba(0,255,65,0.04)",
      },
      animation: {
        "ticker-scroll": "ticker-scroll 30s linear infinite",
        "pulse-green":   "pulse-green 1.5s ease-in-out infinite",
        "blink":         "blink 1s step-end infinite",
        "fade-in-row":   "fade-in-row 0.25s ease-out",
      },
      keyframes: {
        "ticker-scroll": {
          "0%":   { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 4px rgba(0,255,65,0.3)" },
          "50%":       { boxShadow: "0 0 16px rgba(0,255,65,0.8)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "fade-in-row": {
          "0%":   { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
