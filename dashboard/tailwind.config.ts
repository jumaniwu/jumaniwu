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
        term: {
          bg:            "#0D0D0D",
          panel:         "#111211",
          "panel-alt":   "#131413",
          border:        "#222322",
          "border-hi":   "#383838",
          green:         "#00FF41",
          "green-dim":   "#00C832",
          "green-dark":  "#062806",
          red:           "#FF2B4A",
          "red-dim":     "#CC1F38",
          "red-dark":    "#280608",
          yellow:        "#FFD200",
          "yellow-dim":  "#C8A200",
          orange:        "#FF8C00",
          cyan:          "#00E5FF",
          "cyan-dim":    "#00B0C8",
          magenta:       "#FF00FF",
          white:         "#E8E8E0",
          muted:         "#5A5A5A",
          "muted-2":     "#383838",
        },
      },
      fontFamily: {
        mono: ["var(--font-fira)", "'Fira Code'", "'Roboto Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "3xs": ["0.5rem",   { lineHeight: "0.75rem" }],
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        "glow-green": "0 0 6px rgba(0,255,65,0.45), 0 0 18px rgba(0,255,65,0.15)",
        "glow-red":   "0 0 6px rgba(255,43,74,0.45), 0 0 18px rgba(255,43,74,0.15)",
        "glow-cyan":  "0 0 6px rgba(0,229,255,0.35)",
        "inner-green":"inset 0 0 24px rgba(0,255,65,0.04)",
      },
      animation: {
        "blink":          "blink 1s step-end infinite",
        "pulse-green":    "pulse-green 1.8s ease-in-out infinite",
        "pulse-red":      "pulse-red 1.8s ease-in-out infinite",
        "fade-in-row":    "fade-in-row 0.2s ease-out",
        "flash-green":    "flash-green 0.45s ease-out",
        "flash-red":      "flash-red 0.45s ease-out",
        "node-glow":      "node-glow 1.4s ease-in-out infinite",
        "slide-in-top":   "slide-in-top 0.18s ease-out",
        "crt-flicker":    "crt-flicker 8s linear infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 4px rgba(0,255,65,0.2)" },
          "50%":      { boxShadow: "0 0 14px rgba(0,255,65,0.7)" },
        },
        "pulse-red": {
          "0%, 100%": { boxShadow: "0 0 4px rgba(255,43,74,0.2)" },
          "50%":      { boxShadow: "0 0 14px rgba(255,43,74,0.7)" },
        },
        "fade-in-row": {
          "0%":   { opacity: "0", transform: "translateY(-3px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "flash-green": {
          "0%":   { backgroundColor: "rgba(0,255,65,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-red": {
          "0%":   { backgroundColor: "rgba(255,43,74,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "node-glow": {
          "0%, 100%": { boxShadow: "0 0 6px rgba(0,255,65,0.35), inset 0 0 6px rgba(0,255,65,0.04)" },
          "50%":      { boxShadow: "0 0 18px rgba(0,255,65,0.75), inset 0 0 12px rgba(0,255,65,0.08)" },
        },
        "slide-in-top": {
          "0%":   { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "crt-flicker": {
          "0%, 97%, 100%":  { opacity: "1" },
          "98%":            { opacity: "0.94" },
          "99%":            { opacity: "0.98" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
