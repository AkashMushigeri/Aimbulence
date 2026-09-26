import type { BackendHealth } from "@/services/operations";
import { ConnectionBadge, type ConnectionState } from "@/components/common";
import { RefreshControl } from "./RefreshControl";

export interface SystemStatusProps {
  readonly appName: string;
  readonly appTagline: string;
  readonly connectionState: ConnectionState;
  readonly health?: BackendHealth;
  readonly lastRefreshed?: string;
}

export function SystemStatus({
  appName,
  appTagline,
  connectionState,
  health,
  lastRefreshed,
}: SystemStatusProps) {
  return (
    <header className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ece5d8] pb-4">
        <div className="flex items-center gap-3.5">
          {/* Mission Control Icon with pulse */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-sky-50 text-sky-700 shadow-sm">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
                {appName}
              </h1>
              <div className="flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50/90 px-3 py-1 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-600" />
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-800">
                  LIVE OPS CONTROL CENTER
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-stone-600 sm:text-sm font-medium">{appTagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge state={connectionState} label="Backend" />
          <RefreshControl lastRefreshed={lastRefreshed} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 font-mono">
          {/* API Health Pill */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] px-3.5 py-1.5 shadow-xs">
            <span className="text-xs uppercase tracking-wider text-stone-600 font-bold">API Health:</span>
            <span
              data-testid="api-health-status"
              className={`font-bold ${
                health?.status === "healthy" ? "text-emerald-700 font-extrabold" : "text-amber-700"
              }`}
            >
              {health?.status ?? (connectionState === "LOADING" ? "CHECKING…" : "UNAVAILABLE")}
            </span>
          </div>

          {/* Database Pill */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] px-3.5 py-1.5 shadow-xs">
            <span className="text-xs uppercase tracking-wider text-stone-600 font-bold">Database:</span>
            <span
              data-testid="database-status"
              className={health?.database === "connected" ? "font-extrabold text-emerald-700" : "text-stone-600 font-medium"}
            >
              {health?.database ?? "—"}
            </span>
          </div>

          {/* Environment Pill */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] px-3.5 py-1.5 shadow-xs">
            <span className="text-xs uppercase tracking-wider text-stone-600 font-bold">Environment:</span>
            <span data-testid="environment-status" className="font-extrabold text-stone-800">
              {health?.environment ?? "development"}
            </span>
          </div>

          {health?.service ? (
            <div className="hidden items-center gap-1.5 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] px-3.5 py-1.5 md:flex shadow-xs">
              <span className="text-xs uppercase tracking-wider text-stone-600 font-bold">Service:</span>
              <span className="text-stone-800 font-semibold">{health.service}</span>
            </div>
          ) : null}
        </div>

        {health?.timestamp ? (
          <div className="flex items-center gap-2 font-mono text-xs text-stone-600">
            <span className="font-semibold">Telemetry Sync:</span>
            <span className="rounded-lg bg-[#f0eae0] border border-[#e5dfd2] px-2.5 py-1 text-stone-800 font-bold">{health.timestamp}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
