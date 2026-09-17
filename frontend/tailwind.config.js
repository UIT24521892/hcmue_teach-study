/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../packages/ui/src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--color-canvas) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        "surface-raised": "hsl(var(--color-surface-raised) / <alpha-value>)",
        ink: "hsl(var(--color-ink) / <alpha-value>)",
        "ink-muted": "hsl(var(--color-ink-muted) / <alpha-value>)",
        line: "hsl(var(--color-line) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        "accent-strong": "hsl(var(--color-accent-strong) / <alpha-value>)",
        "accent-ink": "hsl(var(--color-accent-ink) / <alpha-value>)",
        focus: "hsl(var(--color-focus) / <alpha-value>)",
        positive: "hsl(var(--color-positive) / <alpha-value>)",
        warning: "hsl(var(--color-warning) / <alpha-value>)",
        tree: "hsl(var(--color-tree) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ['"Be Vietnam Pro"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        lift: "var(--shadow-lift)",
        panel: "var(--shadow-panel)",
      },
      borderRadius: {
        panel: "var(--radius-panel)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 500ms ease-out both",
      },
    },
  },
  plugins: [],
};
