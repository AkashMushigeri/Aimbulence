"use client";

import { useState } from "react";
import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { ResourceStatus } from "@/types/domain";
import { ConnectionBadge, connectionStateOf, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

export interface ResourceOverviewProps {
  readonly state: Loadable<unknown>;
}

type TabType = "theatres" | "staff" | "blood" | "ambulances" | "beds";

export function ResourceOverview({ state }: ResourceOverviewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("theatres");
  const resources = state.status === "available" ? (state.data as ResourceStatus) : undefined;

  return (
    <Panel
      title="Detailed Resource Status"
      description="Granular tracking of physical and human operational assets from GET /api/resources."
      action={
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionStateOf(state)} />
          <RefreshButton target="resources" />
        </div>
      }
    >
      {state.status === "loading" ? <LoadingState label="resource inventory" /> : null}

      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Resource inventory unavailable" />
          <p className="text-xs text-slate-400">
            Granular asset tracking could not be loaded. Figures are withheld.
          </p>
        </div>
      ) : null}

      {resources ? (
        <div className="space-y-4">
          {/* Quick Summary Grid */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-3.5 shadow-xs hover:border-[#d8d0c0] transition-all">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Beds Tracked</span>
              <p data-testid="res-beds-summary" className="mt-1 font-mono text-xl sm:text-2xl font-black tracking-tight text-stone-900">
                {resources.beds.filter((b) => !b.isOccupied && !b.isReserved).length}
                <span className="text-xs sm:text-sm font-medium text-stone-600"> / {resources.beds.length} free</span>
              </p>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 shadow-xs hover:border-amber-400 transition-all">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800">Open Theatres</span>
              <p data-testid="res-ors-summary" className="mt-1 font-mono text-xl sm:text-2xl font-black tracking-tight text-amber-900">
                {resources.operatingRooms.filter((r) => r.status === "OPEN").length}
                <span className="text-xs sm:text-sm font-medium text-amber-800"> / {resources.operatingRooms.length} open</span>
              </p>
            </div>

            <div className="rounded-xl border border-sky-300 bg-sky-50/70 p-3.5 shadow-xs hover:border-sky-400 transition-all">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-800">Staff On Duty</span>
              <p data-testid="res-staff-summary" className="mt-1 font-mono text-xl sm:text-2xl font-black tracking-tight text-sky-900">
                {resources.staff.filter((s) => s.isOnDuty).length}
                <span className="text-xs sm:text-sm font-medium text-sky-800">
                  {" "}({resources.staff.filter((s) => s.isOnDuty && !s.isAssigned).length} unassigned)
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 shadow-xs hover:border-emerald-400 transition-all">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">Ambulances Ready</span>
              <p data-testid="res-amb-summary" className="mt-1 font-mono text-xl sm:text-2xl font-black tracking-tight text-emerald-900">
                {resources.ambulances.filter((a) => a.status === "AVAILABLE").length}
                <span className="text-xs sm:text-sm font-medium text-emerald-800"> / {resources.ambulances.length} ready</span>
              </p>
            </div>

            <div className="rounded-xl border border-red-300 bg-red-50/70 p-3.5 shadow-xs hover:border-red-400 transition-all">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-800">O-Neg Blood Reserves</span>
              <p data-testid="res-blood-summary" className="mt-1 font-mono text-xl sm:text-2xl font-black tracking-tight text-red-900">
                {resources.bloodInventory.find((b) => b.bloodType === "O_NEG")?.unitsAvailable ?? "—"}
                <span className="text-xs sm:text-sm font-medium text-red-800"> units</span>
              </p>
            </div>
          </div>

          {/* Segmented Asset Category Tabs */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#e5dfd2] bg-[#f4efe4] p-1.5 text-xs sm:text-sm">
            <button
              type="button"
              data-testid="tab-theatres"
              onClick={() => setActiveTab("theatres")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === "theatres"
                  ? "border border-[#d8d0c0] bg-white text-sky-800 font-extrabold shadow-xs"
                  : "border border-transparent text-stone-600 hover:text-stone-900 hover:bg-white/60 font-bold"
              }`}
            >
              <span>Theatres</span>
              <span className="rounded bg-[#ece5d8] px-1.5 py-0.5 font-mono text-xs text-stone-700 border border-[#e5dfd2]">
                {resources.operatingRooms.length}
              </span>
            </button>
            <button
              type="button"
              data-testid="tab-staff"
              onClick={() => setActiveTab("staff")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === "staff"
                  ? "border border-[#d8d0c0] bg-white text-sky-800 font-extrabold shadow-xs"
                  : "border border-transparent text-stone-600 hover:text-stone-900 hover:bg-white/60 font-bold"
              }`}
            >
              <span>Staff Roster</span>
              <span className="rounded bg-[#ece5d8] px-1.5 py-0.5 font-mono text-xs text-stone-700 border border-[#e5dfd2]">
                {resources.staff.length}
              </span>
            </button>
            <button
              type="button"
              data-testid="tab-blood"
              onClick={() => setActiveTab("blood")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === "blood"
                  ? "border border-[#d8d0c0] bg-white text-sky-800 font-extrabold shadow-xs"
                  : "border border-transparent text-stone-600 hover:text-stone-900 hover:bg-white/60 font-bold"
              }`}
            >
              <span>Blood Bank</span>
              <span className="rounded bg-[#ece5d8] px-1.5 py-0.5 font-mono text-xs text-stone-700 border border-[#e5dfd2]">
                {resources.bloodInventory.length}
              </span>
            </button>
            <button
              type="button"
              data-testid="tab-ambulances"
              onClick={() => setActiveTab("ambulances")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === "ambulances"
                  ? "border border-[#d8d0c0] bg-white text-sky-800 font-extrabold shadow-xs"
                  : "border border-transparent text-stone-600 hover:text-stone-900 hover:bg-white/60 font-bold"
              }`}
            >
              <span>Ambulances</span>
              <span className="rounded bg-[#ece5d8] px-1.5 py-0.5 font-mono text-xs text-stone-700 border border-[#e5dfd2]">
                {resources.ambulances.length}
              </span>
            </button>
            <button
              type="button"
              data-testid="tab-beds"
              onClick={() => setActiveTab("beds")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === "beds"
                  ? "border border-[#d8d0c0] bg-white text-sky-800 font-extrabold shadow-xs"
                  : "border border-transparent text-stone-600 hover:text-stone-900 hover:bg-white/60 font-bold"
              }`}
            >
              <span>Beds</span>
              <span className="rounded bg-[#ece5d8] px-1.5 py-0.5 font-mono text-xs text-stone-700 border border-[#e5dfd2]">
                {resources.beds.length}
              </span>
            </button>
          </div>

          {/* Theatres Tab */}
          {activeTab === "theatres" ? (
            <div data-testid="theatres-content" className="space-y-2">
              <ul className="space-y-2" data-testid="operating-room-list">
                {resources.operatingRooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5dfd2] bg-[#fffdf9] px-4 py-3 text-xs sm:text-[13px] transition-colors hover:border-[#d8d0c0] shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm sm:text-base font-bold text-stone-900">{room.roomNumber}</span>
                        {room.isEmergencyCleared ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            CLEARED FOR TRAUMA
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-stone-600 font-medium">
                        {room.scheduledProcedure ?? "No procedure currently scheduled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                          room.status === "OPEN"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-extrabold"
                            : room.status === "IN_USE"
                            ? "border-amber-300 bg-amber-50 text-amber-800 font-extrabold"
                            : "border-stone-200 bg-stone-100 text-stone-700"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            room.status === "OPEN"
                              ? "bg-emerald-600 animate-pulse"
                              : room.status === "IN_USE"
                              ? "bg-amber-600"
                              : "bg-stone-400"
                          }`}
                        />
                        {room.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Staff Tab */}
          {activeTab === "staff" ? (
            <div data-testid="staff-content" className="space-y-2">
              <ul className="space-y-2" data-testid="staff-list">
                {resources.staff.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5dfd2] bg-[#fffdf9] px-4 py-3 text-xs sm:text-[13px] transition-colors hover:border-[#d8d0c0] shadow-xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-sm sm:text-base">{member.name}</span>
                      <span className="ml-2 font-mono text-xs text-stone-600">({member.department})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span className="rounded-md border border-[#e5dfd2] bg-[#fbf9f4] px-2.5 py-0.5 text-xs text-stone-800 font-medium">
                        {member.role}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs uppercase font-bold tracking-wider ${
                          member.isOnDuty
                            ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border border-stone-200 bg-stone-100 text-stone-600"
                        }`}
                      >
                        {member.isOnDuty && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                        {member.isOnDuty ? "ON DUTY" : "OFF DUTY"}
                      </span>
                      <span
                        className={`rounded-md px-2.5 py-0.5 text-xs uppercase font-bold tracking-wider ${
                          member.isAssigned
                            ? "border border-purple-300 bg-purple-50 text-purple-800"
                            : "border border-sky-300 bg-sky-50 text-sky-800"
                        }`}
                      >
                        {member.isAssigned ? "ASSIGNED" : "UNASSIGNED"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Blood Bank Tab */}
          {activeTab === "blood" ? (
            <div data-testid="blood-content" className="space-y-2">
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-testid="blood-list">
                {resources.bloodInventory.map((unit) => {
                  const isLow = unit.unitsAvailable <= unit.minimumThreshold;
                  return (
                    <li
                      key={unit.id}
                      className={`rounded-2xl border p-4 text-xs transition-all ${
                        isLow
                          ? "border-red-300 bg-red-50/40 shadow-xs"
                          : "border-[#e5dfd2] bg-[#fffdf9] hover:border-[#d8d0c0] shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-black tracking-wide text-stone-900">
                          {unit.bloodType.replace("_", " ")}
                        </span>
                        <span
                          className={`rounded-md px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider ${
                            isLow
                              ? "border border-red-300 bg-red-100 text-red-800 font-extrabold"
                              : "border border-emerald-300 bg-emerald-100 text-emerald-800 font-extrabold"
                          }`}
                        >
                          {isLow ? "CRITICAL THRESHOLD" : "ADEQUATE"}
                        </span>
                      </div>
                      <p className="mt-2.5 font-mono text-2xl font-black tracking-tight text-stone-900">
                        {unit.unitsAvailable} <span className="text-xs sm:text-sm font-medium text-stone-600">units</span>
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs font-mono text-stone-600 border-t border-[#ece5d8] pt-2">
                        <span>Min Threshold:</span>
                        <span className="font-bold text-stone-800">{unit.minimumThreshold} units</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* Ambulances Tab */}
          {activeTab === "ambulances" ? (
            <div data-testid="ambulances-content" className="space-y-2">
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="ambulance-list">
                {resources.ambulances.map((amb) => (
                  <li
                    key={amb.id}
                    className="flex items-center justify-between rounded-xl border border-[#e5dfd2] bg-[#fffdf9] p-4 text-xs sm:text-[13px] transition-colors hover:border-[#d8d0c0] shadow-xs"
                  >
                    <div>
                      <span className="font-mono text-base font-bold text-stone-900">{amb.vehicleCode}</span>
                      <p className="mt-0.5 text-stone-600 font-medium">
                        Crew: <span className={amb.crewAssigned ? "text-emerald-800 font-bold" : "text-stone-600"}>{amb.crewAssigned ? "Assigned & In-Cab" : "No crew"}</span>
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                        amb.status === "AVAILABLE"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-extrabold"
                          : "border-stone-200 bg-stone-100 text-stone-700"
                      }`}
                    >
                      {amb.status === "AVAILABLE" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      )}
                      {amb.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Beds Tab */}
          {activeTab === "beds" ? (
            <div data-testid="beds-content" className="space-y-2">
              <div className="max-h-72 overflow-y-auto rounded-xl border border-[#e5dfd2] shadow-sm">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 border-b border-[#e5dfd2] bg-[#f7f3ea] font-mono text-xs font-bold uppercase tracking-wider text-stone-700">
                    <tr>
                      <th className="px-3.5 py-3">Bed Code</th>
                      <th className="px-3.5 py-3">Type</th>
                      <th className="px-3.5 py-3">Department</th>
                      <th className="px-3.5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece5d8] font-mono text-stone-800">
                    {resources.beds.map((bed, idx) => {
                      const isFree = !bed.isOccupied && !bed.isReserved;
                      return (
                        <tr
                          key={bed.id}
                          className={`${
                            idx % 2 === 0 ? "bg-[#fffdf9]" : "bg-[#fbf9f4]"
                          } hover:bg-[#faf6ee] transition-colors`}
                        >
                          <td className="px-3.5 py-2.5 font-bold text-stone-900">{bed.bedCode}</td>
                          <td className="px-3.5 py-2.5 text-stone-600">{bed.bedType}</td>
                          <td className="px-3.5 py-2.5 font-sans text-stone-800 font-medium">{bed.department}</td>
                          <td className="px-3.5 py-2.5 text-right">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs uppercase font-bold tracking-wider ${
                                isFree
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                                  : bed.isReserved
                                  ? "border border-amber-300 bg-amber-50 text-amber-800"
                                  : "border border-stone-200 bg-stone-100 text-stone-700"
                              }`}
                            >
                              {isFree && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                              {isFree ? "AVAILABLE" : bed.isReserved ? "RESERVED" : "OCCUPIED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs font-mono text-stone-600 border-t border-[#ece5d8] pt-2">
            <span>Granular Telemetry Stream</span>
            <span>Last Inventory Snapshot: {formatRelativeAge(resources.lastUpdated)}</span>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
