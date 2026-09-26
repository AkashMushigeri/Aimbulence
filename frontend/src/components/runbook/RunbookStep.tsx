import { SafetyTierBadge } from "@/components/common";
import type { RunbookStepDetail } from "@/types/domain";

export interface RunbookStepProps {
  readonly step: RunbookStepDetail;
  readonly isCurrent: boolean;
  readonly isPaused: boolean;
}

export function RunbookStep({ step, isCurrent, isPaused }: RunbookStepProps) {
  const isCheckpointed = step.isApprovalCheckpoint || (step.stepNumber >= 10 && step.stepNumber <= 13);
  const isStepPaused = isCurrent && (isPaused || step.status === "PAUSED");
  const isCompleted = step.status === "COMPLETED";
  const isFailed = step.status === "FAILED";
  const isRunning = isCurrent && step.status === "RUNNING";

  return (
    <div
      data-testid={`runbook-step-${step.stepNumber}`}
      data-step-id={step.stepId}
      data-step-status={step.status}
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${
        isStepPaused
          ? "border-amber-400 bg-amber-50/90 ring-1 ring-amber-300 shadow-md shadow-amber-950/5"
          : isFailed
          ? "border-rose-400 bg-rose-50/90 shadow-md shadow-rose-950/5"
          : isRunning
          ? "border-sky-400 bg-sky-50/90 ring-1 ring-sky-300 shadow-md shadow-sky-950/5"
          : isCompleted
          ? "border-[#e5dfd2] bg-[#fffdf9] hover:border-[#d8d0c0] shadow-xs"
          : "border-[#e5dfd2]/80 bg-[#fbf9f4]/80 opacity-80"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span
            data-testid={`step-number-${step.stepNumber}`}
            className={`flex h-8 w-8 items-center justify-center rounded-xl font-mono text-xs font-black shadow-xs ${
              isStepPaused
                ? "bg-amber-500 text-white shadow-amber-400/30"
                : isCompleted
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : isRunning
                ? "bg-sky-600 text-white animate-pulse shadow-sky-500/40"
                : isFailed
                ? "bg-rose-600 text-white"
                : "bg-[#ede7dc] text-stone-600 border border-[#e5dfd2]"
            }`}
          >
            {step.stepNumber}
          </span>

          <div>
            <h4
              data-testid={`step-title-${step.stepNumber}`}
              className="text-sm sm:text-base font-bold text-stone-900 leading-snug"
            >
              {step.name}
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-600 font-mono">
              <span className="font-semibold text-stone-500">{step.stepId}</span>
              <span className="text-stone-400">•</span>
              <span className="text-stone-500">tool:</span>
              <code className="rounded bg-[#f0eae0] px-2 py-0.5 text-sky-800 font-bold border border-[#e5dfd2]">
                {step.actionTool}
              </code>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Step safety tier badge */}
          <SafetyTierBadge tier={step.safetyCategory} />

          {/* Verification indicator if verified */}
          {Boolean(step.verification) && (
            <span
              data-testid={`step-${step.stepNumber}-verified`}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold uppercase text-emerald-900 shadow-xs"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              <span>✓ VERIFIED</span>
            </span>
          )}

          {/* Step status label */}
          <span
            data-testid={`step-status-${step.stepNumber}`}
            className={`rounded px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider ${
              isCompleted
                ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                : isRunning
                ? "border border-sky-300 bg-sky-50 text-sky-800 animate-pulse"
                : isStepPaused
                ? "border border-amber-300 bg-amber-50 text-amber-800"
                : isFailed
                ? "border border-rose-300 bg-rose-50 text-rose-800"
                : "border border-stone-200 bg-stone-100 text-stone-600"
            }`}
          >
            {step.status}
          </span>
        </div>
      </div>

      {step.description && (
        <p className="mt-2.5 text-xs sm:text-[13px] text-stone-700 leading-relaxed pl-11 font-medium">
          {step.description}
        </p>
      )}

      {/* CRITICAL SAFETY CALLOUT: Step 10-13 or PAUSED state */}
      {isStepPaused && (
        <div
          data-testid="agent-paused-banner"
          className="mt-3.5 rounded-xl border border-amber-300 bg-amber-50/95 p-4 text-xs sm:text-[13px] text-amber-950 shadow-sm"
        >
          <div className="flex items-center gap-2 font-mono font-black tracking-wider text-amber-900">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            <span data-testid="human-authorization-required">
              AGENT PAUSED · HUMAN AUTHORIZATION REQUIRED
            </span>
          </div>
          <p className="mt-1 text-stone-700 leading-relaxed font-medium">
            Execution is halted at a consequential TrueForge safety checkpoint. Autonomous
            progression is strictly prohibited. Awaiting authenticated operator authorization.
          </p>
        </div>
      )}

      {/* Error banner if step failed */}
      {isFailed && step.error && (
        <div
          data-testid={`step-error-${step.stepNumber}`}
          className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs sm:text-[13px] text-rose-900 shadow-xs"
        >
          <span className="font-mono font-bold uppercase text-rose-800">Step Failure:</span>{" "}
          {step.error}
        </div>
      )}
    </div>
  );
}
