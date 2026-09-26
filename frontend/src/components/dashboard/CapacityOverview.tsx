import { formatPercent, formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { EmergencyCode, HospitalCapacity } from "@/types/domain";
import { ConnectionBadge, connectionStateOf, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

const CODE_STYLES: Record<EmergencyCode, string> = {
  NORMAL: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  CODE_YELLOW: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  CODE_ORANGE: "border-orange-500/50 bg-orange-500/15 text-orange-300",
  CODE_RED: "border-red-500/60 bg-red-500/20 text-red-300 font-bold",
};

export interface CapacityOverviewProps {
  readonly state: Loadable<unknown>;
}

export function CapacityOverview({ state }: CapacityOverviewProps) {
  const capacity = state.status === "available" ? (state.data as HospitalCapacity) : undefined;

  return (
    <Panel
      title="Hospital Operational Capacity"
      description="Facility-wide real-time capacity and bed availability from GET /api/hospital/status."
      action={
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionStateOf(state)} />
          <RefreshButton target="hospital" />
        </div>
      }
    >
      {state.status === "loading" ? <LoadingState label="hospital capacity" /> : null}

      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Hospital capacity unavailable" />
          <p className="text-xs text-slate-400">
            Capacity metrics could not be loaded from backend. Figures are withheld.
          </p>
        </div>
      ) : null}

      {capacity ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface/50 p-3.5">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400">Facility</span>
              <p data-testid="hospital-facility-name" className="text-base font-bold text-slate-100">
                {capacity.hospitalName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Emergency Status: </span>
                <span
                  data-testid="operational-code-badge"
                  className={`inline-block rounded border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider ${
                    CODE_STYLES[capacity.operationalCode] ?? "border-slate-500 text-slate-300"
                  }`}
                >
                  {capacity.operationalCode}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-400">
                Updated: <span className="text-slate-200">{formatRelativeAge(capacity.lastUpdated)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* ED Capacity Card */}
            <div
              data-testid="card-ed-capacity"
              className="rounded-lg border border-surface-border bg-surface/70 p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Emergency Dept (ED)
                </span>
                <span
                  data-testid="ed-available-stat"
                  className="font-mono text-xl font-bold text-emerald-300"
                >
                  {capacity.emergencyBedsAvailable}
                  <span className="text-xs font-normal text-slate-400"> / {capacity.emergencyBedsTotal}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Available emergency beds</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Occupancy</span>
                  <span data-testid="ed-occupancy-rate">
                    {formatPercent(
                      capacity.emergencyBedsTotal - capacity.emergencyBedsAvailable,
                      capacity.emergencyBedsTotal,
                    ) ?? "—"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-sky-500"
                    style={{
                      width: `${
                        capacity.emergencyBedsTotal > 0
                          ? Math.min(
                              100,
                              Math.round(
                                ((capacity.emergencyBedsTotal - capacity.emergencyBedsAvailable) /
                                  capacity.emergencyBedsTotal) *
                                  100,
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ICU Capacity Card */}
            <div
              data-testid="card-icu-capacity"
              className="rounded-lg border border-surface-border bg-surface/70 p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Intensive Care (ICU)
                </span>
                <span
                  data-testid="icu-available-stat"
                  className="font-mono text-xl font-bold text-sky-300"
                >
                  {capacity.icuBedsAvailable}
                  <span className="text-xs font-normal text-slate-400"> / {capacity.icuBedsTotal}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Available critical care beds</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Occupancy</span>
                  <span>
                    {formatPercent(
                      capacity.icuBedsTotal - capacity.icuBedsAvailable,
                      capacity.icuBedsTotal,
                    ) ?? "—"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500"
                    style={{
                      width: `${
                        capacity.icuBedsTotal > 0
                          ? Math.min(
                              100,
                              Math.round(
                                ((capacity.icuBedsTotal - capacity.icuBedsAvailable) /
                                  capacity.icuBedsTotal) *
                                  100,
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* OR Operating Rooms Card */}
            <div
              data-testid="card-or-capacity"
              className="rounded-lg border border-surface-border bg-surface/70 p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Operating Rooms (OR)
                </span>
                <span
                  data-testid="or-available-stat"
                  className="font-mono text-xl font-bold text-amber-300"
                >
                  {capacity.operatingRoomsAvailable}
                  <span className="text-xs font-normal text-slate-400"> / {capacity.operatingRoomsTotal}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Staffed and open suites</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Elective / In-Use</span>
                  <span>{capacity.operatingRoomsTotal - capacity.operatingRoomsAvailable} suites</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{
                      width: `${
                        capacity.operatingRoomsTotal > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (capacity.operatingRoomsAvailable / capacity.operatingRoomsTotal) * 100,
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Doctors Available */}
            <div className="rounded border border-surface-border bg-surface/50 p-3">
              <span className="text-xs uppercase tracking-wide text-slate-400">Doctors Available</span>
              <p data-testid="doctors-available-stat" className="mt-1 font-mono text-xl text-slate-100">
                {capacity.doctorsAvailable}
              </p>
            </div>

            {/* Nurses Available */}
            <div className="rounded border border-surface-border bg-surface/50 p-3">
              <span className="text-xs uppercase tracking-wide text-slate-400">Nurses Available</span>
              <p data-testid="nurses-available-stat" className="mt-1 font-mono text-xl text-slate-100">
                {capacity.nursesAvailable}
              </p>
            </div>

            {/* Ambulances Available */}
            <div className="rounded border border-surface-border bg-surface/50 p-3">
              <span className="text-xs uppercase tracking-wide text-slate-400">Ambulances Ready</span>
              <p data-testid="ambulances-available-stat" className="mt-1 font-mono text-xl text-slate-100">
                {capacity.ambulancesAvailable}
              </p>
            </div>

            {/* Blood Units Available */}
            <div className="rounded border border-surface-border bg-surface/50 p-3">
              <span className="text-xs uppercase tracking-wide text-slate-400">Blood Units (Total)</span>
              <p data-testid="blood-units-stat" className="mt-1 font-mono text-xl text-slate-100">
                {capacity.bloodUnitsAvailable}
              </p>
            </div>

            {/* Active Incidents */}
            <div className="rounded border border-surface-border bg-surface/50 p-3">
              <span className="text-xs uppercase tracking-wide text-slate-400">Active Incidents Count</span>
              <p data-testid="active-incidents-stat" className="mt-1 font-mono text-xl text-slate-100">
                {capacity.activeIncidentCount}
              </p>
            </div>
          </div>

          {capacity.departments.length > 0 ? (
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
                Departmental Status & Capacity
              </h3>
              <div className="mt-2 overflow-x-auto rounded border border-surface-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-surface-border bg-surface-raised font-mono uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Available Beds</th>
                      <th className="px-3 py-2 text-right">Total Beds</th>
                      <th className="px-3 py-2 text-right">Staff On Duty</th>
                      <th className="px-3 py-2">Status Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border bg-surface/40 font-mono text-slate-300">
                    {capacity.departments.map((dept) => (
                      <tr key={`${dept.departmentType}-${dept.name}`} className="hover:bg-surface/70">
                        <td className="px-3 py-2 font-sans font-medium text-slate-200">{dept.name}</td>
                        <td className="px-3 py-2 text-slate-400">{dept.departmentType}</td>
                        <td className="px-3 py-2 text-right text-emerald-300 font-bold">{dept.availableBeds}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{dept.totalBeds}</td>
                        <td className="px-3 py-2 text-right text-sky-300">{dept.staffOnDuty}</td>
                        <td className="px-3 py-2 font-sans text-xs text-slate-400">{dept.statusNote ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
