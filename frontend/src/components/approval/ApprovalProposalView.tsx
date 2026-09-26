import type { ApprovalProposal } from "@/types/domain";

export interface ApprovalProposalViewProps {
  readonly proposal: ApprovalProposal;
}

export function ApprovalProposalView({ proposal }: ApprovalProposalViewProps) {
  const targetAction =
    proposal.actionType || proposal.targetAction || proposal.actionId || "NOT PROVIDED BY BACKEND";
  const operationalRationale =
    proposal.reason || proposal.operationalRationale || "NOT PROVIDED BY BACKEND";
  const projectedImpact =
    proposal.potentialConsequence || proposal.projectedImpact || "NOT PROVIDED BY BACKEND";
  const affectedResources =
    proposal.affectedResources && proposal.affectedResources.length > 0
      ? proposal.affectedResources.join(", ")
      : proposal.affectedResource || "NOT PROVIDED BY BACKEND";

  const currentState = proposal.currentState || "NOT PROVIDED BY BACKEND";
  const expectedState = proposal.postActionState || "NOT PROVIDED BY BACKEND";

  return (
    <div
      data-testid="approval-proposal-view"
      className="space-y-4 rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 sm:p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece5d8] pb-3.5">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            Proposal Identifier:
          </span>{" "}
          <span data-testid="proposal-action-id" className="font-mono text-sm sm:text-base font-bold text-sky-800">
            {proposal.actionId || proposal.checkpointId || "NOT PROVIDED BY BACKEND"}
          </span>
        </div>
        <span className="rounded-md border border-red-300 bg-red-100 px-3 py-1 font-mono text-xs font-black uppercase tracking-wider text-red-900 shadow-xs">
          CONSEQUENTIAL MUTATION PROPOSAL
        </span>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* 1. Target Action */}
        <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-xs">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            1. Target Action
          </span>
          <p
            data-testid="proposal-target-action"
            className="mt-1 font-mono text-sm sm:text-base font-extrabold text-amber-800"
          >
            {targetAction}
          </p>
        </div>

        {/* 4. Affected Resources */}
        <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-xs">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            4. Affected Resources
          </span>
          <p
            data-testid="proposal-affected-resources"
            className="mt-1 font-mono text-sm sm:text-base font-extrabold text-stone-900"
          >
            {affectedResources}
          </p>
        </div>
      </div>

      {/* 2. Operational Rationale */}
      <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-xs">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
          2. Operational Rationale
        </span>
        <p
          data-testid="proposal-rationale"
          className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-stone-700 font-medium"
        >
          {operationalRationale}
        </p>
      </div>

      {/* 3. Projected Impact */}
      <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4 shadow-xs">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
          3. Projected Impact
        </span>
        <p
          data-testid="proposal-projected-impact"
          className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-stone-700 font-medium"
        >
          {projectedImpact}
        </p>
      </div>

      {/* 5 & 6. Current vs Expected Post-Action State */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-4">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-600">
            5. Current State
          </span>
          <div
            data-testid="proposal-current-state"
            className="mt-1.5 rounded-lg bg-white p-3 font-mono text-xs sm:text-[13px] text-stone-800 border border-[#e5dfd2]"
          >
            {currentState}
          </div>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-800">
            6. Expected / Post-Action State
          </span>
          <div
            data-testid="proposal-expected-state"
            className="mt-1.5 rounded-lg bg-white p-3 font-mono text-xs sm:text-[13px] text-amber-900 font-bold border border-amber-200"
          >
            {expectedState}
          </div>
        </div>
      </div>

      {/* 7. Required Decision / UI State */}
      <div className="rounded-xl border border-red-300 bg-red-50/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-ping" />
          <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider text-red-900">
            7. Required Decision & UI State
          </span>
        </div>
        <p
          data-testid="proposal-required-decision"
          className="mt-1.5 font-mono text-sm sm:text-base font-black tracking-wide text-red-950"
        >
          AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION
        </p>
        <p className="mt-1 text-xs sm:text-[13px] text-stone-700 font-medium">
          Execution loop is paused. Consequential mutation requires authenticated human authorization signal.
        </p>
      </div>
    </div>
  );
}
