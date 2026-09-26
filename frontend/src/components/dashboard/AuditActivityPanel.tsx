import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { AuditEvent } from "@/types/domain";
import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, LoadingState, Panel, RefreshButton, SafetyTierBadge } from "@/components/common";

export type AuditEventResultStatus = "SUCCESS" | "ERROR" | "PENDING" | "VERIFIED";

export function determineEventStatus(event: AuditEvent): {
  status: AuditEventResultStatus;
  errorMessage?: string;
} {
  const details = event.details ?? {};

  // ONLY show VERIFIED when the backend explicitly reports verification
  if (details.verified === true || details.verification === "VERIFIED") {
    return { status: "VERIFIED" };
  }

  // Check for explicit error flags
  if (
    details.error ||
    details.status === "ERROR" ||
    details.status === "FAILED" ||
    event.eventType.endsWith("_FAILED") ||
    event.eventType.endsWith("_ERROR")
  ) {
    const msg =
      typeof details.error === "string"
        ? details.error
        : typeof details.message === "string"
        ? details.message
        : "Operational error recorded.";
    return { status: "ERROR", errorMessage: msg };
  }

  // Check for pending states
  if (details.status === "PENDING" || event.eventType.endsWith("_PENDING")) {
    return { status: "PENDING" };
  }

  return { status: "SUCCESS" };
}

const RESULT_STYLES: Record<AuditEventResultStatus, string> = {
  VERIFIED: "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 font-bold",
  SUCCESS: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  PENDING: "border-amber-500/50 bg-amber-500/15 text-amber-300",
  ERROR: "border-red-500/60 bg-red-500/20 text-red-200 font-bold",
};

export interface AuditActivityPanelProps {
  readonly state: Loadable<unknown>;
}

export function AuditActivityPanel({ state }: AuditActivityPanelProps) {
  const events = state.status === "available" ? (state.data as AuditEvent[]) : [];

  return (
    <Panel
      title="Audit & Activity Trail"
      description="Immutable operational activity records from GET /api/audit-log."
      action={
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionStateOf(state)} />
          <RefreshButton target="audit" />
        </div>
      }
    >
      {state.status === "loading" ? <LoadingState label="audit log records" /> : null}

      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Audit trail unavailable" />
          <p className="text-xs text-slate-400">
            Backend audit records cannot be loaded. No records are fabricated.
          </p>
        </div>
      ) : null}

      {state.status === "available" && events.length === 0 ? (
        <EmptyState title="No Audit Records Returned">
          <p className="text-slate-400">The operational backend reported an empty audit log.</p>
        </EmptyState>
      ) : null}

      {state.status === "available" && events.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">
              Total Records: <strong className="text-slate-200">{events.length}</strong> (chronological order)
            </span>
          </div>

          <ol className="space-y-2.5" data-testid="audit-list">
            {events.map((event) => {
              const { status, errorMessage } = determineEventStatus(event);
              return (
                <li
                  key={event.id}
                  data-testid={`audit-event-${event.id}`}
                  className="rounded-lg border border-surface-border bg-surface/50 p-3.5 transition-colors hover:border-slate-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/40 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-100">{event.eventType}</span>
                      {event.tier ? <SafetyTierBadge tier={event.tier} /> : null}
                      <span
                        data-testid={`audit-status-${event.id}`}
                        className={`rounded border px-1.5 py-0.2 font-mono text-[10px] uppercase tracking-wide ${
                          RESULT_STYLES[status]
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="font-mono text-[11px] text-slate-400">
                      {formatRelativeAge(event.timestamp)} · <span className="text-slate-500">{event.timestamp}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500">Action: </span>
                      <span className="font-mono font-medium text-slate-200">
                        {event.actionName ?? "Direct Log Entry"}
                      </span>
                    </div>

                    <div className="font-mono text-slate-400">
                      Actor: <span className="text-slate-200">{event.performedBy}</span>
                      {event.incidentId ? (
                        <span className="ml-2 text-sky-400">({event.incidentId})</span>
                      ) : null}
                    </div>
                  </div>

                  {errorMessage ? (
                    <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-xs text-red-300">
                      Error: {errorMessage}
                    </p>
                  ) : null}

                  {event.details && typeof event.details.message === "string" && !errorMessage ? (
                    <p className="mt-1.5 text-xs text-slate-400">{event.details.message}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </Panel>
  );
}
