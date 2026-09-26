import type { Config } from "tailwindcss";

/**
 * AIMBULENCE design tokens for the operator interface.
 *
 * Safety-tier colours are declared here (not inlined per component) so that the
 * GREEN / YELLOW / RED classification from `instruction.md` section 6 is
 * rendered consistently and can never be silently re-interpreted.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#fdfbf7",
          100: "#fbf7ee",
          200: "#f6f1e3",
          300: "#ece4d0",
          400: "#dfd3b7",
          500: "#cfbf9c",
          600: "#9c8c69",
          700: "#6e6144",
          800: "#473d2a",
          900: "#272115",
        },
        surface: {
          DEFAULT: "#fffdf9",
          raised: "#f7f3ea",
          border: "#e5dfd2",
          elevated: "#f0eae0",
        },
        safety: {
          green: "#16a34a",
          yellow: "#ca8a04",
          red: "#dc2626",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
