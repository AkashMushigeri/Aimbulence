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
      className="space-y-3.5 rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 sm:p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece5d8] pb-3.5">
        <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-700">
          Operational Impact Briefing
        </h4>
        <span className="font-mono text-xs sm:text-sm text-amber-800 font-bold">
          Target Resource: <strong className="text-stone-900 font-black">{resource}</strong>
        </span>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 shadow-xs">
          <p className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-800">
            Projected Surge Benefit
          </p>
          <p data-testid="impact-benefit" className="mt-2 text-xs sm:text-sm leading-relaxed text-stone-900 font-medium">
            {benefit}
          </p>
        </div>

        <div className="rounded-xl border border-rose-300 bg-rose-50/70 p-4 shadow-xs">
          <p className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-800">
            Operational / Clinical Trade-off
          </p>
          <p data-testid="impact-consequence" className="mt-2 text-xs sm:text-sm leading-relaxed text-stone-900 font-medium">
            {consequence}
          </p>
        </div>
      </div>
    </div>
  );
}
