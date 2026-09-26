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
      className="space-y-2 rounded-2xl border border-red-300 bg-red-50/90 p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600"
            aria-hidden="true"
          />
          <span
            data-testid="agent-pause-label"
            className="font-mono text-xs sm:text-sm font-black tracking-wider text-red-900"
          >
            AGENT PAUSED
          </span>
        </div>
        <SafetyTierBadge tier="RED" />
      </div>

      <div className="mt-1">
        <p
          data-testid="approval-status-headline"
          className="font-mono text-base sm:text-lg font-black uppercase tracking-wide text-red-950"
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
        <p className="mt-1 text-xs sm:text-[13px] text-stone-700 font-medium leading-relaxed">
          {message ||
            "The TrueForge agent loop has halted execution at a consequential operating room preemption checkpoint. No consequential action has been authorized yet."}
        </p>
      </div>
    </div>
  );
}
