import { formatPercent, formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { EmergencyCode, HospitalCapacity } from "@/types/domain";
import { ConnectionBadge, connectionStateOf, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

const CODE_STYLES: Record<EmergencyCode, string> = {
  NORMAL: "border-emerald-300 bg-emerald-50 text-emerald-700 font-bold",
  CODE_YELLOW: "border-amber-300 bg-amber-50 text-amber-700 font-bold",
  CODE_ORANGE: "border-orange-300 bg-orange-50 text-orange-700 font-bold",
  CODE_RED: "border-red-300 bg-red-50 text-red-700 font-bold",
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
          <p className="text-xs text-slate-500">
            Capacity metrics could not be loaded from backend. Figures are withheld.
          </p>
        </div>
      ) : null}

      {capacity ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Facility</span>
              <p data-testid="hospital-facility-name" className="text-base sm:text-lg font-bold text-stone-900">
                {capacity.hospitalName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Emergency Status: </span>
                <span
                  data-testid="operational-code-badge"
                  className={`inline-block rounded-md border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider ${
                    CODE_STYLES[capacity.operationalCode] ?? "border-stone-200 text-stone-700"
                  }`}
                >
                  {capacity.operationalCode}
                </span>
              </div>
              <div className="font-mono text-xs text-stone-600 font-medium">
                Updated: <span className="text-stone-900 font-bold">{formatRelativeAge(capacity.lastUpdated)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {/* ED Capacity Card */}
            <div
              data-testid="card-ed-capacity"
              className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-[#d8d0c0]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-600">
                  Emergency Dept (ED)
                </span>
                <span
                  data-testid="ed-available-stat"
                  className="font-mono text-xl sm:text-2xl font-black text-emerald-700"
                >
                  {capacity.emergencyBedsAvailable}
                  <span className="text-xs sm:text-sm font-medium text-stone-600"> / {capacity.emergencyBedsTotal}</span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-[13px] text-stone-600 font-medium">Available emergency beds</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs sm:text-[13px] font-mono text-stone-600">
                  <span>Occupancy</span>
                  <span data-testid="ed-occupancy-rate" className="font-bold text-stone-800">
                    {formatPercent(
                      capacity.emergencyBedsTotal - capacity.emergencyBedsAvailable,
                      capacity.emergencyBedsTotal,
                    ) ?? "—"}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-full bg-[#ede7dc] border border-[#e5dfd2]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 shadow-[0_0_8px_rgba(2,132,199,0.3)] transition-all"
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
              className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-[#d8d0c0]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-600">
                  Intensive Care (ICU)
                </span>
                <span
                  data-testid="icu-available-stat"
                  className="font-mono text-xl sm:text-2xl font-black text-indigo-700"
                >
                  {capacity.icuBedsAvailable}
                  <span className="text-xs sm:text-sm font-medium text-stone-600"> / {capacity.icuBedsTotal}</span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-[13px] text-stone-600 font-medium">Available critical care beds</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs sm:text-[13px] font-mono text-stone-600">
                  <span>Occupancy</span>
                  <span className="font-bold text-stone-800">
                    {formatPercent(
                      capacity.icuBedsTotal - capacity.icuBedsAvailable,
                      capacity.icuBedsTotal,
                    ) ?? "—"}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-full bg-[#ede7dc] border border-[#e5dfd2]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-500 shadow-[0_0_8px_rgba(79,70,229,0.3)] transition-all"
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
              className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-[#d8d0c0]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-600">
                  Operating Rooms (OR)
                </span>
                <span
                  data-testid="or-available-stat"
                  className="font-mono text-xl sm:text-2xl font-black text-amber-700"
                >
                  {capacity.operatingRoomsAvailable}
                  <span className="text-xs sm:text-sm font-medium text-stone-600"> / {capacity.operatingRoomsTotal}</span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-[13px] text-stone-600 font-medium">Staffed and open surgical suites</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs sm:text-[13px] font-mono text-stone-600">
                  <span>Elective / In-Use</span>
                  <span className="font-bold text-stone-800">{capacity.operatingRoomsTotal - capacity.operatingRoomsAvailable} suites</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-full bg-[#ede7dc] border border-[#e5dfd2]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)] transition-all"
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
            <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm hover:border-[#d8d0c0] transition-colors">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Doctors Available</span>
              <p data-testid="doctors-available-stat" className="mt-1 font-mono text-xl sm:text-2xl font-black text-stone-900">
                {capacity.doctorsAvailable}
              </p>
            </div>

            {/* Nurses Available */}
            <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm hover:border-[#d8d0c0] transition-colors">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Nurses Available</span>
              <p data-testid="nurses-available-stat" className="mt-1 font-mono text-xl sm:text-2xl font-black text-stone-900">
                {capacity.nursesAvailable}
              </p>
            </div>

            {/* Ambulances Available */}
            <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm hover:border-[#d8d0c0] transition-colors">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Ambulances Ready</span>
              <p data-testid="ambulances-available-stat" className="mt-1 font-mono text-xl sm:text-2xl font-black text-stone-900">
                {capacity.ambulancesAvailable}
              </p>
            </div>

            {/* Blood Units Available */}
            <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm hover:border-[#d8d0c0] transition-colors">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Blood Units (Total)</span>
              <p data-testid="blood-units-stat" className="mt-1 font-mono text-xl sm:text-2xl font-black text-stone-900">
                {capacity.bloodUnitsAvailable}
              </p>
            </div>

            {/* Active Incidents */}
            <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-sm hover:border-[#d8d0c0] transition-colors">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Active Incidents Count</span>
              <p data-testid="active-incidents-stat" className="mt-1 font-mono text-xl sm:text-2xl font-black text-stone-900">
                {capacity.activeIncidentCount}
              </p>
            </div>
          </div>

          {capacity.departments.length > 0 ? (
            <div>
              <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700">
                Departmental Status & Capacity
              </h3>
              <div className="mt-2.5 overflow-x-auto rounded-xl border border-[#e5dfd2] shadow-sm">
                <table className="w-full text-left text-xs sm:text-sm" data-testid="department-list">
                  <thead className="border-b border-[#e5dfd2] bg-[#f7f3ea] font-mono text-xs font-bold uppercase tracking-wider text-stone-700">
                    <tr>
                      <th className="px-3.5 py-3">Department</th>
                      <th className="px-3.5 py-3">Type</th>
                      <th className="px-3.5 py-3 text-right">Available Beds</th>
                      <th className="px-3.5 py-3 text-right">Total Beds</th>
                      <th className="px-3.5 py-3 text-right">Staff On Duty</th>
                      <th className="px-3.5 py-3">Status Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece5d8] bg-[#fffdf9] font-mono text-stone-800">
                    {capacity.departments.map((dept) => (
                      <tr key={`${dept.departmentType}-${dept.name}`} className="hover:bg-[#fbf8f0] transition-colors">
                        <td className="px-3.5 py-3 font-sans font-bold text-stone-900">{dept.name}</td>
                        <td className="px-3.5 py-3 text-stone-600">{dept.departmentType}</td>
                        <td className="px-3.5 py-3 text-right text-emerald-700 font-bold">{dept.availableBeds}</td>
                        <td className="px-3.5 py-3 text-right text-stone-600">{dept.totalBeds}</td>
                        <td className="px-3.5 py-3 text-right text-sky-700 font-bold">{dept.staffOnDuty}</td>
                        <td className="px-3.5 py-3 font-sans text-xs sm:text-[13px] text-stone-600">{dept.statusNote ?? "—"}</td>
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
