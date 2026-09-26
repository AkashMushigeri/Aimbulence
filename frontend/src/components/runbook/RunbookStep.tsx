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
      className={`rounded-lg border p-3.5 transition-all ${
        isStepPaused
          ? "border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-500/50"
          : isFailed
          ? "border-rose-600/70 bg-rose-950/20"
          : isRunning
          ? "border-blue-500/60 bg-blue-950/20 ring-1 ring-blue-500/40"
          : isCompleted
          ? "border-surface-border/70 bg-surface/30"
          : "border-surface-border/40 bg-surface/10 opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            data-testid={`step-number-${step.stepNumber}`}
            className={`flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${
              isStepPaused
                ? "bg-amber-500 text-slate-950 font-black"
                : isCompleted
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : isRunning
                ? "bg-blue-500 text-white animate-pulse"
                : isFailed
                ? "bg-rose-500 text-white"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {step.stepNumber}
          </span>

          <div>
            <h4
              data-testid={`step-title-${step.stepNumber}`}
              className="text-sm font-semibold text-slate-100 leading-snug"
            >
              {step.name}
            </h4>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>{step.stepId}</span>
              <span>•</span>
              <span className="text-slate-300">tool:</span>
              <code className="rounded bg-surface-elevated/70 px-1.5 py-0.5 text-blue-300">
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
              className="inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-300"
            >
              <span>✓</span>
              <span>VERIFIED</span>
            </span>
          )}

          {/* Step status label */}
          <span
            data-testid={`step-status-${step.stepNumber}`}
            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
              isCompleted
                ? "bg-emerald-500/15 text-emerald-300"
                : isRunning
                ? "bg-blue-500/20 text-blue-300 animate-pulse"
                : isStepPaused
                ? "bg-amber-500/20 text-amber-200"
                : isFailed
                ? "bg-rose-500/20 text-rose-300"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {step.status}
          </span>
        </div>
      </div>

      {step.description && (
        <p className="mt-2 text-xs text-slate-400 leading-relaxed pl-8.5">
          {step.description}
        </p>
      )}

      {/* CRITICAL SAFETY CALLOUT: Step 10-13 or PAUSED state */}
      {isStepPaused && (
        <div
          data-testid="agent-paused-banner"
          className="mt-3 rounded border border-amber-500/60 bg-amber-950/40 p-3 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2 font-mono font-bold tracking-wider text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span data-testid="human-authorization-required">
              AGENT PAUSED · HUMAN AUTHORIZATION REQUIRED
            </span>
          </div>
          <p className="mt-1 text-slate-300">
            Execution is halted at a consequential TrueForge safety checkpoint. Autonomous
            progression is strictly prohibited. Awaiting authenticated operator authorization.
          </p>
        </div>
      )}

      {/* Error banner if step failed */}
      {isFailed && step.error && (
        <div
          data-testid={`step-error-${step.stepNumber}`}
          className="mt-2.5 rounded border border-rose-600/50 bg-rose-950/40 p-2.5 text-xs text-rose-200"
        >
          <span className="font-mono font-bold uppercase text-rose-300">Step Failure:</span>{" "}
          {step.error}
        </div>
      )}
    </div>
  );
}
