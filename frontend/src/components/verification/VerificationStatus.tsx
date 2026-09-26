import type { VerificationStatus as VerificationStatusType } from "@/types/domain";

export interface VerificationStatusProps {
  readonly status: VerificationStatusType;
  readonly className?: string;
}

export function VerificationStatus({ status, className = "" }: VerificationStatusProps) {
  const getConfig = () => {
    switch (status) {
      case "VERIFIED":
        return {
          label: "STATE VERIFIED ON DISK",
          classes: "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 font-extrabold",
          dot: "bg-emerald-400",
        };
      case "FAILED":
        return {
          label: "VERIFICATION FAILED (STATE MISMATCH)",
          classes: "border-rose-500/60 bg-rose-500/20 text-rose-200 font-extrabold",
          dot: "bg-rose-400",
        };
      case "PENDING":
      default:
        return {
          label: "VERIFICATION PENDING",
          classes: "border-amber-500/50 bg-amber-500/15 text-amber-300 font-semibold",
          dot: "bg-amber-400",
        };
    }
  };

  const { label, classes, dot } = getConfig();

  return (
    <span
      data-testid="verification-status-badge"
      data-verification-status={status}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs uppercase tracking-wide ${classes} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}
