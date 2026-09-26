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
  VERIFIED: "border-emerald-300 bg-emerald-50 text-emerald-800 font-extrabold",
  SUCCESS: "border-sky-300 bg-sky-50 text-sky-800 font-bold",
  PENDING: "border-amber-300 bg-amber-50 text-amber-800 font-bold",
  ERROR: "border-red-300 bg-red-50 text-red-800 font-extrabold",
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
          <p className="text-xs sm:text-sm text-stone-600">
            Backend audit records cannot be loaded. No records are fabricated.
          </p>
        </div>
      ) : null}

      {state.status === "available" && events.length === 0 ? (
        <EmptyState title="No Audit Records Returned">
          <p className="text-stone-600 text-xs sm:text-sm">The operational backend reported an empty audit log.</p>
        </EmptyState>
      ) : null}

      {state.status === "available" && events.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-[13px] text-stone-600">
            <span className="font-mono">
              Total Records: <strong className="text-stone-900 font-bold">{events.length}</strong> (chronological order)
            </span>
            <div className="hidden font-mono text-xs text-stone-500 md:block font-semibold">
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
                  className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-4 sm:p-5 transition-colors hover:border-[#d8d0c0] shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece5d8] pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Lifecycle Sequence Pill */}
                      <span
                        data-testid={`audit-phase-${event.id}`}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          phase === "VERIFICATION"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                            : phase === "APPROVAL"
                            ? "bg-red-50 text-red-800 border border-red-300"
                            : phase === "EXECUTION"
                            ? "bg-amber-50 text-amber-800 border border-amber-300"
                            : phase === "RUNBOOK_STEP"
                            ? "bg-sky-50 text-sky-800 border border-sky-300"
                            : "bg-[#f4efe4] text-stone-700 border border-[#e5dfd2]"
                        }`}
                      >
                        {phase === "VERIFICATION" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                        {phase === "APPROVAL" && <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />}
                        {phase.replace(/_/g, " ")}
                      </span>

                      <span className="font-mono text-xs sm:text-sm font-bold text-stone-900">{event.eventType}</span>
                      {event.tier ? <SafetyTierBadge tier={event.tier} /> : null}
                      <span
                        data-testid={`audit-status-${event.id}`}
                        className={`rounded border px-2.5 py-0.5 font-mono text-xs uppercase font-extrabold tracking-wide ${
                          RESULT_STYLES[status]
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="font-mono text-xs text-stone-600 font-medium">
                      {formatRelativeAge(event.timestamp)} · <span className="text-stone-500">{event.timestamp}</span>
                    </div>
                  </div>

                  {/* Operational Context Line */}
                  <div className="mt-3 grid gap-2.5 text-xs sm:text-[13px] text-stone-800 sm:grid-cols-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-stone-600 font-mono text-xs font-semibold">Action/Tool: </span>
                      <span className="font-mono font-bold text-sky-800">
                        {actionTool ?? "Direct Log Entry"}
                      </span>
                    </div>

                    <div className="font-mono text-stone-600">
                      Actor: <span className="text-stone-900 font-bold">{event.performedBy}</span>
                      {event.incidentId ? (
                        <span className="ml-2 font-mono text-sky-700 font-semibold">({event.incidentId})</span>
                      ) : null}
                    </div>

                    {runbookId || step ? (
                      <div className="font-mono text-xs text-stone-600">
                        Runbook: <strong className="text-stone-900 font-bold">{runbookId ?? "MCI-01"}</strong>
                        {step ? <span className="ml-1 text-stone-700 font-medium">({step})</span> : null}
                      </div>
                    ) : null}

                    {details.affected_resource || details.entity_id ? (
                      <div className="font-mono text-xs text-stone-600">
                        Target Resource:{" "}
                        <strong className="text-amber-800 font-bold">
                          {String(details.affected_resource ?? details.entity_id)}
                        </strong>
                      </div>
                    ) : null}
                  </div>

                  {/* Decision or Approval Details */}
                  {approvalDecision ? (
                    <div className="mt-3 rounded-xl bg-red-50/80 px-3.5 py-2 text-xs sm:text-[13px] text-red-950 border border-red-300 font-mono shadow-xs">
                      <div className="flex items-center gap-1.5 font-bold text-red-900">
                        <span className="h-2 w-2 rounded-full bg-red-600" />
                        <span>{approvalDecision}</span>
                      </div>
                      {details.reason ? <div className="mt-1 text-stone-700 text-xs pl-3.5">Rationale: {String(details.reason)}</div> : null}
                    </div>
                  ) : null}

                  {/* Verification Outcome */}
                  {verificationSummary ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/80 px-3.5 py-2 text-xs sm:text-[13px] text-emerald-950 border border-emerald-300 font-mono shadow-xs">
                      <span className="inline-flex items-center gap-1 text-xs uppercase font-extrabold text-emerald-900">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        Verified Evidence:
                      </span>
                      <span className="font-bold text-emerald-900">{verificationSummary}</span>
                      {details.actual_value !== undefined ? (
                        <span className="text-stone-600 text-xs">
                          (disk: {String(details.actual_value)})
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Escalation Callout */}
                  {escalation ? (
                    <div className="mt-2.5 rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2 font-mono text-xs sm:text-[13px] font-bold text-purple-900 shadow-xs">
                      ⚠ {escalation}
                    </div>
                  ) : null}

                  {/* Error Callout */}
                  {errorMessage ? (
                    <p className="mt-2.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 font-mono text-xs sm:text-[13px] font-bold text-red-800">
                      Error: {errorMessage}
                    </p>
                  ) : null}

                  {/* Generic message if not error */}
                  {details.message && typeof details.message === "string" && !errorMessage ? (
                    <p className="mt-2 text-xs sm:text-[13px] text-stone-600 font-medium">{details.message}</p>
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
