import type { Loadable } from "@/lib/loadState";
import type { HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";
import { computeOperationalDeficits, type DeficitSeverity } from "@/lib/deficits";
import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

const SEVERITY_BADGES: Record<DeficitSeverity, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700 font-bold",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700 font-bold",
  NOMINAL: "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold",
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
          <p className="text-xs text-slate-500">
            Deficits cannot be computed without verified hospital baseline capacity from the backend.
          </p>
        </div>
      ) : null}

      {hospital && deficits.length === 0 ? (
        <EmptyState title="No Deficits Detected">
          <p className="text-slate-500">All monitored operational metrics are within standard nominal limits.</p>
        </EmptyState>
      ) : null}

      {hospital && deficits.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-3.5 text-xs sm:text-[13px] text-stone-700 shadow-xs">
            <span className="font-mono font-bold text-stone-900">GOVERNANCE RULE: </span>
            Values labeled <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-800">BACKEND</span> originate from verified backend contracts. Values labeled <span className="rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-800">DERIVED</span> are exact arithmetic results.
          </div>

          <div className="space-y-3.5" data-testid="deficit-list">
            {deficits.map((item) => (
              <div
                key={item.id}
                data-testid={`deficit-item-${item.id}`}
                className={`rounded-2xl border p-5 transition-all duration-300 shadow-xs hover:shadow-md ${
                  item.severity === "CRITICAL"
                    ? "border-red-300 bg-red-50/25 hover:border-red-400"
                    : item.severity === "WARNING"
                    ? "border-amber-300 bg-amber-50/25 hover:border-amber-400"
                    : "border-[#e5dfd2] bg-[#fffdf9] hover:border-[#d8d0c0]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece5d8] pb-3">
                  <h3 className="font-mono text-base font-extrabold text-stone-900">{item.title}</h3>
                  <span
                    data-testid={`deficit-severity-${item.id}`}
                    className={`rounded-md border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider font-extrabold shadow-xs ${
                      SEVERITY_BADGES[item.severity]
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="mt-3.5 grid gap-3.5 text-xs sm:grid-cols-2">
                  {/* Backend Sources Column */}
                  <div className="rounded-xl border border-[#e5dfd2] bg-[#fffdf9] p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#ece5d8] pb-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Source Measurements</span>
                      <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-sky-800">
                        BACKEND
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-2 font-mono">
                      {item.backendSources.map((src, i) => (
                        <li key={i} className="flex justify-between text-stone-800 text-xs sm:text-[13px]">
                          <span className="font-sans text-stone-600 font-medium">{src.label}:</span>
                          <span className="font-bold text-stone-900">{src.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Derived Computation Column */}
                  <div className="rounded-xl border border-[#e5dfd2] bg-[#fffdf9] p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#ece5d8] pb-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Computed Deficit</span>
                      <span className="rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-purple-800">
                        DERIVED
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-sans text-stone-600 font-medium text-xs sm:text-[13px]">{item.derivedMetric.label}:</span>
                        <span
                          data-testid={`derived-value-${item.id}`}
                          className={`text-lg sm:text-xl font-black ${
                            item.severity === "CRITICAL"
                              ? "text-red-700"
                              : item.severity === "WARNING"
                              ? "text-amber-800"
                              : "text-emerald-700"
                          }`}
                        >
                          {item.derivedMetric.value}
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-xs text-stone-600">
                        Formula: {item.formula}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs sm:text-[13px] text-stone-700 leading-relaxed font-medium">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
