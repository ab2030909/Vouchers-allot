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
        background: "#080c14",
        surface: "#0f172a",
        card: "#161f36",
        border: "#263354",
        brand: {
          orange: "#ff6b00",
          cyan: "#00f0ff",
          purple: "#8b5cf6",
          emerald: "#10b981",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(255, 107, 0, 0.25)",
        cyan: "0 0 25px -5px rgba(0, 240, 255, 0.25)",
        purple: "0 0 25px -5px rgba(139, 92, 246, 0.25)",
      }
    },
  },
  plugins: [],
};

export default config;
