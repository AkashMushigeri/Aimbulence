"use client";

import type { PreArrivalResourcesOverview } from "@/types/domain/prearrival";

interface HospitalResourcesGridProps {
  resources: PreArrivalResourcesOverview | null;
}

export function HospitalResourcesGrid({ resources }: HospitalResourcesGridProps) {
  if (!resources) {
    return (
      <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-5 shadow-sm">
        <p className="font-mono text-xs text-stone-500">Loading hospital resource capacity...</p>
      </div>
    );
  }

  const ed = resources.emergency_beds;
  const icu = resources.icu_beds;

  return (
    <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-stone-900">
              Hospital Resource Availability &amp; Preparedness
            </h3>
            <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-900">
              Demo Hospital Data
            </span>
          </div>
          <p className="text-xs text-stone-500 font-mono mt-0.5">
            Facility: {resources.hospital_name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Emergency Beds */}
        <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-stone-500 font-bold">Emergency Beds</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
              {ed.status}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold text-stone-900">{ed.available}</span>
            <span className="font-mono text-xs text-stone-400">/ {ed.total} available</span>
          </div>
          {ed.reserved > 0 && (
            <span className="font-mono text-[10px] text-purple-700 block">
              • {ed.reserved} reserved for incoming trauma
            </span>
          )}
          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.round((ed.available / Math.max(1, ed.total)) * 100)}%` }}
            />
          </div>
        </div>

        {/* ICU Beds */}
        <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-stone-500 font-bold">ICU Capacity</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
              {icu.status}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold text-stone-900">{icu.available}</span>
            <span className="font-mono text-xs text-stone-400">/ {icu.total} available</span>
          </div>
          {icu.reserved > 0 && (
            <span className="font-mono text-[10px] text-purple-700 block">
              • {icu.reserved} reserved for incoming trauma
            </span>
          )}
          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.round((icu.available / Math.max(1, icu.total)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Blood Bank */}
        <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-stone-500 font-bold">O-Neg Blood Reserves</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
              ADEQUATE
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold text-stone-900">
              {(resources.blood_inventory || []).find((b) => b.type === "O_NEG")?.units_available ?? 18}
            </span>
            <span className="font-mono text-xs text-stone-400">units in bank</span>
          </div>
          <span className="font-mono text-[10px] text-stone-500 block">
            Min threshold: 10 units • Uncrossmatched ready
          </span>
        </div>

        {/* Operating Rooms */}
        <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-stone-500 font-bold">Operating Suites</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
              2 OPEN / 3 IN USE
            </span>
          </div>
          <div className="font-mono text-xs space-y-0.5 text-stone-700 pt-1">
            <div className="flex justify-between">
              <span>OR-1 &amp; OR-2</span>
              <span className="font-bold text-emerald-600">OPEN / Ready</span>
            </div>
            <div className="flex justify-between">
              <span>OR-3 (Trauma Standby)</span>
              <span className="font-bold text-amber-700">Pre-Op Knee Arthroscopy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment & Specialist List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-1 text-xs">
        {/* On-Duty Specialists */}
        <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-2">
            On-Duty Trauma Specialists &amp; Surgeons
          </span>
          <div className="space-y-1.5 font-mono">
            {(resources.trauma_surgeons || []).map((s, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-stone-200">
                <span className="font-bold text-stone-900">{s.name}</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scanners & Equipment */}
        <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-2">
            Diagnostic &amp; Resuscitation Equipment
          </span>
          <div className="space-y-1.5 font-mono">
            {(resources.scanners_and_equipment || []).map((eq, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-stone-200">
                <div>
                  <span className="font-bold text-stone-900 block">{eq.equipment}</span>
                  <span className="text-[10px] text-stone-400">{eq.location}</span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                  {eq.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
