"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshControl({ lastRefreshed }: { lastRefreshed?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3">
      {lastRefreshed ? (
        <span
          data-testid="last-refresh-time"
          className="hidden font-mono text-xs text-slate-400 sm:inline-block"
        >
          Refreshed: {new Date(lastRefreshed).toLocaleTimeString()}
        </span>
      ) : null}
      <button
        type="button"
        data-testid="dashboard-refresh-btn"
        disabled={pending}
        onClick={handleRefresh}
        aria-label="Refresh operational dashboard data"
        className="focus-ring inline-flex items-center gap-1.5 rounded border border-surface-border bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-slate-200 transition-colors hover:border-sky-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${pending ? "animate-ping bg-sky-400" : "bg-emerald-400"}`}
          aria-hidden="true"
        />
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
