import type { Metadata } from "next";
import type { ReactNode } from "react";

import { loadPublicConfig } from "@/lib/config";
import "./globals.css";

/**
 * Application shell root.
 *
 * Only `NEXT_PUBLIC_*` values are read here. Server-only configuration
 * (backend host/port) is never referenced in a client or layout module.
 */
export function generateMetadata(): Metadata {
  const { appName, appTagline } = loadPublicConfig();
  return {
    title: `${appName} — Operator Console`,
    description: appTagline,
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className="min-h-full bg-[#f6f3eb] bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(217,119,6,0.06),rgba(246,243,235,0))] text-stone-800">
        <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
