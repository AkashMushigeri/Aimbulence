import type { ApprovalProposal } from "@/types/domain";

export interface ImpactBriefingProps {
  readonly proposal: ApprovalProposal;
}

export function ImpactBriefing({ proposal }: ImpactBriefingProps) {
  const benefit = proposal.expectedBenefit || proposal.operationalRationale || "NOT PROVIDED BY BACKEND";
  const consequence = proposal.potentialConsequence || proposal.projectedImpact || "NOT PROVIDED BY BACKEND";
  const resource = proposal.affectedResource || (proposal.affectedResources?.[0] ?? "NOT PROVIDED BY BACKEND");

  return (
    <div
      data-testid="impact-briefing"
      className="space-y-3 rounded-lg border border-surface-border/80 bg-surface/40 p-4"
    >
      <div className="flex items-center justify-between border-b border-surface-border/60 pb-2">
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
          Operational Impact Briefing
        </h4>
        <span className="font-mono text-xs text-amber-400">
          Target Resource: <strong className="text-white">{resource}</strong>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Projected Surge Benefit
          </p>
          <p data-testid="impact-benefit" className="mt-1 text-sm text-slate-200">
            {benefit}
          </p>
        </div>

        <div className="rounded border border-rose-500/30 bg-rose-950/20 p-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-rose-400">
            Operational / Clinical Trade-off
          </p>
          <p data-testid="impact-consequence" className="mt-1 text-sm text-slate-200">
            {consequence}
          </p>
        </div>
      </div>
    </div>
  );
}
