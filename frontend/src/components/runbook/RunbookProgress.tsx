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
      <div className="flex items-center justify-between text-xs sm:text-[13px]">
        <span className="font-mono text-stone-600">
          {isStarted ? (
            <>
              Step <strong className="text-stone-900 font-bold">{effectiveCurrent}</strong> of{" "}
              <strong className="text-stone-900 font-bold">{totalSteps}</strong>
            </>
          ) : (
            <span className="font-medium">15 Planned Operational Steps</span>
          )}
        </span>
        <span className="font-mono text-xs sm:text-[13px] font-bold text-stone-800">
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
          className="h-2.5 w-full overflow-hidden rounded-full bg-[#ede7dc] border border-[#e5dfd2]"
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
                : "bg-sky-500"
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

          let dotClass = "bg-[#ede7dc] text-stone-600 border border-[#e5dfd2]";
          if (isStepCompleted) {
            dotClass = isCheckpointed
              ? "bg-red-500 text-white font-bold"
              : "bg-emerald-500 text-white font-bold";
          } else if (isStepActive) {
            dotClass = isPaused || isCheckpointed
              ? "bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse font-bold"
              : "bg-sky-600 text-white ring-2 ring-sky-300 animate-pulse font-bold";
          } else if (isCheckpointed) {
            dotClass = "border border-red-300 bg-red-100 text-red-800 font-bold";
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
