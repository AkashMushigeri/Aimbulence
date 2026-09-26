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
    <html lang="en">
      <body className="min-h-full">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
