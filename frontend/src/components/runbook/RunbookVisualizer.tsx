import { useMemo } from "react";
import { Panel } from "@/components/common";
import { MCI_01_STEP_DEFINITIONS } from "@/types/domain/runbook";
import type { AgentExecutionState, RunbookStepDetail } from "@/types/domain";
import { ExecutionStatus } from "./ExecutionStatus";
import { RunbookProgress } from "./RunbookProgress";
import { RunbookStep } from "./RunbookStep";

export interface RunbookVisualizerProps {
  readonly execution?: AgentExecutionState | null;
  readonly steps?: readonly RunbookStepDetail[];
  readonly isConnected?: boolean;
}

export function RunbookVisualizer({
  execution,
  steps = MCI_01_STEP_DEFINITIONS,
  isConnected = false,
}: RunbookVisualizerProps) {
  const isStarted = Boolean(
    execution &&
      execution.status !== "PENDING" &&
      execution.status !== "IDLE",
  );

  const status = execution?.status ?? "PENDING";
  const isPaused = status === "PAUSED" || status === "AWAITING_APPROVAL";
  const currentStepNum = execution?.currentStep ?? 1;

  // Merge execution results into step definitions
  const mergedSteps = useMemo(() => {
    return steps.map((baseStep) => {
      const stepResult = execution?.stepResults?.[baseStep.stepId] as
        | { status?: string; verification?: unknown; error?: string }
        | undefined;

      let stepStatus = baseStep.status;
      let verification = baseStep.verification;
      let error = baseStep.error;

      if (stepResult) {
        if (stepResult.status) {
          stepStatus = stepResult.status as typeof baseStep.status;
        }
        if (stepResult.verification !== undefined) {
          verification = Boolean(stepResult.verification);
        }
        if (stepResult.error) {
          error = stepResult.error;
        }
      } else if (execution && isStarted) {
        if (execution.status === "COMPLETED" || execution.status === "VERIFIED") {

          stepStatus = "COMPLETED";
        } else if (baseStep.stepNumber < currentStepNum) {
          stepStatus = "COMPLETED";
        } else if (baseStep.stepNumber === currentStepNum) {
          stepStatus = isPaused
            ? "PAUSED"
            : status === "FAILED"
            ? "FAILED"
            : "RUNNING";
        } else {
          stepStatus = "PENDING";
        }
      }

      return {
        ...baseStep,
        status: stepStatus,
        verification,
        error,
      };
    });
  }, [steps, execution, isStarted, currentStepNum, isPaused, status]);

  return (
    <Panel
      title="RUNBOOK EXECUTION"
      description="Autonomous operational procedure orchestration."
      action={
        !execution || (!isStarted && !isConnected) ? (
          <span
            data-testid="runbook-status-badge"
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-xs uppercase tracking-wide text-amber-800 font-bold shadow-xs"
          >
            NOT CONNECTED / WAITING FOR EXECUTION ENGINE
          </span>
        ) : (
          <span data-testid="runbook-status-badge">
            <ExecutionStatus status={status} />
          </span>
        )
      }
    >
      <div className="space-y-4 rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 sm:p-6 shadow-xs">
        {/* Header information */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#ece5d8] pb-3.5">
          <div>
            <span className="font-mono text-xs uppercase font-bold tracking-wider text-stone-600">Target Runbook</span>
            <p data-testid="runbook-id" className="font-mono text-base sm:text-lg font-extrabold text-stone-900">
              MCI-01 — Mass-Casualty Response Runbook
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-xs uppercase font-bold tracking-wider text-stone-600">Engine State</span>
            <p
              data-testid="runbook-engine-state"
              className={`font-mono text-xs sm:text-sm font-black ${
                isStarted ? "text-sky-800" : "text-amber-800"
              }`}
            >
              {!execution || !isStarted
                ? "NOT CONNECTED / WAITING FOR EXECUTION ENGINE"
                : status}
            </p>
          </div>
        </div>

        {/* Execution trigger notice and disabled control */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fbf9f4] p-4 border border-[#e5dfd2] shadow-xs">
          <div className="text-xs sm:text-[13px] text-stone-700 max-w-xl font-medium">
            <p className="font-bold text-stone-900 font-mono">
              Deterministic Procedure Execution
            </p>
            <p className="mt-0.5 text-stone-600">
              Backend execution engine endpoint is pending backend deployment. Execution trigger is
              safely locked until runtime connection is verified.
            </p>
          </div>
          <button
            type="button"
            disabled
            data-testid="runbook-execute-btn"
            aria-disabled="true"
            className="cursor-not-allowed rounded-xl bg-[#ede7dc] px-4 py-2.5 font-mono text-xs font-bold text-stone-600 border border-[#e5dfd2] opacity-75 shadow-xs"
            title="Backend execution engine pending integration"
          >
            Execute MCI-01 Surge Runbook
          </button>
        </div>

        {/* TrueForge Safety Governance Notice */}
        <div
          data-testid="safety-governance-notice"
          className="rounded-xl border border-red-300 bg-red-50/90 px-4 py-3 text-xs sm:text-[13px] text-red-950 shadow-xs"
        >
          <strong className="font-mono uppercase text-red-900 font-black">Safety Governance:</strong> Steps
          10–13 require explicit Human-in-the-Loop authorization. No automatic progression through
          RED consequential actions without verified operator consent.
        </div>

        {/* Progress Visualization */}
        <RunbookProgress
          currentStep={currentStepNum}
          totalSteps={steps.length}
          status={status}
          isPaused={isPaused}
        />

        {/* 15 Operational Step Cards */}
        <div
          data-testid="runbook-step-list"
          className="space-y-2.5 pt-2 max-h-[600px] overflow-y-auto pr-1.5 custom-scrollbar"
        >
          {mergedSteps.map((step) => (
            <RunbookStep
              key={step.stepId}
              step={step}
              isCurrent={isStarted && step.stepNumber === currentStepNum}
              isPaused={isPaused}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
