import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { AuditEvent } from "@/types/domain";

import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, Panel, RefreshButton, SafetyTierBadge } from "../common";

/** AUDIT — real `GET /api/audit-log` result, newest first as returned. */
export function AuditPanel({ state }: { state: Loadable<unknown> }) {
  return (
    <Panel
      title="Audit trail"
      description="Immutable operational records from GET /api/audit-log."
      action={<ConnectionBadge state={connectionStateOf(state)} />}
    >
      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Audit trail unavailable" />
          <RefreshButton target="audit" />
        </div>
      ) : null}

      {state.status === "available" ? <AuditList events={state.data as AuditEvent[]} /> : null}
    </Panel>
  );
}

function AuditList({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState title="No audit records returned">
        <p>The backend reported an empty audit trail.</p>
      </EmptyState>
    );
  }

  return (
    <ol className="space-y-2" data-testid="audit-list">
      {events.map((event) => (
        <li key={event.id} className="rounded border border-surface-border bg-surface/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-sm text-slate-100">{event.eventType}</span>
            <div className="flex items-center gap-2">
              {event.tier ? <SafetyTierBadge tier={event.tier} /> : null}
              <span className="text-xs text-slate-500">{formatRelativeAge(event.timestamp)}</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {event.actionName ?? "no action recorded"} · performed by {event.performedBy}
            {event.incidentId ? ` · incident ${event.incidentId}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
