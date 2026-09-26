import type { Loadable } from "@/lib/loadState";
import type { HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";
import { computeOperationalDeficits, type DeficitSeverity } from "@/lib/deficits";
import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

const SEVERITY_BADGES: Record<DeficitSeverity, string> = {
  CRITICAL: "border-red-500/60 bg-red-500/20 text-red-200 font-bold",
  WARNING: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  NOMINAL: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export interface DeficitPanelProps {
  readonly hospitalState: Loadable<unknown>;
  readonly resourcesState?: Loadable<unknown>;
  readonly incidentsState?: Loadable<unknown>;
}

export function DeficitPanel({
  hospitalState,
  resourcesState,
  incidentsState,
}: DeficitPanelProps) {
  const hospital = hospitalState.status === "available" ? (hospitalState.data as HospitalCapacity) : undefined;
  const resources = resourcesState?.status === "available" ? (resourcesState.data as ResourceStatus) : undefined;
  const incidents = incidentsState?.status === "available" ? (incidentsState.data as Incident[]) : undefined;
  const primaryIncident = incidents && incidents.length > 0 ? incidents[0] : undefined;

  const deficits = hospital ? computeOperationalDeficits(hospital, resources, primaryIncident) : [];

  return (
    <Panel
      title="Operational Deficits & Bottlenecks"
      description="Deterministic capacity calculations from verified backend data. No LLM or generative approximations."
      action={
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionStateOf(hospitalState)} />
          <RefreshButton target="deficits" />
        </div>
      }
    >
      {hospitalState.status === "loading" ? <LoadingState label="operational deficit model" /> : null}

      {hospitalState.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={hospitalState.error} title="Deficit calculation unavailable" />
          <p className="text-xs text-slate-400">
            Deficits cannot be computed without verified hospital baseline capacity from the backend.
          </p>
        </div>
      ) : null}

      {hospital && deficits.length === 0 ? (
        <EmptyState title="No Deficits Detected">
          <p className="text-slate-400">All monitored operational metrics are within standard nominal limits.</p>
        </EmptyState>
      ) : null}

      {hospital && deficits.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded border border-surface-border/50 bg-surface/30 p-2.5 text-xs text-slate-400">
            <span className="font-mono text-slate-300">GOVERNANCE RULE: </span>
            Values labeled <span className="rounded bg-sky-950 px-1 py-0.5 font-mono text-[10px] text-sky-300">BACKEND</span> originate from verified backend contracts. Values labeled <span className="rounded bg-purple-950 px-1 py-0.5 font-mono text-[10px] text-purple-300">DERIVED</span> are exact arithmetic results.
          </div>

          <div className="space-y-3" data-testid="deficit-list">
            {deficits.map((item) => (
              <div
                key={item.id}
                data-testid={`deficit-item-${item.id}`}
                className="rounded-lg border border-surface-border bg-surface/50 p-4 transition-colors hover:border-slate-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/40 pb-2.5">
                  <h3 className="font-semibold text-slate-100">{item.title}</h3>
                  <span
                    data-testid={`deficit-severity-${item.id}`}
                    className={`rounded border px-2 py-0.5 font-mono text-xs uppercase ${
                      SEVERITY_BADGES[item.severity]
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  {/* Backend Sources Column */}
                  <div className="rounded border border-surface-border/40 bg-surface/40 p-2.5">
                    <div className="flex items-center justify-between border-b border-surface-border/30 pb-1">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400">Source Measurements</span>
                      <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.2 font-mono text-[10px] uppercase font-bold text-sky-300">
                        BACKEND
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 font-mono">
                      {item.backendSources.map((src, i) => (
                        <li key={i} className="flex justify-between text-slate-300">
                          <span className="font-sans text-slate-400">{src.label}:</span>
                          <span className="font-bold text-slate-200">{src.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Derived Computation Column */}
                  <div className="rounded border border-surface-border/40 bg-surface/40 p-2.5">
                    <div className="flex items-center justify-between border-b border-surface-border/30 pb-1">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400">Computed Deficit</span>
                      <span className="rounded border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.2 font-mono text-[10px] uppercase font-bold text-purple-300">
                        DERIVED
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between font-mono">
                        <span className="font-sans text-slate-400">{item.derivedMetric.label}:</span>
                        <span
                          data-testid={`derived-value-${item.id}`}
                          className={`font-bold ${
                            item.severity === "CRITICAL"
                              ? "text-red-300"
                              : item.severity === "WARNING"
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {item.derivedMetric.value}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">
                        Formula: {item.formula}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-2.5 text-xs text-slate-300">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
