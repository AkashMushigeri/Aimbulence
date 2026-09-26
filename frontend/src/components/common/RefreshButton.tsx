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
      className="focus-ring rounded border border-surface-border bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-slate-200 hover:border-sky-500/60 disabled:opacity-50"
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
      className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3"
      role="alert"
    >
      <p className="text-sm font-medium text-red-200">{title}</p>
      <p className="mt-1 text-sm text-red-200/80">{describeError(error)}</p>
      <p className="mt-2 text-xs text-red-200/60">
        No figures are shown for this section. Operational data is never fabricated or carried over
        from a previous load.
      </p>
    </div>
  );
}
