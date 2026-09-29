"use client";

import { useState } from "react";
import type { PreArrivalAction, PreArrivalCase, PreArrivalResourcesOverview } from "@/types/domain/prearrival";
import type { AuditEvent } from "@/types/domain";
import { ActiveEmergenciesQueue } from "./ActiveEmergenciesQueue";
import { HospitalResourcesGrid } from "./HospitalResourcesGrid";
import { LiveAmbulanceMap } from "./LiveAmbulanceMap";
import { PatientSummaryCard } from "./PatientSummaryCard";
import { PreArrivalAuditLog } from "./PreArrivalAuditLog";
import { PreArrivalPlanView } from "./PreArrivalPlanView";

interface HospitalCommandCenterProps {
  initialCases: PreArrivalCase[];
  initialResources: PreArrivalResourcesOverview | null;
  initialAuditEvents: AuditEvent[];
  onSwitchToAmbulanceView?: () => void;
}

export function HospitalCommandCenter({
  initialCases,
  initialResources,
  initialAuditEvents,
  onSwitchToAmbulanceView,
}: HospitalCommandCenterProps) {
  const [cases, setCases] = useState<PreArrivalCase[]>(initialCases);
  const [activeCase, setActiveCase] = useState<PreArrivalCase | null>(
    initialCases.length > 0 ? (initialCases[0] ?? null) : null,
  );
  const [resources, setResources] = useState<PreArrivalResourcesOverview | null>(initialResources);

  const handleSelectCase = (selected: PreArrivalCase) => {
    setActiveCase(selected);
  };

  const handleActionUpdated = (updatedAction: PreArrivalAction) => {
    if (!activeCase) return;

    const updatedActions = activeCase.actions.map((a) =>
      a.id === updatedAction.id ? updatedAction : a,
    );

    const updatedCase = {
      ...activeCase,
      actions: updatedActions,
    };

    setActiveCase(updatedCase);
    setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
  };

  const hasCritical = activeCase?.priority === "CRITICAL";

  return (
    <div className="space-y-6">
      {/* High-Alert Header Banner (if critical patient en route) */}
      {activeCase && (
        <div
          className={`rounded-xl border p-4 shadow-sm transition-all ${
            hasCritical
              ? "border-red-400 bg-red-50 text-red-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`text-2xl ${hasCritical ? "animate-bounce" : ""}`}>🚨</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded">
                    {activeCase.priority} PRE-ARRIVAL ALERT
                  </span>
                  <span className="font-mono text-xs text-stone-600 font-semibold">
                    Unit {activeCase.ambulance_id} • {activeCase.current_location_name}
                  </span>
                </div>
                <p className="mt-1 font-sans text-sm font-bold">
                  Suspected {activeCase.emergency_category} — Patient: {activeCase.patient_gender}, {activeCase.patient_age} yrs.
                  Estimated Touchdown in {activeCase.eta_minutes} Minutes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right font-mono">
                <span className="text-[10px] uppercase text-stone-500 font-bold block">Touchdown Timer</span>
                <span className="text-xl font-bold text-red-700">
                  {activeCase.status === "ARRIVED" ? "TOUCHDOWN" : `${activeCase.eta_minutes}:00 MIN`}
                </span>
              </div>

              {onSwitchToAmbulanceView && (
                <button
                  type="button"
                  onClick={onSwitchToAmbulanceView}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
                >
                  🚑 View Paramedic Feed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inbound Ambulances Queue */}
      <ActiveEmergenciesQueue
        cases={cases}
        activeCaseId={activeCase?.id}
        onSelectCase={handleSelectCase}
      />

      {/* Main Command Center Split Screen */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (5 Cols): Map & Patient Clinical Vitals */}
        <div className="space-y-6 lg:col-span-5">
          <LiveAmbulanceMap activeCase={activeCase} />
          <PatientSummaryCard activeCase={activeCase} />
        </div>

        {/* Right Column (7 Cols): Pre-Arrival Preparation Plan */}
        <div className="space-y-6 lg:col-span-7">
          <PreArrivalPlanView
            activeCase={activeCase}
            onActionUpdated={handleActionUpdated}
          />
        </div>
      </div>

      {/* Hospital Resource Availability Grid */}
      <HospitalResourcesGrid resources={resources} />

      {/* Immutable Audit Log */}
      <PreArrivalAuditLog initialEvents={initialAuditEvents} />
    </div>
  );
}
