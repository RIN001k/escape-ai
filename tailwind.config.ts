import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      colors: {
        sand: {
          50:  "#fdfaf5",
          100: "#f7f0e0",
          200: "#eedfc0",
          300: "#e3c996",
          400: "#d4a96a",
          500: "#c08040",
        },
        stone: {
          950: "#0c0a09",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-pattern":
          "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      },
      animation: {
        "fade-up":    "fadeUp 0.6s ease forwards",
        "fade-in":    "fadeIn 0.5s ease forwards",
        shimmer:      "shimmer 2s linear infinite",
        "spin-slow":  "spin 8s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        glass:   "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.15)",
        card:    "0 20px 60px -12px rgba(0,0,0,0.35)",
        "card-hover": "0 30px 80px -12px rgba(0,0,0,0.5)",
        glow:    "0 0 40px rgba(212,169,106,0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
