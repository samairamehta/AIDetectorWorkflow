import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: "var(--dd-bg)",
        surface: "var(--dd-surface)",
        surface2: "var(--dd-surface-2)",
        ink: "var(--dd-ink)",
        muted: "var(--dd-ink-muted)",
        faint: "var(--dd-ink-faint)",
        line: "var(--dd-border)",
        linestrong: "var(--dd-border-strong)",
        teal: "var(--dd-teal)",
        tealsoft: "var(--dd-teal-soft)",
        amber: "var(--dd-amber)",
        ambersoft: "var(--dd-amber-soft)",
        crimson: "var(--dd-crimson)",
        crimsonsoft: "var(--dd-crimson-soft)",
      },
      fontFamily: {
        // --font-ui is set by the font picker; falls back to Inter.
        sans: ["var(--font-ui, var(--font-inter))", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        dd: "var(--dd-shadow)",
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
