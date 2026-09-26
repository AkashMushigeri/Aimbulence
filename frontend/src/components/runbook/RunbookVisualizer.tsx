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
            className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-amber-300"
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
      <div className="space-y-4 rounded-lg border border-dashed border-surface-border bg-surface/30 p-4">
        {/* Header information */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-border/50 pb-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Target Runbook</span>
            <p data-testid="runbook-id" className="font-mono text-base font-bold text-slate-100">
              MCI-01 — Mass-Casualty Response Runbook
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-400">Engine State</span>
            <p
              data-testid="runbook-engine-state"
              className={`font-mono text-xs font-semibold ${
                isStarted ? "text-blue-300" : "text-amber-300"
              }`}
            >
              {!execution || !isStarted
                ? "NOT CONNECTED / WAITING FOR EXECUTION ENGINE"
                : status}
            </p>
          </div>
        </div>

        {/* Execution trigger notice and disabled control */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-elevated/40 p-3 border border-surface-border/60">
          <div className="text-xs text-slate-400 max-w-xl">
            <p className="font-semibold text-slate-300">
              Deterministic Procedure Execution
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Backend execution engine endpoint is pending backend deployment. Execution trigger is
              safely locked until runtime connection is verified.
            </p>
          </div>
          <button
            type="button"
            disabled
            data-testid="runbook-execute-btn"
            aria-disabled="true"
            className="cursor-not-allowed rounded bg-slate-800 px-3.5 py-1.5 font-mono text-xs font-bold text-slate-400 border border-slate-700 opacity-60"
            title="Backend execution engine pending integration"
          >
            Execute MCI-01 Surge Runbook
          </button>
        </div>

        {/* TrueForge Safety Governance Notice */}
        <div
          data-testid="safety-governance-notice"
          className="rounded border border-red-500/30 bg-red-950/20 px-3 py-2 text-[11px] text-red-200"
        >
          <strong className="font-mono uppercase text-red-300">Safety Governance:</strong> Steps
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
          className="space-y-2.5 pt-2 max-h-[600px] overflow-y-auto pr-1"
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
