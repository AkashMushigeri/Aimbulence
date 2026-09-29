"use client";

import type { PreArrivalCase } from "@/types/domain/prearrival";

interface ActiveEmergenciesQueueProps {
  cases: PreArrivalCase[];
  activeCaseId?: string | null;
  onSelectCase: (caseItem: PreArrivalCase) => void;
}

export function ActiveEmergenciesQueue({
  cases,
  activeCaseId,
  onSelectCase,
}: ActiveEmergenciesQueueProps) {
  if (cases.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-4 text-center shadow-sm">
        <span className="font-mono text-xs text-stone-500">
          No inbound ambulances active. Transmit case from the Ambulance Dispatch interface.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-700">
          Active Inbound Ambulances ({cases.length})
        </span>
        <span className="text-[10px] font-mono text-stone-400">Click to focus clinical plan</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => {
          const isSelected = c.id === activeCaseId;
          const isCritical = c.priority === "CRITICAL";

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCase(c)}
              className={`w-full text-left rounded-xl p-3.5 transition-all shadow-sm border ${
                isSelected
                  ? "border-stone-900 bg-white ring-2 ring-stone-900/10"
                  : "border-stone-200 bg-[#fffdfa] hover:border-stone-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isCritical ? "bg-red-600 animate-ping" : "bg-amber-500"
                    }`}
                  />
                  <span className="font-mono text-xs font-bold text-stone-900">{c.ambulance_id}</span>
                </div>

                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    isCritical
                      ? "bg-red-100 text-red-800"
                      : c.priority === "HIGH"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-stone-100 text-stone-700"
                  }`}
                >
                  {c.priority}
                </span>
              </div>

              <div className="mt-2">
                <span className="block font-mono text-xs font-semibold text-stone-800 truncate">
                  {c.emergency_category}
                </span>
                <span className="block text-[11px] text-stone-500 truncate">
                  {c.patient_name || "Emergency Patient"} • {c.patient_gender}, {c.patient_age}y
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 font-mono text-xs">
                <span className="text-stone-500">{c.current_location_name}</span>
                <span className={`font-bold ${c.status === "ARRIVED" ? "text-emerald-700" : "text-stone-900"}`}>
                  {c.status === "ARRIVED" ? "ARRIVED" : `${c.eta_minutes}m ETA`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
