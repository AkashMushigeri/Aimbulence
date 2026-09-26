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
        surface: {
          DEFAULT: "#0b1220",
          raised: "#111c2e",
          border: "#1e2d45",
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
