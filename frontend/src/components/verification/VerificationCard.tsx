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
      className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-all ${
        isVerified
          ? "border-emerald-400 bg-gradient-to-b from-emerald-50/80 via-[#fffdf9] to-[#fffdf9]"
          : isFailed
          ? "border-rose-400 bg-gradient-to-b from-rose-50/80 via-[#fffdf9] to-[#fffdf9]"
          : "border-[#e5dfd2] bg-[#fffdf9]"
      } ${className}`}
    >
      {/* 3-PHASE SEQUENCE INDICATOR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#ece5d8] pb-3.5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold tracking-wider">
          <span
            data-testid="phase-requested"
            className="flex items-center gap-1.5 rounded-md border border-[#d8d0c0] bg-[#fbf9f4] px-3 py-1 text-stone-700 shadow-xs"
          >
            <span className="font-black text-stone-500">1.</span> ACTION REQUESTED
          </span>
          <span className="text-stone-400 font-bold">→</span>
          <span
            data-testid="phase-executed"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition-all ${
              action?.status === "EXECUTED"
                ? "bg-sky-50 text-sky-800 border border-sky-300 shadow-xs font-bold"
                : "bg-[#ede7dc] text-stone-600 border border-[#e5dfd2]"
            }`}
          >
            <span className="font-black">2.</span> ACTION EXECUTED
          </span>
          <span className="text-stone-400 font-bold">→</span>
          <span
            data-testid="phase-verified"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition-all ${
              isVerified
                ? "bg-emerald-50 text-emerald-800 border-2 border-emerald-500 font-black shadow-xs"
                : isFailed
                ? "bg-rose-50 text-rose-800 border-2 border-rose-500 font-black shadow-xs"
                : "bg-[#ede7dc] text-stone-600 border border-[#e5dfd2]"
            }`}
          >
            {isVerified && <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />}
            {isFailed && <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />}
            <span className="font-black">3.</span> STATE VERIFIED
          </span>
        </div>

        <VerificationStatus status={verification.status} />
      </div>

      {/* SAFETY GOVERNANCE CALLOUT */}
      <div className="mb-4 rounded-xl bg-[#fbf9f4] px-4 py-3 text-xs sm:text-[13px] text-stone-700 border border-[#e5dfd2] shadow-xs">
        <strong className="font-mono uppercase text-amber-800 font-extrabold tracking-wide">Safety Principle:</strong>{" "}
        <span className="text-stone-700 font-medium">
          Never treat execution success as verification. State verification requires an independent read from the connected operational store.
        </span>
      </div>

      {/* GRANULAR VERIFICATION EVIDENCE MATRIX */}
      <div className="grid gap-3 text-xs sm:text-[13px] sm:grid-cols-2">
        <div className="space-y-1.5 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-xs">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            Target Resource & Entity
          </span>
          <p className="font-mono text-sm sm:text-base font-bold text-stone-900">
            <span data-testid="verified-target-entity">{verification.targetEntity}</span>:{" "}
            <span data-testid="verified-affected-resource" className="text-amber-800 font-black">
              {verification.entityId}
            </span>
          </p>
          <p className="font-mono text-xs text-stone-600">
            Inspected Field:{" "}
            <code className="rounded bg-[#ede7dc] px-2 py-0.5 text-stone-800 font-bold border border-[#e5dfd2]">
              {verification.expectedField}
            </code>
          </p>
        </div>

        <div className="space-y-1.5 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-xs">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            Verification Timestamp
          </span>
          <p
            data-testid="verification-timestamp"
            className="font-mono text-xs sm:text-sm font-bold text-stone-800"
          >
            {verification.timestamp ?? "AWAITING BACKEND VERIFICATION"}
          </p>
          {action?.authorizedBy && (
            <p className="font-mono text-xs text-stone-600">
              Authorized By: <strong className="text-stone-900 font-bold">{action.authorizedBy}</strong>
            </p>
          )}
        </div>

        {/* Expected State */}
        <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50/70 p-4 shadow-xs">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-800">
            Expected Operational State
          </span>
          <div
            data-testid="verification-expected-state"
            className="rounded-lg bg-white/90 p-3 font-mono text-xs sm:text-sm text-sky-950 font-bold border border-sky-300"
          >
            {typeof verification.expectedValue === "object"
              ? JSON.stringify(verification.expectedValue, null, 2)
              : String(verification.expectedValue)}
          </div>
        </div>

        {/* Observed State on Disk */}
        <div
          className={`space-y-1.5 rounded-xl border p-4 shadow-xs ${
            isVerified
              ? "border-emerald-300 bg-emerald-50/70"
              : isFailed
              ? "border-rose-300 bg-rose-50/70"
              : "border-[#e5dfd2] bg-[#fbf9f4]"
          }`}
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            Observed State on Disk (SQLite)
          </span>
          <div
            data-testid="verification-observed-state"
            className={`rounded-lg p-3 font-mono text-xs sm:text-sm font-bold border ${
              isVerified
                ? "bg-white/90 text-emerald-950 border-emerald-400"
                : isFailed
                ? "bg-white/90 text-rose-950 border-rose-400"
                : "bg-white text-stone-800 border-[#e5dfd2]"
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
          className="mt-4 rounded-xl border border-rose-500/60 bg-rose-950/40 p-3.5 text-xs text-rose-200 shadow-md shadow-rose-950/30"
        >
          <div className="flex items-center gap-2 font-mono font-bold uppercase text-rose-300 tracking-wider">
            <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
            <span>State Mismatch / Discrepancy Detected</span>
          </div>
          <p className="mt-1 font-mono text-xs text-rose-200 leading-relaxed">{verification.mismatchError}</p>
        </div>
      )}
    </div>
  );
}
