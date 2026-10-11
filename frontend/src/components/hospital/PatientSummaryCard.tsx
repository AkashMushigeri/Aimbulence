"use client";

import type { PreArrivalCase } from "@/types/domain/prearrival";

interface PatientSummaryCardProps {
  activeCase: PreArrivalCase | null;
}

export function PatientSummaryCard({ activeCase }: PatientSummaryCardProps) {
  if (!activeCase) {
    return (
      <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-6 text-center shadow-sm">
        <p className="font-mono text-sm font-semibold text-stone-700">No Patient Intake Selected</p>
        <p className="text-xs text-stone-400">Select an active emergency from the top queue or dispatch from the ambulance interface.</p>
      </div>
    );
  }

  const vitals = activeCase.vitals;
  const isHypotensive = vitals.bp ? parseInt(vitals.bp.split("/")[0] ?? "120", 10) <= 95 : false;
  const isTachycardic = vitals.hr ? vitals.hr > 100 : false;
  const isHypoxemic = vitals.spo2 ? vitals.spo2 < 92 : false;

  return (
    <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-5 shadow-sm space-y-4">
      {/* Patient Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-base font-bold text-stone-900">
              {activeCase.patient_name || "Emergency Patient"}
            </h3>
            <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">
              {activeCase.patient_gender}, {activeCase.patient_age} yrs
            </span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-stone-500">
            Mechanism: {activeCase.incident_type || "Trauma Transport"} • Unit: {activeCase.ambulance_id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-lg px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
              activeCase.priority === "CRITICAL"
                ? "border border-red-300 bg-red-50 text-red-700 shadow-sm"
                : activeCase.priority === "HIGH"
                ? "border border-amber-300 bg-amber-50 text-amber-800"
                : "border border-stone-200 bg-stone-100 text-stone-700"
            }`}
          >
            {activeCase.priority} PRIORITY
          </span>
          <span className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 font-mono text-xs font-semibold text-purple-800">
            {activeCase.emergency_category}
          </span>
        </div>
      </div>

      {/* Real-Time Clinical Vitals Grid */}
      <div>
        <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
          Pre-Arrival Vitals Telemetry
        </span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {/* BP */}
          <div className={`rounded-lg border p-2.5 ${isHypotensive ? "border-red-200 bg-red-50/60" : "border-stone-200 bg-white"}`}>
            <span className="block font-mono text-[10px] text-stone-500 uppercase">Blood Pressure</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`font-mono text-base font-bold ${isHypotensive ? "text-red-700" : "text-stone-900"}`}>
                {vitals.bp || "—"}
              </span>
              <span className="text-[10px] text-stone-400">mmHg</span>
            </div>
            {isHypotensive && (
              <span className="mt-1 inline-block rounded bg-red-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                HYPOTENSIVE
              </span>
            )}
          </div>

          {/* HR */}
          <div className={`rounded-lg border p-2.5 ${isTachycardic ? "border-amber-200 bg-amber-50/60" : "border-stone-200 bg-white"}`}>
            <span className="block font-mono text-[10px] text-stone-500 uppercase">Heart Rate</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`font-mono text-base font-bold ${isTachycardic ? "text-amber-800" : "text-stone-900"}`}>
                {vitals.hr ?? "—"}
              </span>
              <span className="text-[10px] text-stone-400">BPM</span>
            </div>
            {isTachycardic && (
              <span className="mt-1 inline-block rounded bg-amber-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                TACHYCARDIA
              </span>
            )}
          </div>

          {/* SpO2 */}
          <div className={`rounded-lg border p-2.5 ${isHypoxemic ? "border-red-200 bg-red-50/60" : "border-stone-200 bg-white"}`}>
            <span className="block font-mono text-[10px] text-stone-500 uppercase">Oxygen Saturation</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`font-mono text-base font-bold ${isHypoxemic ? "text-red-700" : "text-stone-900"}`}>
                {vitals.spo2 ?? "—"}%
              </span>
            </div>
            {isHypoxemic && (
              <span className="mt-1 inline-block rounded bg-red-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                HYPOXEMIC
              </span>
            )}
          </div>

          {/* Consciousness / GCS */}
          <div className="rounded-lg border border-stone-200 bg-white p-2.5">
            <span className="block font-mono text-[10px] text-stone-500 uppercase">Consciousness</span>
            <span className="block mt-0.5 font-mono text-xs font-bold text-stone-900">
              {activeCase.consciousness || "Alert"}
            </span>
            <span className="mt-1 inline-block text-[10px] text-stone-400">
              Blood: {activeCase.blood_group || "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Observed Acute Symptoms Tags */}
      <div>
        <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
          Identified Clinical Indicators
        </span>
        <div className="flex flex-wrap gap-1.5">
          {activeCase.symptoms.map((s, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-xs text-stone-800"
            >
              • {s}
            </span>
          ))}
        </div>
      </div>

      {/* Raw Paramedic Transmission */}
      {activeCase.raw_description && (
        <div className="rounded-lg border border-stone-200 bg-[#fbf8f2] p-3 text-xs">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500">
            En-Route Paramedic Voice/Text Dispatch:
          </span>
          <p className="mt-1 font-sans italic text-stone-800 leading-relaxed">
            &ldquo;{activeCase.raw_description}&rdquo;
          </p>
        </div>
      )}

      {/* AI Clinical Assessment Summary */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs">
        <div className="flex items-center gap-1.5 font-mono font-bold text-sky-900">
          <span>🧠</span> AI PRE-ARRIVAL PREPARATION ASSESSMENT
        </div>
        <p className="mt-1 text-sky-950 font-sans leading-relaxed">
          {activeCase.clinical_summary}
        </p>
        <span className="mt-1 block text-[10px] text-sky-700/80">
          Advisory recommendation based on verified clinical rules. Requires clinician verification upon ambulance touchdown.
        </span>
      </div>
    </div>
  );
}
