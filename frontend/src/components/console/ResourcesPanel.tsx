import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { ResourceStatus, StaffAvailability } from "@/types/domain";

import { ConnectionBadge, connectionStateOf, ErrorNotice, Panel, RefreshButton, StatTile } from "../common";

/** RESOURCES — real `GET /api/resources` result, plus the derived staff aggregate. */
export function ResourcesPanel({
  state,
  staffAvailability,
}: {
  state: Loadable<unknown>;
  staffAvailability?: StaffAvailability;
}) {
  return (
    <Panel
      title="Resources"
      description="Beds, operating theatres, staff, vehicles, and blood inventory from GET /api/resources."
      action={<ConnectionBadge state={connectionStateOf(state)} />}
    >
      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Resource inventory unavailable" />
          <RefreshButton target="resources" />
        </div>
      ) : null}

      {state.status === "available" ? (
        <ResourceDetail resources={state.data as ResourceStatus} staff={staffAvailability} />
      ) : null}
    </Panel>
  );
}

function ResourceDetail({
  resources,
  staff,
}: {
  resources: ResourceStatus;
  staff?: StaffAvailability;
}) {
  const openOperatingRooms = resources.operatingRooms.filter((room) => room.status === "OPEN").length;
  const availableBeds = resources.beds.filter((bed) => !bed.isOccupied && !bed.isReserved).length;
  const oNegative = resources.bloodInventory.find((unit) => unit.bloodType === "O_NEG");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Beds free" value={availableBeds} hint={`of ${resources.beds.length} tracked`} />
        <StatTile
          label="Operating rooms open"
          value={openOperatingRooms}
          hint={`of ${resources.operatingRooms.length} tracked`}
        />
        <StatTile
          label="Staff on duty"
          value={staff?.totalOnDuty ?? resources.staff.filter((member) => member.isOnDuty).length}
          hint="derived from roster"
        />
        <StatTile
          label="Staff unassigned"
          value={staff?.available ?? "—"}
          hint="available for dispatch"
        />
        <StatTile
          label="Ambulances available"
          value={resources.ambulances.filter((a) => a.status === "AVAILABLE").length}
          hint={`of ${resources.ambulances.length} tracked`}
        />
        <StatTile
          label="O-negative units"
          value={oNegative?.unitsAvailable ?? "—"}
          hint={oNegative ? `minimum threshold ${oNegative.minimumThreshold}` : "not stocked"}
        />
        <StatTile label="Snapshot age" value={formatRelativeAge(resources.lastUpdated)} />
      </div>

      <ResourceTable
        title="Operating theatres"
        testId="operating-room-list"
        rows={resources.operatingRooms.map((room) => ({
          key: room.id,
          primary: room.roomNumber,
          secondary: room.scheduledProcedure ?? "no scheduled procedure",
          meta: `${room.status}${room.isEmergencyCleared ? " · emergency cleared" : ""}`,
        }))}
      />

      <ResourceTable
        title="Staff roster"
        testId="staff-list"
        rows={resources.staff.map((member) => ({
          key: member.id,
          primary: member.name,
          secondary: member.department,
          meta: `${member.role}${member.isOnDuty ? "" : " · off duty"}${member.isAssigned ? " · assigned" : ""}`,
        }))}
      />

      <ResourceTable
        title="Blood inventory"
        testId="blood-list"
        rows={resources.bloodInventory.map((unit) => ({
          key: unit.id,
          primary: unit.bloodType.replace("_", " "),
          secondary: `minimum threshold ${unit.minimumThreshold}`,
          meta: `${unit.unitsAvailable} units`,
        }))}
      />
    </div>
  );
}

interface ResourceRow {
  readonly key: string;
  readonly primary: string;
  readonly secondary: string;
  readonly meta: string;
}

function ResourceTable({
  title,
  testId,
  rows,
}: {
  title: string;
  testId: string;
  rows: readonly ResourceRow[];
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-slate-400">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No records reported by the backend.</p>
      ) : (
        <ul className="mt-2 space-y-1" data-testid={testId}>
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-surface-border bg-surface/40 px-3 py-1.5 text-sm"
            >
              <span className="text-slate-200">{row.primary}</span>
              <span className="text-xs text-slate-500">{row.secondary}</span>
              <span className="font-mono text-xs text-slate-400">{row.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
