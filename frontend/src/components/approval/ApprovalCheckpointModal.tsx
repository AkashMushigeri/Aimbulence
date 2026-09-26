"use client";

import { useEffect, useState } from "react";
import type { DecideRequestWire, DecideResponseWire } from "@/types/api/contracts";
import type { ApprovalProposal } from "@/types/domain";
import { toActionResult, toVerificationResult } from "@/types/domain";
import { submitApprovalDecisionAction } from "@/app/actions";
import { ApprovalStatus, type ApprovalLifecycleState } from "./ApprovalStatus";
import { ImpactBriefing } from "./ImpactBriefing";
import { ApprovalProposalView } from "./ApprovalProposalView";
import { DecisionControls } from "./DecisionControls";
import { VerificationCard } from "@/components/verification";

export interface ApprovalCheckpointModalProps {
  readonly isOpen: boolean;
  readonly proposal: ApprovalProposal;
  readonly onClose: () => void;
  readonly onDecisionSuccess?: (result: DecideResponseWire) => void;
}

export function ApprovalCheckpointModal({
  isOpen,
  proposal,
  onClose,
  onDecisionSuccess,
}: ApprovalCheckpointModalProps) {
  const [lifecycleState, setLifecycleState] = useState<ApprovalLifecycleState>("PAUSED_WAITING");
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<DecideResponseWire | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmitDecision = async (
    decision: "APPROVE" | "REJECT",
    operatorId: string,
    notes?: string,
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setLifecycleState("SUBMITTING");
    setStatusMessage(`Transmitting ${decision} decision...`);

    const payload: DecideRequestWire = {
      checkpoint_id: proposal.checkpointId || "CHK-MCI-OR3",
      decision,
      decision_by: operatorId,
      reason: notes,
      execute_if_approved: true,
    };

    try {
      const response = await submitApprovalDecisionAction(payload);
      if (!response.ok || !response.result) {
        setErrorMessage(response.message || "Failed to submit decision to TrueForge.");
        setLifecycleState("PAUSED_WAITING");
        setIsSubmitting(false);
        return;
      }

      setResolvedResult(response.result);

      if (decision === "APPROVE") {
        setLifecycleState("EXECUTED");
        setStatusMessage(
          response.result.execution
            ? `Action authorized. Resource ${response.result.execution.resource} mutated & verified.`
            : "Action authorized and executed successfully.",
        );
      } else {
        setLifecycleState("REJECTED");
        setStatusMessage("Action rejected by operator. Execution halted safely without mutation.");
      }

      if (onDecisionSuccess) {
        onDecisionSuccess(response.result);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unexpected error during submission.");
      setLifecycleState("PAUSED_WAITING");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="approval-checkpoint-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkpoint-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-xl border border-rose-500/50 bg-slate-900 shadow-2xl shadow-rose-950/40">
        {/* Header Banner */}
        <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-950/30 px-6 py-4">
          <div className="flex items-center space-x-3">
            <span
              data-testid="trueforge-shield-badge"
              className="inline-flex items-center rounded bg-rose-500/20 px-2.5 py-1 text-xs font-mono font-bold tracking-wider text-rose-400 border border-rose-500/40 uppercase"
            >
              TRUEFORGE SAFETY CHECKPOINT
            </span>
            <span className="text-xs font-mono text-slate-400">
              GATE ID: {proposal.checkpointId || "CHK-MCI-OR3"}
            </span>
          </div>
          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
          {/* Status Alert */}
          <ApprovalStatus state={lifecycleState} message={statusMessage} />

          {/* Proposal Deep-Dive */}
          <ApprovalProposalView proposal={proposal} />

          {/* Impact & Trade-Off Briefing */}
          <ImpactBriefing proposal={proposal} />

          {/* Post-Decision Result Banner */}
          {resolvedResult ? (
            <div
              data-testid="decision-outcome-card"
              className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 space-y-3 font-mono text-xs"
            >
              <h4 className="font-bold text-slate-200 uppercase tracking-wider">
                TrueForge Execution Result
              </h4>
              <div className="grid grid-cols-2 gap-2 text-slate-400">
                <div>
                  <span className="text-slate-500">Status:</span>{" "}
                  <strong className="text-white">{resolvedResult.status}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Checkpoint State:</span>{" "}
                  <strong
                    className={
                      resolvedResult.checkpoint.state === "REJECTED"
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }
                  >
                    {resolvedResult.checkpoint.state}
                  </strong>
                </div>
                {resolvedResult.execution ? (
                  <>
                    <div>
                      <span className="text-slate-500">Resource Mutated:</span>{" "}
                      <strong className="text-amber-300">
                        {resolvedResult.execution.resource}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Verification:</span>{" "}
                      <strong className="text-emerald-300">
                        {resolvedResult.execution.verification ? "CONFIRMED ON DISK" : "PENDING"}
                      </strong>
                    </div>
                  </>
                ) : null}
              </div>

              {resolvedResult.checkpoint.state === "REJECTED" && (
                <div
                  data-testid="rejection-safety-notice"
                  className="rounded-lg border border-rose-500/60 bg-rose-950/30 p-3 text-xs text-rose-200"
                >
                  <p className="font-mono font-bold text-rose-300 uppercase">
                    Safety Boundary Maintained
                  </p>
                  <p className="mt-1 text-slate-300">
                    Consequential action was explicitly rejected. No tool calls were executed against SQLite, and no operational resources were altered.
                  </p>
                </div>
              )}

              {resolvedResult.execution?.verification && (() => {
                const verif = toVerificationResult(resolvedResult.execution.verification);
                const act = toActionResult(resolvedResult.execution);
                return verif ? (
                  <div className="pt-2">
                    <VerificationCard action={act} verification={verif} />
                  </div>
                ) : null;
              })()}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  data-testid="resolved-close-btn"
                  onClick={onClose}
                  className="rounded bg-sky-600 px-4 py-2 font-mono text-xs font-bold text-white hover:bg-sky-500 focus:outline-none"
                >
                  RETURN TO DASHBOARD
                </button>
              </div>
            </div>
          ) : (
            /* Decision Controls */
            <DecisionControls
              checkpointId={proposal.checkpointId || "CHK-MCI-OR3"}
              isSubmitting={isSubmitting}
              error={errorMessage}
              onSubmitDecision={handleSubmitDecision}
            />
          )}
        </div>
      </div>
    </div>
  );
}
