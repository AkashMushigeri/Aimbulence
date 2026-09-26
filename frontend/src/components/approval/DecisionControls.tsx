"use client";

import { useState } from "react";
import type { ApprovalDecisionTypeWire, DecideRequestWire } from "@/types/api/contracts";

export interface DecisionControlsProps {
  readonly checkpointId: string;
  readonly isSubmitting?: boolean;
  readonly error?: string | null;
  readonly onSubmitDecision: (payload: DecideRequestWire) => Promise<void> | void;
}

export function DecisionControls({
  checkpointId,
  isSubmitting = false,
  error = null,
  onSubmitDecision,
}: DecisionControlsProps) {
  const [operatorName, setOperatorName] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isValidOperator = operatorName.trim().length >= 2;
  const disabled = isSubmitting || submitted || !isValidOperator;

  const handleDecision = async (decision: ApprovalDecisionTypeWire) => {
    if (disabled || !isValidOperator) {
      return;
    }
    setSubmitted(true);
    try {
      await onSubmitDecision({
        checkpoint_id: checkpointId,
        decision,
        decision_by: operatorName.trim(),
        reason: reason.trim() || undefined,
        execute_if_approved: decision === "APPROVE" || decision === "allow",
      });
    } catch {
      // Re-enable so user can retry upon network/backend error
      setSubmitted(false);
    }
  };

  return (
    <div
      data-testid="decision-controls"
      className="space-y-4 rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 sm:p-6 shadow-xs"
    >
      <div className="border-b border-[#ece5d8] pb-3.5">
        <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700">
          Operator Human Decision Gate
        </h4>
        <p className="mt-0.5 text-xs sm:text-[13px] text-stone-600 font-medium">
          Consequential actions require deliberate human operator authentication before submission.
        </p>
      </div>

      {error ? (
        <div
          data-testid="decision-error-banner"
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs sm:text-[13px] text-red-900 shadow-xs"
        >
          <strong className="font-bold font-mono">Backend Decision Error: </strong>
          {error}
        </div>
      ) : null}

      <div className="space-y-3.5">
        <div>
          <label
            htmlFor="operator-name-input"
            className="block font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700"
          >
            Authorizing Human Authority <span className="text-red-600">*</span>
          </label>
          <input
            id="operator-name-input"
            data-testid="operator-name-input"
            type="text"
            required
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            disabled={isSubmitting || submitted}
            placeholder="e.g., Dr. Eleanor Vance, Trauma Medical Director"
            className="mt-1.5 w-full rounded-xl border border-[#d8d0c0] bg-[#fbf9f4] px-4 py-3 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
          />
          {!isValidOperator && operatorName.length > 0 ? (
            <p className="mt-1 text-xs text-rose-600 font-mono font-semibold">
              Authority name must be at least 2 characters.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="operator-reason-input"
            className="block font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700"
          >
            Clinical / Operational Rationale
          </label>
          <textarea
            id="operator-reason-input"
            data-testid="operator-reason-input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting || submitted}
            placeholder="Document clinical rationale or justification for authorizing or denying this surge preemption..."
            className="mt-1.5 w-full rounded-xl border border-[#d8d0c0] bg-[#fbf9f4] px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {/* MODIFY - Disabled by contract */}
        <button
          type="button"
          data-testid="decision-modify-btn"
          disabled={true}
          title="Modification is not supported by the backend TrueForge approval contract."
          aria-disabled="true"
          className="cursor-not-allowed rounded-xl border border-stone-200 bg-[#f4efe4] px-3.5 py-2.5 font-mono text-xs font-bold text-stone-500"
        >
          MODIFY (NOT SUPPORTED BY CONTRACT)
        </button>

        {/* REJECT button */}
        <button
          type="button"
          data-testid="decision-reject-btn"
          disabled={disabled}
          onClick={() => handleDecision("REJECT")}
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 font-mono text-xs sm:text-[13px] font-extrabold uppercase tracking-wider text-rose-900 shadow-xs transition-all hover:bg-rose-100 hover:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "PROCESSING..." : "REJECT / DENY PREEMPTION"}
        </button>

        {/* APPROVE button - Deliberate interaction, not default focused */}
        <button
          type="button"
          data-testid="decision-approve-btn"
          disabled={disabled}
          onClick={() => handleDecision("APPROVE")}
          className="rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-2.5 font-mono text-xs sm:text-[13px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/30 transition-all hover:bg-emerald-500 hover:shadow-emerald-600/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "SUBMITTING AUTHORIZATION..." : "AUTHORIZE & EXECUTE ACTION"}
        </button>
      </div>

      {isSubmitting ? (
        <p
          data-testid="submission-in-progress"
          aria-live="assertive"
          className="text-right font-mono text-xs text-sky-400 animate-pulse"
        >
          Communicating decision to TrueForge checkpoint on backend...
        </p>
      ) : null}
    </div>
  );
}
