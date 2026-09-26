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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/60 p-4 backdrop-blur-sm"
    >
      <div className="relative my-8 w-full max-w-4xl rounded-3xl border border-red-300 bg-[#fffdf9] p-6 sm:p-8 shadow-2xl shadow-stone-950/20">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#ece5d8] pb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-100 px-3 py-1 font-mono text-xs font-black uppercase tracking-wider text-red-900 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
              AIMBULENCE · Consequential Action Checkpoint
            </div>
            <h2
              id="approval-checkpoint-title"
              className="mt-2.5 font-mono text-xl sm:text-2xl font-black tracking-wide text-stone-900"
            >
              HUMAN-IN-THE-LOOP AUTHORIZATION GATE
            </h2>
            <div className="mt-1 text-xs font-mono text-slate-400">
              GATE ID: {proposal.checkpointId || "CHK-MCI-OR3"}
            </div>
          </div>

          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close approval checkpoint modal"
            className="rounded-xl p-2 text-stone-500 hover:bg-[#ede7dc] hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-2xl leading-none font-bold">
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
              className="space-y-4 rounded-2xl border border-[#e5dfd2] bg-[#fbf9f4] p-5 sm:p-6 shadow-sm"
            >
              <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700">
                Backend Checkpoint Resolution & Execution Result
              </h4>
              <div className="grid gap-3 text-xs sm:text-[13px] font-mono text-stone-800 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e5dfd2] bg-white p-3 shadow-xs">
                  <span className="text-stone-600">Status:</span>{" "}
                  <strong className="text-stone-900 font-bold">{resolvedResult.status}</strong>
                </div>
                <div className="rounded-xl border border-[#e5dfd2] bg-white p-3 shadow-xs">
                  <span className="text-stone-600">Checkpoint State:</span>{" "}
                  <strong
                    className={
                      resolvedResult.checkpoint.state === "REJECTED"
                        ? "text-rose-700 font-extrabold"
                        : "text-emerald-700 font-extrabold"
                    }
                  >
                    {resolvedResult.checkpoint.state}
                  </strong>
                </div>
                {resolvedResult.execution ? (
                  <>
                    <div className="rounded-xl border border-[#e5dfd2] bg-white p-3 shadow-xs">
                      <span className="text-stone-600">Resource Mutated:</span>{" "}
                      <strong className="text-amber-800 font-bold">
                        {resolvedResult.execution.resource}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-[#e5dfd2] bg-white p-3 shadow-xs">
                      <span className="text-stone-600">Verification:</span>{" "}
                      <strong className="text-emerald-800 font-bold">
                        {resolvedResult.execution.verification ? "CONFIRMED ON DISK" : "PENDING"}
                      </strong>
                    </div>
                  </>
                ) : null}
              </div>

              {resolvedResult.checkpoint.state === "REJECTED" && (
                <div
                  data-testid="rejection-safety-notice"
                  className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs sm:text-[13px] text-rose-900 shadow-xs"
                >
                  <p className="font-mono font-bold text-rose-800 uppercase tracking-wider">
                    Safety Boundary Maintained
                  </p>
                  <p className="mt-1 text-stone-700 leading-relaxed font-medium">
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
                  className="rounded-xl bg-stone-900 px-5 py-2.5 font-mono text-xs sm:text-sm font-bold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm transition-all"
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
