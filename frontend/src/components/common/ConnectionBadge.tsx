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
  CONNECTED: "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold",
  DEGRADED: "border-amber-300 bg-amber-50 text-amber-800 font-bold",
  DISCONNECTED: "border-stone-300 bg-stone-100 text-stone-700 font-bold",
  LOADING: "border-sky-300 bg-sky-50 text-sky-800 font-bold",
  AVAILABLE: "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold",
  FAILED: "border-red-300 bg-red-50 text-red-800 font-bold",
};

export function ConnectionBadge({ state, label }: { state: ConnectionState; label?: string }) {
  return (
    <span
      data-testid={`connection-${state}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs uppercase tracking-wide shadow-xs ${STYLES[state]}`}
    >
      {label ? `${label}: ` : ""}
      {state}
    </span>
  );
}
