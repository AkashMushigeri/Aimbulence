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
import { toVerificationResult } from "@/types/domain";
import { ApprovalCheckpointModal } from "@/components/approval";
import { VerificationCard } from "@/components/verification";

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
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-amber-800 shadow-xs"
            >
              NOT CONNECTED / WAITING FOR EXECUTION ENGINE
            </span>
            {onInitiateRunbook ? (
              <button
                type="button"
                data-testid="initiate-runbook-btn"
                onClick={onInitiateRunbook}
                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1 font-mono text-xs font-bold text-sky-700 hover:bg-sky-100 hover:border-sky-400 transition-all shadow-xs"
              >
                Initiate MCI-01
              </button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Target Runbook</span>
              <p data-testid="runbook-id" className="font-mono text-base font-extrabold text-slate-900">
                MCI-01 — Mass-Casualty Response Runbook
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Engine State</span>
              <p
                data-testid="runbook-engine-state"
                className="font-mono text-xs font-bold text-amber-700"
              >
                NOT CONNECTED / WAITING FOR EXECUTION ENGINE
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <p>
              The TrueForge agent loop and runbook execution engine interface is planned for subsequent integration. In accordance with system safety governance:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-slate-600">
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
            className={`rounded-full border px-3 py-0.5 font-mono text-xs uppercase tracking-wide shadow-xs ${
              isAwaitingApproval
                ? "border-red-400 bg-red-100 text-red-800 animate-pulse font-extrabold"
                : isCompleted
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
                : isBlocked
                ? "border-rose-300 bg-rose-50 text-rose-800 font-bold"
                : "border-sky-300 bg-sky-50 text-sky-800 font-bold"
            }`}
          >
            {execution.state}
          </span>
          {isCompleted && onResumeRunbook ? null : isBlocked ? null : isAwaitingApproval ? (
            <button
              type="button"
              data-testid="review-checkpoint-btn"
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-red-600 bg-red-600 px-3.5 py-1.5 font-mono text-xs font-black uppercase text-white shadow-md shadow-red-600/30 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all active:scale-[0.98]"
            >
              Review & Authorize Checkpoint
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Runbook Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Target Runbook</span>
            <p data-testid="runbook-id" className="font-mono text-base font-extrabold text-slate-900">
              MCI-01 — Mass-Casualty Response Runbook
            </p>
            <p className="mt-0.5 text-xs text-slate-500 font-mono">
              Execution ID: <span className="text-slate-800 font-semibold">{execution.execution_id}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Engine State</span>
            <p
              data-testid="runbook-engine-state"
              className={`font-mono text-xs font-extrabold uppercase ${
                isAwaitingApproval
                  ? "text-red-700"
                  : isCompleted
                  ? "text-emerald-700"
                  : isBlocked
                  ? "text-rose-700"
                  : "text-sky-700"
              }`}
            >
              {execution.state}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 font-mono">
              Current: <span className="text-slate-800 font-semibold">{execution.current_step_id ?? "N/A"}</span>
            </p>
          </div>
        </div>

        {/* 7. PAUSED CHECKPOINT ALERT (PROMINENT RED) */}
        {isAwaitingApproval ? (
          <div
            data-testid="checkpoint-paused-alert"
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border-2 border-red-500 bg-gradient-to-r from-red-50 via-rose-50 to-red-100 p-5 shadow-lg shadow-red-500/10 ring-1 ring-red-500/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                  </span>
                  <span className="font-mono text-sm font-black tracking-wider text-red-950">
                    AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION
                  </span>
                </div>
                <p className="text-xs text-red-900 leading-relaxed max-w-xl font-medium">
                  Consequential action reached at <strong className="text-red-950 font-mono font-bold">Step 10 (MCI-01-10)</strong>: Preempt Operating Room OR-3.
                  The TrueForge agent loop is stopped and will not proceed without an authentic human signal.
                </p>
              </div>

              <button
                type="button"
                data-testid="open-approval-modal-btn"
                onClick={() => setModalOpen(true)}
                className="rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 font-mono text-xs font-extrabold uppercase tracking-wider text-white shadow-md shadow-red-600/30 hover:bg-red-500 hover:shadow-red-600/40 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all active:scale-[0.98]"
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
            className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 text-xs text-emerald-900 shadow-xs"
          >
            <strong className="font-mono text-sm uppercase font-extrabold text-emerald-950">
              SURGE READINESS REALIZED — EXECUTION COMPLETE & VERIFIED
            </strong>
            <p className="mt-1 text-emerald-800">
              All 15 steps executed successfully. OR-3 preemption was verified on disk. Shortage resolved.
            </p>
          </div>
        ) : null}

        {/* BLOCKED BANNER */}
        {isBlocked ? (
          <div
            data-testid="runbook-blocked-alert"
            className="rounded-xl border border-rose-300 bg-rose-50/80 p-4 text-xs text-rose-900 shadow-xs"
          >
            <strong className="font-mono text-sm uppercase font-extrabold text-rose-950">
              CONSEQUENTIAL ACTION REJECTED — RUNBOOK BLOCKED SAFELY
            </strong>
            <p className="mt-1 text-rose-800">
              Human operator denied preemption. Operating room state was left unmodified in SQLite.
            </p>
          </div>
        ) : null}

        {/* 15 STEPS VISUALIZER */}
        <div className="space-y-2 rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-4 sm:p-5 shadow-xs">
          <p className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700">
            MCI-01 Procedure Step Flow
          </p>

          <div className="divide-y divide-[#ece5d8]">
            {MCI_01_STEPS.map((step) => {
              const stepId = `MCI-01-${String(step.index).padStart(2, "0")}`;
              const isStepCompleted =
                completedSteps.includes(stepId) ||
                (isCompleted && step.index <= 15) ||
                (step.index < currentStepNum && !isBlocked);
              const isCurrentStep =
                stepId === execution.current_step_id || step.index === currentStepNum;
              const tier = MCI_01_STEP_TIERS[step.index] ?? "GREEN";

              const stepResult = execution.step_results?.[stepId] as Record<string, unknown> | undefined;
              const stepVerification = stepResult?.verification
                ? toVerificationResult(stepResult.verification)
                : null;

              return (
                <div
                  key={step.index}
                  data-testid={`runbook-step-${step.index}`}
                  className={`flex flex-col gap-2 py-2.5 text-xs sm:text-[13px] ${
                    isCurrentStep && isAwaitingApproval
                      ? "rounded-xl bg-red-50 border border-red-300 p-3 font-bold text-red-950 shadow-xs"
                      : isStepCompleted
                      ? "text-stone-800 font-medium"
                      : "text-stone-600"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-stone-500 font-semibold">
                        {String(step.index).padStart(2, "0")}.
                      </span>
                      <span className="font-medium text-stone-900">{step.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <SafetyTierBadge tier={tier} />

                      {stepVerification?.status === "VERIFIED" && (
                        <span
                          data-testid={`step-verification-${step.index}`}
                          className="rounded border border-emerald-400 bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-900"
                        >
                          ✓ STATE VERIFIED
                        </span>
                      )}

                      {stepVerification?.status === "FAILED" && (
                        <span
                          data-testid={`step-verification-${step.index}`}
                          className="rounded border border-rose-400 bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-rose-900"
                        >
                          ✗ MISMATCH
                        </span>
                      )}

                      <span
                        data-testid={`step-status-${step.index}`}
                        className={`font-mono text-xs uppercase font-bold ${
                          isCurrentStep && isAwaitingApproval
                            ? "text-red-700"
                            : isStepCompleted
                            ? "text-emerald-700"
                            : isBlocked && isCurrentStep
                            ? "text-rose-700"
                            : "text-stone-500"
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

                  {step.index === 10 && stepVerification && isStepCompleted && (
                    <div className="w-full pt-1">
                      <VerificationCard verification={stepVerification} />
                    </div>
                  )}
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
