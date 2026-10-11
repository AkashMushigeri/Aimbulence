"use client";

import type { PreArrivalCase } from "@/types/domain/prearrival";

interface LiveAmbulanceMapProps {
  activeCase: PreArrivalCase | null;
}

export function LiveAmbulanceMap({ activeCase }: LiveAmbulanceMapProps) {
  if (!activeCase) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-stone-200 bg-[#fffdfa] p-6 text-center shadow-sm">
        <span className="text-3xl">🗺️</span>
        <p className="mt-2 font-mono text-sm font-semibold text-stone-700">No Active Ambulance In Transit</p>
        <p className="text-xs text-stone-400">Ambulance GPS tracking and route simulation will appear here when an emergency case is transmitted.</p>
      </div>
    );
  }

  // Calculate progress percentage based on remaining ETA vs initial 14min
  const progressPercent = Math.min(100, Math.max(0, Math.round(((14 - Math.min(14, activeCase.eta_minutes)) / 14) * 100)));
  const isArrived = activeCase.status === "ARRIVED" || activeCase.eta_minutes <= 0;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-[#fffdfa] shadow-sm">
      {/* Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-stone-900">
            Live Ambulance Radar &amp; GPS Telemetry
          </h3>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="rounded bg-stone-200/80 px-2 py-0.5 font-bold text-stone-800">
            Unit {activeCase.ambulance_id}
          </span>
          <span className="text-stone-500">
            {activeCase.latitude?.toFixed(4)}° N, {activeCase.longitude?.toFixed(4)}° E
          </span>
        </div>
      </div>

      {/* Map Vector Visualization */}
      <div className="relative h-64 w-full bg-[#f4ede2] p-4">
        {/* Grid Lines Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#78716c_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Highway 101 / Tumakuru Road Vector Line */}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <path
            d="M 50 180 Q 200 80, 500 120 T 800 60"
            fill="none"
            stroke="#d6cbbe"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 50 180 Q 200 80, 500 120 T 800 60"
            fill="none"
            stroke="#10b981"
            strokeWidth="4"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
        </svg>

        {/* Hospital Destination Pin */}
        <div className="absolute right-12 top-8 flex flex-col items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 font-mono text-xl font-bold text-white shadow-lg ring-4 ring-red-100">
            🏥
          </div>
          <span className="mt-1 rounded bg-stone-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow">
            Metro Central Trauma
          </span>
        </div>

        {/* Origin Marker */}
        <div className="absolute bottom-6 left-8 flex flex-col items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-700 text-sm text-white shadow">
            📍
          </div>
          <span className="mt-1 rounded bg-stone-800 px-2 py-0.5 font-mono text-[9px] font-semibold text-white">
            {activeCase.current_location_name}
          </span>
        </div>

        {/* Dynamic En-Route Ambulance Marker */}
        <div
          className="absolute transition-all duration-700 ease-out"
          style={{
            left: `${Math.min(85, Math.max(15, 15 + progressPercent * 0.7))}%`,
            top: `${Math.min(75, Math.max(25, 65 - progressPercent * 0.4))}%`,
          }}
        >
          <div className="relative -ml-6 -mt-6 flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-2xl shadow-xl ring-4 ring-emerald-400">
              🚑
            </div>
            <div className="mt-1.5 whitespace-nowrap rounded-md bg-stone-900 px-2 py-0.5 text-center font-mono text-[10px] font-bold text-emerald-400 shadow">
              {activeCase.ambulance_id} • {isArrived ? "ARRIVED" : `${activeCase.eta_minutes}m`}
            </div>
          </div>
        </div>

        {/* Telemetry Overlay Box */}
        <div className="absolute bottom-3 right-3 rounded-lg border border-stone-300 bg-white/95 p-3 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <span className="block text-[10px] uppercase text-stone-500">Distance</span>
              <span className="font-bold text-stone-900">{activeCase.distance_km} km</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-stone-500">Est. Arrival</span>
              <span className={`font-bold ${isArrived ? "text-emerald-700" : activeCase.eta_minutes <= 5 ? "text-red-600 font-extrabold" : "text-stone-900"}`}>
                {isArrived ? "ARRIVED" : `${activeCase.eta_minutes} MIN`}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-stone-500">Status</span>
              <span className="font-bold text-emerald-600">{activeCase.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Footer */}
      <div className="border-t border-stone-200 bg-white px-4 py-2.5">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span className="font-mono text-[11px]">Route Progression: {progressPercent}%</span>
          <span className="font-mono text-[11px] font-semibold text-stone-800">
            {isArrived ? "Touchdown at Bay" : `In Transit via Tumakuru Rd Corridor`}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full transition-all duration-500 ${isArrived ? "bg-emerald-600" : "bg-emerald-500"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
