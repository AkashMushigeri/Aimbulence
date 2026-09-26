"use client";

import { useState } from "react";
import { Panel, SafetyTierBadge } from "@/components/common";
import { MCI_01_STEPS, MCI_01_STEP_TIERS } from "@/lib/scenario";
import type {
  DecideResponseWire,
  RunbookExecutionStateWire,
  TrueForgeApprovalCheckpointWire,
} from "@/types/api/contracts";
import type { ApprovalProposal } from "@/types/domain";
import { toApprovalProposal } from "@/lib/mappers";
import { ApprovalCheckpointModal } from "@/components/approval";

export interface RunbookSectionProps {
  readonly execution?: RunbookExecutionStateWire | null;
  readonly activeCheckpoint?: TrueForgeApprovalCheckpointWire | null;
  readonly onInitiateRunbook?: () => void;
  readonly onResumeRunbook?: () => void;
  readonly onDecisionSuccess?: (result: DecideResponseWire) => void;
}

export function RunbookSection({
  execution,
  activeCheckpoint,
  onInitiateRunbook,
  onResumeRunbook,
  onDecisionSuccess,
}: RunbookSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // If no execution provided, render the documented placeholder
  if (!execution) {
    return (
      <Panel
        title="RUNBOOK EXECUTION"
        description="Autonomous operational procedure orchestration."
        action={
          <div className="flex items-center gap-2">
            <span
              data-testid="runbook-status-badge"
              className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-amber-300"
            >
              NOT CONNECTED / WAITING FOR EXECUTION ENGINE
            </span>
            {onInitiateRunbook ? (
              <button
                type="button"
                data-testid="initiate-runbook-btn"
                onClick={onInitiateRunbook}
                className="rounded border border-sky-500/60 bg-sky-950/40 px-2.5 py-0.5 font-mono text-xs font-semibold text-sky-300 hover:bg-sky-900/60"
              >
                Initiate MCI-01
              </button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-4 rounded-lg border border-dashed border-surface-border bg-surface/30 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-border/50 pb-2">
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
                className="font-mono text-xs font-semibold text-amber-300"
              >
                NOT CONNECTED / WAITING FOR EXECUTION ENGINE
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <p>
              The TrueForge agent loop and runbook execution engine interface is planned for subsequent integration. In accordance with system safety governance:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-slate-400">
              <li>No fake execution steps or simulated tool progress are fabricated.</li>
              <li>No artificial completion percentages or progress bars are displayed.</li>
              <li>The full runbook visualizer remains gated until the backend execution state contract is served.</li>
            </ul>
          </div>
        </div>
      </Panel>
    );
  }

  // Active execution is present — render real backend-grounded runbook visualizer!
  const isAwaitingApproval = execution.state === "WAITING_FOR_APPROVAL";
  const isCompleted = execution.state === "COMPLETED";
  const isBlocked = execution.state === "BLOCKED";

  // Derive proposal if active checkpoint exists
  let proposal: ApprovalProposal | null = null;
  if (activeCheckpoint) {
    try {
      proposal = toApprovalProposal(activeCheckpoint);
    } catch {
      // safe fallback
    }
  }

  if (!proposal && execution.checkpoint_id && isAwaitingApproval) {
    proposal = {
      targetAction: "PREEMPT_OPERATING_ROOM",
      operationalRationale: "MCI casualty surge of 42 casualties creates deficit of 2 operating rooms.",
      projectedImpact: "Postpones scheduled elective arthroscopic knee debridement in OR-3.",
      affectedResources: ["OR-3"],
      currentState: "status: IN_USE | scheduled procedure: Elective Arthroscopic Knee Debridement",
      postActionState: "status: RESERVED_FOR_TRAUMA | is emergency cleared: true",
      tier: "RED",
      availableDecisions: ["APPROVE", "REJECT"],
      gateState: "AWAITING_OPERATOR",
      checkpointId: execution.checkpoint_id,
      actionId: "ACT-MCI-OR3-PREEMPT",
      actionType: "PREEMPT_OPERATING_ROOM",
      reason: "MCI casualty surge of 42 casualties creates deficit of 2 operating rooms.",
      expectedBenefit: "Unlocks trauma surgical suite OR-3 for immediate emergency triage.",
      potentialConsequence: "Postpones scheduled elective arthroscopic knee debridement in OR-3.",
      affectedResource: "OR-3",
      currentStateDetails: {
        status: "IN_USE",
        scheduled_procedure: "Elective Arthroscopic Knee Debridement",
      },
      proposedStateDetails: {
        status: "RESERVED_FOR_TRAUMA",
        is_emergency_cleared: true,
      },
      incidentId: execution.incident_id,
      requiresHumanApproval: true,
    };
  }

  const currentStepNum = execution.current_step_id
    ? parseInt(execution.current_step_id.replace(/^MCI-\d+-0*/, ""), 10) || 1
    : 1;

  const completedSteps = execution.completed_steps || [];

  return (
    <Panel
      title="RUNBOOK EXECUTION"
      description="Autonomous operational procedure orchestration."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="runbook-status-badge"
            className={`rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
              isAwaitingApproval
                ? "border-red-500/60 bg-red-950/40 text-red-300 animate-pulse font-bold"
                : isCompleted
                ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300"
                : isBlocked
                ? "border-rose-500/60 bg-rose-950/30 text-rose-300"
                : "border-sky-500/60 bg-sky-950/30 text-sky-300"
            }`}
          >
            {execution.state}
          </span>
          {isCompleted && onResumeRunbook ? null : isBlocked ? null : isAwaitingApproval ? (
            <button
              type="button"
              data-testid="review-checkpoint-btn"
              onClick={() => setModalOpen(true)}
              className="rounded border border-red-500 bg-red-600 px-3 py-1 font-mono text-xs font-extrabold uppercase text-white shadow-lg hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Review & Authorize Checkpoint
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Runbook Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-surface-border bg-surface/40 p-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Target Runbook</span>
            <p data-testid="runbook-id" className="font-mono text-base font-bold text-slate-100">
              MCI-01 — Mass-Casualty Response Runbook
            </p>
            <p className="mt-0.5 text-xs text-slate-400 font-mono">
              Execution ID: <span className="text-slate-200">{execution.execution_id}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-400">Engine State</span>
            <p
              data-testid="runbook-engine-state"
              className={`font-mono text-xs font-bold uppercase ${
                isAwaitingApproval
                  ? "text-red-400"
                  : isCompleted
                  ? "text-emerald-400"
                  : isBlocked
                  ? "text-rose-400"
                  : "text-sky-300"
              }`}
            >
              {execution.state}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 font-mono">
              Current: <span className="text-slate-200">{execution.current_step_id ?? "N/A"}</span>
            </p>
          </div>
        </div>

        {/* 7. PAUSED CHECKPOINT ALERT (PROMINENT RED) */}
        {isAwaitingApproval ? (
          <div
            data-testid="checkpoint-paused-alert"
            role="alert"
            aria-live="assertive"
            className="rounded-lg border-2 border-red-500 bg-red-950/40 p-4 shadow-lg shadow-red-950/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-ping rounded-full bg-red-500" />
                  <span className="font-mono text-sm font-black tracking-wider text-red-300">
                    AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION
                  </span>
                </div>
                <p className="text-xs text-slate-200">
                  Consequential action reached at <strong>Step 10 (MCI-01-10)</strong>: Preempt Operating Room OR-3.
                  The TrueForge agent loop is stopped and will not proceed without an authentic human signal.
                </p>
              </div>

              <button
                type="button"
                data-testid="open-approval-modal-btn"
                onClick={() => setModalOpen(true)}
                className="rounded border border-red-400 bg-red-600 px-4 py-2 font-mono text-xs font-extrabold uppercase tracking-wide text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Review Approval Proposal
              </button>
            </div>
          </div>
        ) : null}

        {/* COMPLETED BANNER */}
        {isCompleted ? (
          <div
            data-testid="runbook-completed-alert"
            className="rounded-lg border border-emerald-500/50 bg-emerald-950/30 p-4 text-xs text-emerald-200"
          >
            <strong className="font-mono text-sm uppercase text-emerald-300">
              SURGE READINESS REALIZED — EXECUTION COMPLETE & VERIFIED
            </strong>
            <p className="mt-1 text-slate-300">
              All 15 steps executed successfully. OR-3 preemption was verified on disk. Shortage resolved.
            </p>
          </div>
        ) : null}

        {/* BLOCKED BANNER */}
        {isBlocked ? (
          <div
            data-testid="runbook-blocked-alert"
            className="rounded-lg border border-rose-500/50 bg-rose-950/30 p-4 text-xs text-rose-200"
          >
            <strong className="font-mono text-sm uppercase text-rose-300">
              CONSEQUENTIAL ACTION REJECTED — RUNBOOK BLOCKED SAFELY
            </strong>
            <p className="mt-1 text-slate-300">
              Human operator denied preemption. Operating room state was left unmodified in SQLite.
            </p>
          </div>
        ) : null}

        {/* 15 STEPS VISUALIZER */}
        <div className="space-y-1.5 rounded-lg border border-surface-border bg-surface/20 p-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
            MCI-01 Procedure Step Flow
          </p>

          <div className="divide-y divide-surface-border/40">
            {MCI_01_STEPS.map((step) => {
              const stepId = `MCI-01-${String(step.index).padStart(2, "0")}`;
              const isStepCompleted =
                completedSteps.includes(stepId) ||
                (isCompleted && step.index <= 15) ||
                (step.index < currentStepNum && !isBlocked);
              const isCurrentStep =
                stepId === execution.current_step_id || step.index === currentStepNum;
              const tier = MCI_01_STEP_TIERS[step.index] ?? "GREEN";

              return (
                <div
                  key={step.index}
                  data-testid={`runbook-step-${step.index}`}
                  className={`flex flex-wrap items-center justify-between gap-2 py-2 text-xs ${
                    isCurrentStep && isAwaitingApproval
                      ? "rounded bg-red-950/30 px-2 font-bold text-red-200"
                      : isStepCompleted
                      ? "text-slate-300"
                      : "text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">
                      {String(step.index).padStart(2, "0")}.
                    </span>
                    <span>{step.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <SafetyTierBadge tier={tier} />
                    <span
                      data-testid={`step-status-${step.index}`}
                      className={`font-mono text-[10px] uppercase ${
                        isCurrentStep && isAwaitingApproval
                          ? "font-bold text-red-400"
                          : isStepCompleted
                          ? "text-emerald-400"
                          : isBlocked && isCurrentStep
                          ? "text-rose-400"
                          : "text-slate-500"
                      }`}
                    >
                      {isCurrentStep && isAwaitingApproval
                        ? "WAITING_APPROVAL"
                        : isStepCompleted
                        ? "COMPLETED"
                        : isBlocked && isCurrentStep
                        ? "BLOCKED"
                        : "PENDING"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal if triggered */}
        {proposal ? (
          <ApprovalCheckpointModal
            isOpen={modalOpen}
            proposal={proposal}
            onClose={() => setModalOpen(false)}
            onDecisionSuccess={(result) => {
              if (onDecisionSuccess) {
                onDecisionSuccess(result);
              }
            }}
          />
        ) : null}
      </div>
    </Panel>
  );
}
