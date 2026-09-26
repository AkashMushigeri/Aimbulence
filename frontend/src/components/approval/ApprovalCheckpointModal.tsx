"use client";

import { useEffect, useState } from "react";
import type { DecideRequestWire, DecideResponseWire } from "@/types/api/contracts";
import type { ApprovalProposal } from "@/types/domain";
import { submitApprovalDecisionAction } from "@/app/actions";
import { ApprovalStatus, type ApprovalLifecycleState } from "./ApprovalStatus";
import { ImpactBriefing } from "./ImpactBriefing";
import { ApprovalProposalView } from "./ApprovalProposalView";
import { DecisionControls } from "./DecisionControls";

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
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmitDecision = async (payload: DecideRequestWire) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setLifecycleState("SUBMITTING");
    setStatusMessage("Transmitting decision to backend TrueForge checkpoint...");

    try {
      const actionRes = await submitApprovalDecisionAction(payload);
      if (!actionRes.ok || !actionRes.result) {
        throw new Error(actionRes.message || "Approval decision failed on server.");
      }

      const result = actionRes.result;
      setResolvedResult(result);

      if (result.checkpoint.state === "REJECTED") {
        setLifecycleState("CONFIRMED_REJECTED");
        setStatusMessage(
          `Decision recorded by ${payload.decision_by}. Preemption was REJECTED. SQLite database remained unmodified. Runbook safely blocked.`,
        );
      } else {
        const isVerified = Boolean(
          result.execution?.verification &&
            (result.execution.verification as { verified?: boolean }).verified,
        );
        setLifecycleState(isVerified ? "VERIFIED_EXECUTED" : "CONFIRMED_APPROVED");
        setStatusMessage(
          `Consequential mutation authorized by ${payload.decision_by}. State mutated and independently verified in SQLite.`,
        );
      }

      if (onDecisionSuccess) {
        onDecisionSuccess(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to record approval decision.";
      setErrorMessage(msg);
      setLifecycleState("ERROR");
      setStatusMessage("Submission failed. The agent remains paused awaiting human authorization.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolved =
    lifecycleState === "CONFIRMED_APPROVED" ||
    lifecycleState === "CONFIRMED_REJECTED" ||
    lifecycleState === "VERIFIED_EXECUTED";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-checkpoint-title"
      data-testid="approval-checkpoint-modal"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="relative my-8 w-full max-w-4xl rounded-xl border border-red-500/60 bg-surface-raised p-6 shadow-2xl shadow-red-950/50">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-surface-border pb-4">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
              AIMBULENCE · Consequential Action Checkpoint
            </span>
            <h2
              id="approval-checkpoint-title"
              className="mt-1 font-mono text-xl font-extrabold tracking-wide text-slate-100"
            >
              HUMAN-IN-THE-LOOP AUTHORIZATION GATE
            </h2>
          </div>

          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close approval checkpoint modal"
            className="rounded p-1.5 text-slate-400 hover:bg-surface hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              &times;
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-5 space-y-5">
          {/* Status Banner */}
          <ApprovalStatus state={lifecycleState} message={statusMessage} />

          {/* Proposal Summary & Impact Briefing */}
          <ApprovalProposalView proposal={proposal} />
          <ImpactBriefing proposal={proposal} />

          {/* Resolved State Display */}
          {isResolved && resolvedResult ? (
            <div
              data-testid="resolved-execution-details"
              className="rounded-lg border border-surface-border bg-surface/60 p-4"
            >
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                Backend Checkpoint Resolution & Execution Result
              </h4>
              <div className="mt-2 grid gap-2 text-xs font-mono text-slate-300 sm:grid-cols-2">
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

              <div className="mt-4 flex justify-end">
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
