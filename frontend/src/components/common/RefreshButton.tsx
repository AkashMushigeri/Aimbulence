"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { describeError } from "@/lib/loadState";

/**
 * Retry control for a read-only reload.
 *
 * Calls `router.refresh()`, which re-runs the server-side load. A retry
 * therefore re-reads real backend state instead of replaying anything cached in
 * the browser.
 */
export function RefreshButton({ target }: { target?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      data-testid={target ? `refresh-${target}` : "refresh"}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="focus-ring rounded-lg border border-[#d8d0c0] bg-[#fffdf9] px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-stone-800 shadow-sm transition-all hover:border-stone-400 hover:bg-[#f5efe3] disabled:opacity-50"
    >
      {pending ? "Refreshing…" : "Retry"}
    </button>
  );
}

/** Inline error notice with a safe retry affordance. */
export function ErrorNotice({ error, title = "Backend unavailable" }: { error: unknown; title?: string }) {
  return (
    <div
      data-testid="error-notice"
      className="rounded-xl border border-red-300 bg-red-50/90 px-4 py-3 shadow-sm"
      role="alert"
    >
      <p className="text-sm sm:text-base font-bold text-red-950">{title}</p>
      <p className="mt-1 text-xs sm:text-sm font-medium text-red-900">{describeError(error)}</p>
      <p className="mt-2 text-xs sm:text-[13px] text-red-800/90">
        No figures are shown for this section. Operational data is never fabricated or carried over
        from a previous load.
      </p>
    </div>
  );
}
