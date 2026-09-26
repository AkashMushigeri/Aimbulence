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
          classes: "border-emerald-300 bg-emerald-50 text-emerald-900 font-extrabold",
          dot: "bg-emerald-600",
        };
      case "FAILED":
        return {
          label: "VERIFICATION FAILED (STATE MISMATCH)",
          classes: "border-rose-300 bg-rose-50 text-rose-900 font-extrabold",
          dot: "bg-rose-600",
        };
      case "PENDING":
      default:
        return {
          label: "VERIFICATION PENDING",
          classes: "border-amber-300 bg-amber-50 text-amber-900 font-bold",
          dot: "bg-amber-600",
        };
    }
  };

  const { label, classes, dot } = getConfig();

  return (
    <span
      data-testid="verification-status-badge"
      data-verification-status={status}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs uppercase tracking-wide shadow-xs ${classes} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}
