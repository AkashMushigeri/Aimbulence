import type { ExecutionStatus as ExecutionStatusType } from "@/types/domain";

export interface ExecutionStatusProps {
  readonly status: ExecutionStatusType;
  readonly className?: string;
}

export function ExecutionStatus({ status, className = "" }: ExecutionStatusProps) {
  const getBadgeConfig = () => {
    switch (status) {
      case "RUNNING":
        return {
          label: "RUNNING",
          classes: "border-blue-500/50 bg-blue-500/15 text-blue-300 animate-pulse",
        };
      case "PAUSED":
      case "AWAITING_APPROVAL":
        return {
          label: "AGENT PAUSED · HUMAN AUTHORIZATION REQUIRED",
          classes: "border-red-500/60 bg-red-500/20 text-red-200 font-bold tracking-wider",
        };
      case "COMPLETED":
        return {
          label: "COMPLETED",
          classes: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-semibold",
        };
      case "FAILED":
        return {
          label: "FAILED",
          classes: "border-rose-600/60 bg-rose-500/20 text-rose-300 font-semibold",
        };
      case "REJECTED":
        return {
          label: "OPERATOR REJECTED",
          classes: "border-amber-500/50 bg-amber-500/15 text-amber-300",
        };
      case "HALTED":
        return {
          label: "HALTED",
          classes: "border-amber-500/50 bg-amber-500/15 text-amber-300",
        };
      case "VERIFIED":
        return {
          label: "STATE VERIFIED",
          classes: "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 font-semibold",
        };
      case "ESCALATED":
        return {
          label: "ESCALATED",
          classes: "border-purple-500/50 bg-purple-500/15 text-purple-300 font-semibold",
        };
      case "PENDING":
      case "IDLE":
      default:
        return {
          label: "PENDING",
          classes: "border-slate-700 bg-slate-800/80 text-slate-400",
        };
    }
  };

  const { label, classes } = getBadgeConfig();

  return (
    <span
      data-testid="execution-status-badge"
      data-execution-status={status}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${classes} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      <span>{label}</span>
    </span>
  );
}
