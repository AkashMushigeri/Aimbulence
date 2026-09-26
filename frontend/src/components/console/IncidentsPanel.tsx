import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { Incident } from "@/types/domain";

import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, Panel, RefreshButton } from "../common";
import { Field } from "./HealthPanel";

/** INCIDENTS — real `GET /api/incidents` result. Read-only listing. */
export function IncidentsPanel({ state }: { state: Loadable<unknown> }) {
  return (
    <Panel
      title="Incidents"
      description="Dispatch notifications from GET /api/incidents, newest first."
      action={<ConnectionBadge state={connectionStateOf(state)} />}
    >
      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Incident feed unavailable" />
          <RefreshButton target="incidents" />
        </div>
      ) : null}

      {state.status === "available" ? <IncidentList incidents={state.data as Incident[]} /> : null}
    </Panel>
  );
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <EmptyState title="No incidents reported">
        <p>The backend currently reports no active emergency incidents.</p>
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-2" data-testid="incident-list">
      {incidents.map((incident) => (
        <li key={incident.id} className="rounded border border-surface-border bg-surface/40 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-slate-100">{incident.title}</span>
            <span className="font-mono text-xs text-slate-400">{incident.id}</span>
          </div>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
            <Field label="Type" value={incident.incidentType} />
            <Field label="Severity" value={incident.severity} />
            <Field label="Status" value={incident.status} />
            <Field label="Casualties" value={incident.casualtyCount} />
            <Field label="Location" value={incident.location} />
            <Field label="ETA" value={`${incident.etaMinutes} min`} />
            <Field label="Reported" value={formatRelativeAge(incident.createdAt)} />
          </dl>
        </li>
      ))}
    </ul>
  );
}
