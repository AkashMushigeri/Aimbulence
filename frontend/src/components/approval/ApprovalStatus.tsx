import { SafetyTierBadge } from "@/components/common";

export type ApprovalLifecycleState =
  | "PAUSED_WAITING"
  | "SUBMITTING"
  | "CONFIRMED_APPROVED"
  | "CONFIRMED_REJECTED"
  | "VERIFIED_EXECUTED"
  | "ERROR";

export interface ApprovalStatusProps {
  readonly state: ApprovalLifecycleState;
  readonly message?: string;
}

export function ApprovalStatus({ state, message }: ApprovalStatusProps) {
  return (
    <div
      data-testid="approval-status-banner"
      aria-live="polite"
      className="space-y-2 rounded-lg border border-red-500/50 bg-red-950/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 animate-pulse rounded-full bg-red-500"
            aria-hidden="true"
          />
          <span
            data-testid="agent-pause-label"
            className="font-mono text-sm font-bold tracking-wider text-red-300"
          >
            AGENT PAUSED
          </span>
        </div>
        <SafetyTierBadge tier="RED" />
      </div>

      <div className="mt-1">
        <p
          data-testid="approval-status-headline"
          className="font-mono text-base font-extrabold uppercase tracking-wide text-red-200"
        >
          {state === "SUBMITTING"
            ? "DECISION SUBMITTED — WAITING FOR BACKEND"
            : state === "CONFIRMED_APPROVED"
            ? "BACKEND CONFIRMED — CONFLICT CLEARED"
            : state === "VERIFIED_EXECUTED"
            ? "BACKEND CONFIRMED — EXECUTION VERIFIED"
            : state === "CONFIRMED_REJECTED"
            ? "HUMAN DECISION RECORDED — ACTION REJECTED"
            : state === "ERROR"
            ? "AGENT PAUSED — SUBMISSION ERROR"
            : "WAITING FOR HUMAN AUTHORIZATION"}
        </p>
        <p className="mt-1 text-xs text-slate-300">
          {message ||
            "The TrueForge agent loop has halted execution at a consequential operating room preemption checkpoint. No consequential action has been authorized yet."}
        </p>
      </div>
    </div>
  );
}
