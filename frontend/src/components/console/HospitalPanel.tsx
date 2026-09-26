import { formatPercent, formatRelativeAge } from "@/lib/format";
import { connectionStateOf, ConnectionBadge, ErrorNotice, Panel, RefreshButton, StatTile } from "../common";
import type { Loadable } from "@/lib/loadState";
import type { HospitalCapacity } from "@/types/domain";

import { Field } from "./HealthPanel";

/** HOSPITAL STATUS — real `GET /api/hospital/status` result. */
export function HospitalPanel({ state }: { state: Loadable<unknown> }) {
  return (
    <Panel
      title="Hospital status"
      description="Aggregate operational capacity from GET /api/hospital/status."
      action={<ConnectionBadge state={connectionStateOf(state)} />}
    >
      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Hospital status unavailable" />
          <RefreshButton target="hospital" />
        </div>
      ) : null}

      {state.status === "available" ? <HospitalDetail capacity={state.data as HospitalCapacity} /> : null}
    </Panel>
  );
}

function HospitalDetail({ capacity }: { capacity: HospitalCapacity }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <Field label="Facility" value={capacity.hospitalName} />
        <Field label="Operational code" value={capacity.operationalCode} testId="operational-code" />
        <Field
          label="Snapshot age"
          value={formatRelativeAge(capacity.lastUpdated)}
          testId="hospital-snapshot-age"
        />
      </dl>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="ED beds"
          value={`${capacity.emergencyBedsAvailable}/${capacity.emergencyBedsTotal}`}
          hint="available / total"
        />
        <StatTile
          label="ICU beds"
          value={`${capacity.icuBedsAvailable}/${capacity.icuBedsTotal}`}
          hint="available / total"
        />
        <StatTile
          label="Operating rooms"
          value={`${capacity.operatingRoomsAvailable}/${capacity.operatingRoomsTotal}`}
          hint="staffed and open / total"
        />
        <StatTile
          label="ED occupancy"
          value={
            formatPercent(
              capacity.emergencyBedsTotal - capacity.emergencyBedsAvailable,
              capacity.emergencyBedsTotal,
            ) ?? "—"
          }
          hint="derived from totals"
        />
        <StatTile label="Doctors available" value={capacity.doctorsAvailable} />
        <StatTile label="Nurses available" value={capacity.nursesAvailable} />
        <StatTile label="Ambulances available" value={capacity.ambulancesAvailable} />
        <StatTile label="Blood units available" value={capacity.bloodUnitsAvailable} />
        <StatTile label="Active incidents" value={capacity.activeIncidentCount} />
      </div>

      {capacity.departments.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-slate-400">Departments</h3>
          <ul className="mt-2 space-y-2" data-testid="department-list">
            {capacity.departments.map((department) => (
              <li
                key={`${department.departmentType}:${department.name}`}
                className="rounded border border-surface-border bg-surface/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-slate-200">{department.name}</span>
                  <span className="font-mono text-xs text-slate-400">
                    {department.availableBeds}/{department.totalBeds} beds · {department.staffOnDuty} on
                    duty
                  </span>
                </div>
                {department.statusNote ? (
                  <p className="mt-1 text-xs text-slate-500">{department.statusNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
