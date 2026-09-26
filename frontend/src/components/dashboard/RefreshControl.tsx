"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function RefreshControl({ lastRefreshed }: { lastRefreshed?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    if (lastRefreshed) {
      setFormattedTime(new Date(lastRefreshed).toLocaleTimeString());
    }
  }, [lastRefreshed]);

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
          suppressHydrationWarning
          className="hidden font-mono text-xs font-medium text-stone-600 sm:inline-block"
        >
          {formattedTime ? `Refreshed: ${formattedTime}` : null}
        </span>
      ) : null}
      <button
        type="button"
        data-testid="dashboard-refresh-btn"
        disabled={pending}
        onClick={handleRefresh}
        aria-label="Refresh operational dashboard data"
        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#d8d0c0] bg-[#fffdf9] px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-stone-800 shadow-sm transition-all hover:border-stone-400 hover:bg-[#f5efe3] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${pending ? "animate-ping bg-sky-500" : "bg-emerald-600"}`}
          aria-hidden="true"
        />
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
