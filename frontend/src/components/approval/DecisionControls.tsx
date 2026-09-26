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
      className="space-y-4 rounded-lg border border-surface-border bg-surface/50 p-4"
    >
      <div className="border-b border-surface-border/60 pb-2">
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
          Operator Human Decision Gate
        </h4>
        <p className="mt-0.5 text-xs text-slate-400">
          Consequential actions require deliberate human operator authentication before submission.
        </p>
      </div>

      {error ? (
        <div
          data-testid="decision-error-banner"
          role="alert"
          className="rounded border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200"
        >
          <strong className="font-semibold">Backend Decision Error: </strong>
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="operator-name-input"
            className="block text-xs font-medium uppercase tracking-wider text-slate-300"
          >
            Authorizing Human Authority <span className="text-red-400">*</span>
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
            className="mt-1 w-full rounded border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {!isValidOperator && operatorName.length > 0 ? (
            <p className="mt-1 text-xs text-rose-400">
              Authority name must be at least 2 characters.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="operator-reason-input"
            className="block text-xs font-medium uppercase tracking-wider text-slate-300"
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
            className="mt-1 w-full rounded border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
          className="cursor-not-allowed rounded border border-slate-700 bg-surface/30 px-3 py-2 text-xs font-semibold text-slate-500"
        >
          MODIFY (NOT SUPPORTED BY CONTRACT)
        </button>

        {/* REJECT button */}
        <button
          type="button"
          data-testid="decision-reject-btn"
          disabled={disabled}
          onClick={() => handleDecision("REJECT")}
          className="rounded border border-rose-500/60 bg-rose-950/40 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-rose-300 transition-colors hover:bg-rose-900/60 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "PROCESSING..." : "REJECT / DENY PREEMPTION"}
        </button>

        {/* APPROVE button - Deliberate interaction, not default focused */}
        <button
          type="button"
          data-testid="decision-approve-btn"
          disabled={disabled}
          onClick={() => handleDecision("APPROVE")}
          className="rounded border border-emerald-500/80 bg-emerald-600 px-5 py-2 font-mono text-xs font-extrabold uppercase tracking-wider text-slate-950 transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "SUBMITTING AUTHORIZATION..." : "AUTHORIZE & EXECUTE ACTION"}
        </button>
      </div>

      {isSubmitting ? (
        <p
          data-testid="submission-in-progress"
          aria-live="assertive"
          className="text-right font-mono text-xs text-sky-400"
        >
          Communicating decision to TrueForge checkpoint on backend...
        </p>
      ) : null}
    </div>
  );
}
