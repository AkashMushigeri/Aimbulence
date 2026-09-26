import type { ExecutionStatus } from "@/types/domain";

export interface RunbookProgressProps {
  readonly currentStep: number;
  readonly totalSteps?: number;
  readonly status: ExecutionStatus;
  readonly isPaused?: boolean;
}

export function RunbookProgress({
  currentStep,
  totalSteps = 15,
  status,
  isPaused = false,
}: RunbookProgressProps) {
  const isStarted = status !== "PENDING" && status !== "IDLE";
  const isCompleted = status === "COMPLETED" || status === "VERIFIED";

  // Calculate deterministic progress percentage
  const effectiveCurrent = isCompleted ? totalSteps : Math.max(0, Math.min(totalSteps, currentStep));
  const percent = isStarted
    ? Math.round((effectiveCurrent / totalSteps) * 100)
    : 0;

  return (
    <div className="space-y-3" data-testid="runbook-progress-container">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-slate-400">
          {isStarted ? (
            <>
              Step <strong className="text-slate-100">{effectiveCurrent}</strong> of{" "}
              <strong>{totalSteps}</strong>
            </>
          ) : (
            <span>15 Planned Operational Steps</span>
          )}
        </span>
        <span className="font-mono text-xs font-semibold text-slate-300">
          {isStarted ? `${percent}%` : "0% (STANDBY)"}
        </span>
      </div>

      {/* Visual progress bar: only rendered when execution has actually started */}
      {isStarted && (
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Runbook execution progress"
          className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        >
          <div
            data-testid="runbook-progress-fill"
            className={`h-full transition-all duration-500 ease-out ${
              status === "FAILED"
                ? "bg-rose-500"
                : isPaused || status === "PAUSED" || status === "AWAITING_APPROVAL"
                ? "bg-amber-500"
                : isCompleted
                ? "bg-emerald-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {/* Step dots visualization (1 to 15) */}
      <div
        data-testid="runbook-step-dots"
        className="flex items-center justify-between gap-1 pt-1"
        aria-hidden="true"
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCheckpointed = stepNum >= 10 && stepNum <= 13;
          const isStepCompleted = isStarted && (isCompleted || stepNum < currentStep);
          const isStepActive = isStarted && !isCompleted && stepNum === currentStep;

          let dotClass = "bg-slate-700 text-slate-500";
          if (isStepCompleted) {
            dotClass = isCheckpointed
              ? "bg-red-500/80 text-white"
              : "bg-emerald-500/80 text-white";
          } else if (isStepActive) {
            dotClass = isPaused || isCheckpointed
              ? "bg-amber-400 text-slate-900 ring-2 ring-amber-400/50 animate-pulse"
              : "bg-blue-400 text-slate-900 ring-2 ring-blue-400/50 animate-pulse";
          } else if (isCheckpointed) {
            dotClass = "border border-red-500/40 bg-red-950/40 text-red-400";
          }

          return (
            <div
              key={stepNum}
              data-testid={`step-dot-${stepNum}`}
              className={`flex h-4 w-4 items-center justify-center rounded-full font-mono text-[9px] font-bold transition-all ${dotClass}`}
              title={`Step ${stepNum}${isCheckpointed ? " (Human Authorization Gate)" : ""}`}
            >
              {stepNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}
