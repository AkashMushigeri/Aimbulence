import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { AuditEvent } from "@/types/domain";
import {
  ConnectionBadge,
  connectionStateOf,
  EmptyState,
  ErrorNotice,
  LoadingState,
  Panel,
  RefreshButton,
  SafetyTierBadge,
} from "@/components/common";

export type AuditEventResultStatus = "SUCCESS" | "ERROR" | "PENDING" | "VERIFIED";

export type AuditLifecyclePhase =
  | "RUNBOOK_STEP"
  | "ACTION"
  | "APPROVAL"
  | "EXECUTION"
  | "VERIFICATION"
  | "AUDIT";

export function determineEventStatus(event: AuditEvent): {
  status: AuditEventResultStatus;
  errorMessage?: string;
} {
  const details = (event.details ?? {}) as Record<string, unknown>;

  // ONLY show VERIFIED when the backend explicitly reports verification
  if (details.verified === true || details.verification === "VERIFIED" || details.status === "VERIFIED") {
    return { status: "VERIFIED" };
  }

  // Check for explicit error flags
  if (
    details.error ||
    details.status === "ERROR" ||
    details.status === "FAILED" ||
    details.status === "VERIFICATION_FAILED" ||
    event.eventType.endsWith("_FAILED") ||
    event.eventType.endsWith("_ERROR")
  ) {
    const msg =
      typeof details.error === "string"
        ? details.error
        : typeof details.reason === "string"
        ? details.reason
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

export function determineLifecyclePhase(event: AuditEvent): AuditLifecyclePhase {
  const type = event.eventType.toUpperCase();
  const details = (event.details ?? {}) as Record<string, unknown>;

  if (type.includes("VERIF") || details.verification !== undefined || details.verified !== undefined) {
    return "VERIFICATION";
  }
  if (type.includes("CHECKPOINT") || type.includes("APPROVAL") || type.includes("AUTHORIZ") || details.decision !== undefined) {
    return "APPROVAL";
  }
  if (type.includes("STEP") || details.step_id !== undefined || details.step_number !== undefined) {
    return "RUNBOOK_STEP";
  }
  if (type.includes("MUTAT") || type.includes("PREEMPT") || type.includes("EXECUTE") || details.execution !== undefined) {
    return "EXECUTION";
  }
  if (type.includes("ACTION") || type.includes("TOOL") || event.actionName || details.tool_name) {
    return "ACTION";
  }
  return "AUDIT";
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
            <div className="hidden font-mono text-[10px] text-slate-500 md:block">
              RUNBOOK STEP → ACTION → APPROVAL → EXECUTION → VERIFICATION → AUDIT
            </div>
          </div>

          <ol className="space-y-3" data-testid="audit-list">
            {events.map((event) => {
              const { status, errorMessage } = determineEventStatus(event);
              const phase = determineLifecyclePhase(event);
              const details = (event.details ?? {}) as Record<string, unknown>;

              const runbookId =
                (details.runbook_id as string) ??
                (details.runbookId as string) ??
                (typeof details.action_id === "string" && details.action_id.startsWith("MCI-")
                  ? "MCI-01"
                  : undefined);

              const step =
                details.step_number !== undefined
                  ? `Step ${details.step_number}`
                  : (details.step_id as string) ?? (details.step as string) ?? undefined;

              const actionTool = event.actionName ?? (details.tool_name as string) ?? undefined;

              const approvalDecision = details.decision
                ? `Decision: ${String(details.decision)}${
                    details.decision_by ? ` by ${String(details.decision_by)}` : ""
                  }`
                : undefined;

              const verificationSummary =
                details.verification && typeof details.verification === "object"
                  ? (details.verification as { status?: string; verified?: boolean }).status ??
                    ((details.verification as { verified?: boolean }).verified ? "VERIFIED" : "UNVERIFIED")
                  : details.verified !== undefined
                  ? details.verified
                    ? "VERIFIED ON DISK"
                    : "UNVERIFIED"
                  : undefined;

              const escalation =
                event.eventType.includes("ESCALAT") || details.escalation
                  ? "ESCALATED TO HIGHER AUTHORITY"
                  : undefined;

              return (
                <li
                  key={event.id}
                  data-testid={`audit-event-${event.id}`}
                  className="rounded-lg border border-surface-border bg-surface/50 p-3.5 transition-colors hover:border-slate-600"
                >
                  {/* Event Header with Sequence Phase */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/40 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Lifecycle Sequence Pill */}
                      <span
                        data-testid={`audit-phase-${event.id}`}
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                          phase === "VERIFICATION"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                            : phase === "APPROVAL"
                            ? "bg-red-950 text-red-300 border border-red-500/40"
                            : phase === "EXECUTION"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                            : phase === "RUNBOOK_STEP"
                            ? "bg-blue-950 text-blue-300 border border-blue-500/40"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {phase.replace(/_/g, " ")}
                      </span>

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

                  {/* Operational Context Line */}
                  <div className="mt-2 grid gap-1.5 text-xs text-slate-300 sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500">Action/Tool: </span>
                      <span className="font-mono font-medium text-slate-200">
                        {actionTool ?? "Direct Log Entry"}
                      </span>
                    </div>

                    <div className="font-mono text-slate-400">
                      Actor: <span className="text-slate-200">{event.performedBy}</span>
                      {event.incidentId ? (
                        <span className="ml-2 text-sky-400">({event.incidentId})</span>
                      ) : null}
                    </div>

                    {runbookId || step ? (
                      <div className="font-mono text-[11px] text-slate-400">
                        Runbook: <strong className="text-slate-200">{runbookId ?? "MCI-01"}</strong>
                        {step ? <span className="ml-1 text-slate-300">({step})</span> : null}
                      </div>
                    ) : null}

                    {details.affected_resource || details.entity_id ? (
                      <div className="font-mono text-[11px] text-slate-400">
                        Target Resource:{" "}
                        <strong className="text-amber-300">
                          {String(details.affected_resource ?? details.entity_id)}
                        </strong>
                      </div>
                    ) : null}
                  </div>

                  {/* Decision or Approval Details */}
                  {approvalDecision ? (
                    <div className="mt-2 rounded bg-red-950/20 px-2.5 py-1 text-xs text-red-200 border border-red-500/30 font-mono">
                      {approvalDecision}
                      {details.reason ? <span className="ml-1 text-slate-300">— {String(details.reason)}</span> : null}
                    </div>
                  ) : null}

                  {/* Verification Outcome */}
                  {verificationSummary ? (
                    <div className="mt-1.5 flex items-center gap-2 rounded bg-emerald-950/20 px-2.5 py-1 text-xs text-emerald-200 border border-emerald-500/30 font-mono">
                      <span className="text-[10px] uppercase font-bold text-emerald-400">Verified Evidence:</span>
                      <span>{verificationSummary}</span>
                      {details.actual_value !== undefined ? (
                        <span className="text-slate-400">
                          (disk: {String(details.actual_value)})
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Escalation Callout */}
                  {escalation ? (
                    <div className="mt-2 rounded border border-purple-500/40 bg-purple-950/30 px-2.5 py-1 font-mono text-xs font-bold text-purple-200">
                      ⚠ {escalation}
                    </div>
                  ) : null}

                  {/* Error Callout */}
                  {errorMessage ? (
                    <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-xs text-red-300">
                      Error: {errorMessage}
                    </p>
                  ) : null}

                  {/* Generic message if not error */}
                  {details.message && typeof details.message === "string" && !errorMessage ? (
                    <p className="mt-1.5 text-xs text-slate-400">{details.message}</p>
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
