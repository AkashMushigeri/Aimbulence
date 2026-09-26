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
    <header className="rounded-lg border border-surface-border bg-surface-raised p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
                {appName}
              </h1>
              <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                LIVE OPS CONTROL CENTER
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">{appTagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge state={connectionState} label="Backend" />
          <RefreshControl lastRefreshed={lastRefreshed} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-slate-400">
          <div>
            <span className="uppercase text-slate-500">API Health: </span>
            <span
              data-testid="api-health-status"
              className={health?.status === "healthy" ? "text-emerald-300 font-semibold" : "text-amber-400"}
            >
              {health?.status ?? (connectionState === "LOADING" ? "CHECKING…" : "UNAVAILABLE")}
            </span>
          </div>

          <div>
            <span className="uppercase text-slate-500">Database: </span>
            <span
              data-testid="database-status"
              className={health?.database === "connected" ? "text-emerald-300" : "text-slate-400"}
            >
              {health?.database ?? "—"}
            </span>
          </div>

          <div>
            <span className="uppercase text-slate-500">Environment: </span>
            <span data-testid="environment-status" className="text-slate-300">
              {health?.environment ?? "development"}
            </span>
          </div>

          {health?.service ? (
            <div className="hidden md:block">
              <span className="uppercase text-slate-500">Service: </span>
              <span className="text-slate-300">{health.service}</span>
            </div>
          ) : null}
        </div>

        {health?.timestamp ? (
          <div className="font-mono text-xs text-slate-500">
            Backend Timestamp: <span className="text-slate-400">{health.timestamp}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
