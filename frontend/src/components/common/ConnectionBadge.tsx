import type { Loadable } from "@/lib/loadState";

/**
 * The five connection states the operator console must be able to distinguish.
 */
export type ConnectionState = "CONNECTED" | "DISCONNECTED" | "LOADING" | "AVAILABLE" | "FAILED" | "DEGRADED";

export function connectionStateOf<T>(state: Loadable<T> | undefined): ConnectionState {
  if (!state || state.status === "loading") {
    return "LOADING";
  }
  if (state.status === "failed") {
    return state.error.kind === "CONFIGURATION" ? "DISCONNECTED" : "FAILED";
  }
  return "AVAILABLE";
}

const STYLES: Record<ConnectionState, string> = {
  CONNECTED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DEGRADED: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  DISCONNECTED: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  LOADING: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  AVAILABLE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-red-500/50 bg-red-500/10 text-red-300",
};

export function ConnectionBadge({ state, label }: { state: ConnectionState; label?: string }) {
  return (
    <span
      data-testid={`connection-${state}`}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${STYLES[state]}`}
    >
      {label ? `${label}: ` : ""}
      {state}
    </span>
  );
}
