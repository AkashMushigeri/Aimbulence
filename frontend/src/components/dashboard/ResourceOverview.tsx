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
            <div className="rounded border border-surface-border bg-surface/50 p-2.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Beds Tracked</span>
              <p data-testid="res-beds-summary" className="mt-0.5 font-mono text-lg font-bold text-slate-100">
                {resources.beds.filter((b) => !b.isOccupied && !b.isReserved).length}
                <span className="text-xs font-normal text-slate-400"> / {resources.beds.length} free</span>
              </p>
            </div>

            <div className="rounded border border-surface-border bg-surface/50 p-2.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Open Theatres</span>
              <p data-testid="res-ors-summary" className="mt-0.5 font-mono text-lg font-bold text-amber-300">
                {resources.operatingRooms.filter((r) => r.status === "OPEN").length}
                <span className="text-xs font-normal text-slate-400"> / {resources.operatingRooms.length} open</span>
              </p>
            </div>

            <div className="rounded border border-surface-border bg-surface/50 p-2.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Staff On Duty</span>
              <p data-testid="res-staff-summary" className="mt-0.5 font-mono text-lg font-bold text-sky-300">
                {resources.staff.filter((s) => s.isOnDuty).length}
                <span className="text-xs font-normal text-slate-400">
                  {" "}({resources.staff.filter((s) => s.isOnDuty && !s.isAssigned).length} unassigned)
                </span>
              </p>
            </div>

            <div className="rounded border border-surface-border bg-surface/50 p-2.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Ambulances Ready</span>
              <p data-testid="res-amb-summary" className="mt-0.5 font-mono text-lg font-bold text-emerald-300">
                {resources.ambulances.filter((a) => a.status === "AVAILABLE").length}
                <span className="text-xs font-normal text-slate-400"> / {resources.ambulances.length} ready</span>
              </p>
            </div>

            <div className="rounded border border-surface-border bg-surface/50 p-2.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">O-Neg Blood Reserves</span>
              <p data-testid="res-blood-summary" className="mt-0.5 font-mono text-lg font-bold text-red-300">
                {resources.bloodInventory.find((b) => b.bloodType === "O_NEG")?.unitsAvailable ?? "—"}
                <span className="text-xs font-normal text-slate-400"> units</span>
              </p>
            </div>
          </div>

          {/* Asset Category Tabs */}
          <div className="flex border-b border-surface-border text-xs">
            <button
              type="button"
              data-testid="tab-theatres"
              onClick={() => setActiveTab("theatres")}
              className={`border-b-2 px-3 py-2 font-mono uppercase tracking-wider transition-colors ${
                activeTab === "theatres"
                  ? "border-sky-400 text-sky-300 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Operating Theatres ({resources.operatingRooms.length})
            </button>
            <button
              type="button"
              data-testid="tab-staff"
              onClick={() => setActiveTab("staff")}
              className={`border-b-2 px-3 py-2 font-mono uppercase tracking-wider transition-colors ${
                activeTab === "staff"
                  ? "border-sky-400 text-sky-300 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Staff Roster ({resources.staff.length})
            </button>
            <button
              type="button"
              data-testid="tab-blood"
              onClick={() => setActiveTab("blood")}
              className={`border-b-2 px-3 py-2 font-mono uppercase tracking-wider transition-colors ${
                activeTab === "blood"
                  ? "border-sky-400 text-sky-300 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Blood Bank ({resources.bloodInventory.length})
            </button>
            <button
              type="button"
              data-testid="tab-ambulances"
              onClick={() => setActiveTab("ambulances")}
              className={`border-b-2 px-3 py-2 font-mono uppercase tracking-wider transition-colors ${
                activeTab === "ambulances"
                  ? "border-sky-400 text-sky-300 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Ambulances ({resources.ambulances.length})
            </button>
            <button
              type="button"
              data-testid="tab-beds"
              onClick={() => setActiveTab("beds")}
              className={`border-b-2 px-3 py-2 font-mono uppercase tracking-wider transition-colors ${
                activeTab === "beds"
                  ? "border-sky-400 text-sky-300 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Beds ({resources.beds.length})
            </button>
          </div>

          {/* Theatres Tab */}
          {activeTab === "theatres" ? (
            <div data-testid="theatres-content" className="space-y-2">
              <ul className="space-y-2" data-testid="operating-room-list">
                {resources.operatingRooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-surface-border bg-surface/40 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-mono text-sm font-bold text-slate-100">{room.roomNumber}</span>
                      <p className="text-slate-400">
                        {room.scheduledProcedure ?? "No procedure currently scheduled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {room.isEmergencyCleared ? (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                          CLEARED FOR TRAUMA
                        </span>
                      ) : null}
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-xs uppercase ${
                          room.status === "OPEN"
                            ? "border-emerald-500/40 text-emerald-300"
                            : room.status === "IN_USE"
                            ? "border-amber-500/40 text-amber-300"
                            : "border-slate-500 text-slate-300"
                        }`}
                      >
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
              <ul className="space-y-1.5" data-testid="staff-list">
                {resources.staff.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-surface-border bg-surface/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-100">{member.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-400">({member.department})</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="rounded bg-surface-raised px-2 py-0.5 text-slate-300">{member.role}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold ${
                          member.isOnDuty ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {member.isOnDuty ? "ON DUTY" : "OFF DUTY"}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          member.isAssigned ? "bg-purple-500/20 text-purple-300" : "bg-sky-500/15 text-sky-300"
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
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="blood-list">
                {resources.bloodInventory.map((unit) => {
                  const isLow = unit.unitsAvailable <= unit.minimumThreshold;
                  return (
                    <li
                      key={unit.id}
                      className="rounded border border-surface-border bg-surface/40 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-slate-100">
                          {unit.bloodType.replace("_", " ")}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                            isLow ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {isLow ? "CRITICAL THRESHOLD" : "ADEQUATE"}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xl font-bold text-slate-100">
                        {unit.unitsAvailable} <span className="text-xs font-normal text-slate-400">units</span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">Min Threshold: {unit.minimumThreshold} units</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* Ambulances Tab */}
          {activeTab === "ambulances" ? (
            <div data-testid="ambulances-content" className="space-y-2">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="ambulance-list">
                {resources.ambulances.map((amb) => (
                  <li
                    key={amb.id}
                    className="flex items-center justify-between rounded border border-surface-border bg-surface/40 p-3 text-xs"
                  >
                    <div>
                      <span className="font-mono text-sm font-bold text-slate-100">{amb.vehicleCode}</span>
                      <p className="mt-0.5 text-slate-400">
                        Crew: {amb.crewAssigned ? "Assigned & In-Cab" : "No crew"}
                      </p>
                    </div>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-xs uppercase ${
                        amb.status === "AVAILABLE"
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-slate-500 text-slate-400"
                      }`}
                    >
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
              <div className="max-h-64 overflow-y-auto rounded border border-surface-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-surface-border bg-surface-raised font-mono uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Bed Code</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border bg-surface/40 font-mono text-slate-300">
                    {resources.beds.map((bed) => {
                      const isFree = !bed.isOccupied && !bed.isReserved;
                      return (
                        <tr key={bed.id} className="hover:bg-surface/70">
                          <td className="px-3 py-2 font-bold text-slate-100">{bed.bedCode}</td>
                          <td className="px-3 py-2 text-slate-400">{bed.bedType}</td>
                          <td className="px-3 py-2 font-sans text-slate-300">{bed.department}</td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold ${
                                isFree
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : bed.isReserved
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-slate-700 text-slate-300"
                              }`}
                            >
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

          <div className="text-right font-mono text-[11px] text-slate-500">
            Last Inventory Snapshot: {formatRelativeAge(resources.lastUpdated)}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
