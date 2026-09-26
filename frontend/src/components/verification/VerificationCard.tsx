import type { ActionResult, VerificationResult } from "@/types/domain";
import { VerificationStatus } from "./VerificationStatus";

export interface VerificationCardProps {
  readonly action?: ActionResult | null;
  readonly verification: VerificationResult;
  readonly className?: string;
}

export function VerificationCard({ action, verification, className = "" }: VerificationCardProps) {
  const isVerified = verification.status === "VERIFIED";
  const isFailed = verification.status === "FAILED";

  return (
    <div
      data-testid="verification-card"
      className={`rounded-xl border p-5 transition-all ${
        isVerified
          ? "border-emerald-500/60 bg-emerald-950/20"
          : isFailed
          ? "border-rose-600/70 bg-rose-950/30"
          : "border-surface-border bg-surface/40"
      } ${className}`}
    >
      {/* 3-PHASE SEQUENCE INDICATOR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold tracking-wider">
          <span
            data-testid="phase-requested"
            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-slate-300"
          >
            <span>1.</span> ACTION REQUESTED
          </span>
          <span className="text-slate-600">→</span>
          <span
            data-testid="phase-executed"
            className={`flex items-center gap-1 rounded px-2 py-0.5 ${
              action?.status === "EXECUTED"
                ? "bg-blue-950/80 text-blue-300 border border-blue-500/40"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            <span>2.</span> ACTION EXECUTED
          </span>
          <span className="text-slate-600">→</span>
          <span
            data-testid="phase-verified"
            className={`flex items-center gap-1 rounded px-2 py-0.5 ${
              isVerified
                ? "bg-emerald-950/80 text-emerald-200 border border-emerald-500/60 font-black"
                : isFailed
                ? "bg-rose-950/80 text-rose-200 border border-rose-500/60 font-black"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            <span>3.</span> STATE VERIFIED
          </span>
        </div>

        <VerificationStatus status={verification.status} />
      </div>

      {/* SAFETY GOVERNANCE CALLOUT */}
      <div className="mb-4 rounded bg-surface-elevated/70 px-3 py-2 text-xs text-slate-300 border border-surface-border/60">
        <strong className="font-mono uppercase text-amber-300">Safety Principle:</strong>{" "}
        <span className="text-slate-300">
          Never treat execution success as verification. State verification requires an independent read from the connected operational store.
        </span>
      </div>

      {/* GRANULAR VERIFICATION EVIDENCE MATRIX */}
      <div className="grid gap-3 text-xs sm:grid-cols-2">
        <div className="space-y-1.5 rounded-lg border border-surface-border bg-surface/50 p-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Target Resource & Entity
          </span>
          <p className="font-mono text-sm font-semibold text-slate-100">
            <span data-testid="verified-target-entity">{verification.targetEntity}</span>:{" "}
            <span data-testid="verified-affected-resource" className="text-amber-300">
              {verification.entityId}
            </span>
          </p>
          <p className="font-mono text-[11px] text-slate-400">
            Inspected Field:{" "}
            <code className="rounded bg-surface-elevated px-1 py-0.5 text-slate-200">
              {verification.expectedField}
            </code>
          </p>
        </div>

        <div className="space-y-1.5 rounded-lg border border-surface-border bg-surface/50 p-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Verification Timestamp
          </span>
          <p
            data-testid="verification-timestamp"
            className="font-mono text-xs font-semibold text-slate-200"
          >
            {verification.timestamp ?? "AWAITING BACKEND VERIFICATION"}
          </p>
          {action?.authorizedBy && (
            <p className="font-mono text-[11px] text-slate-400">
              Authorized By: <strong className="text-slate-200">{action.authorizedBy}</strong>
            </p>
          )}
        </div>

        {/* Expected State */}
        <div className="space-y-1.5 rounded-lg border border-surface-border bg-surface/50 p-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Expected Operational State
          </span>
          <div
            data-testid="verification-expected-state"
            className="rounded bg-surface-elevated p-2 font-mono text-xs text-sky-200"
          >
            {typeof verification.expectedValue === "object"
              ? JSON.stringify(verification.expectedValue, null, 2)
              : String(verification.expectedValue)}
          </div>
        </div>

        {/* Observed State on Disk */}
        <div
          className={`space-y-1.5 rounded-lg border p-3 ${
            isVerified
              ? "border-emerald-500/40 bg-emerald-950/10"
              : isFailed
              ? "border-rose-500/40 bg-rose-950/10"
              : "border-surface-border bg-surface/50"
          }`}
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Observed State on Disk (SQLite)
          </span>
          <div
            data-testid="verification-observed-state"
            className={`rounded p-2 font-mono text-xs ${
              isVerified
                ? "bg-emerald-950/40 text-emerald-200 font-semibold"
                : isFailed
                ? "bg-rose-950/40 text-rose-200 font-semibold"
                : "bg-surface-elevated text-slate-300"
            }`}
          >
            {verification.observedValue === null
              ? "null (Not recorded)"
              : typeof verification.observedValue === "object"
              ? JSON.stringify(verification.observedValue, null, 2)
              : String(verification.observedValue)}
          </div>
        </div>
      </div>

      {/* State Mismatch or Error Banner */}
      {verification.mismatchError && (
        <div
          data-testid="verification-mismatch-error"
          className="mt-4 rounded-lg border border-rose-500/60 bg-rose-950/40 p-3 text-xs text-rose-200"
        >
          <div className="flex items-center gap-2 font-mono font-bold uppercase text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
            <span>State Mismatch / Discrepancy Detected</span>
          </div>
          <p className="mt-1 font-mono text-xs text-rose-200">{verification.mismatchError}</p>
        </div>
      )}
    </div>
  );
}
