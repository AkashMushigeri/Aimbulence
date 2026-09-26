import type { NextConfig } from "next";

/**
 * AIMBULENCE frontend configuration (Member 2 ownership).
 *
 * No backend secrets are exposed to the browser bundle. The backend base URL is
 * resolved server-side only; see `src/lib/config.ts`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
