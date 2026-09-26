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
      className="space-y-4 rounded-lg border border-surface-border bg-surface-raised p-4"
    >
      <div className="border-b border-surface-border/60 pb-3">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
          Proposal Identifier:
        </span>{" "}
        <span data-testid="proposal-action-id" className="font-mono text-sm font-semibold text-slate-200">
          {proposal.actionId || proposal.checkpointId || "NOT PROVIDED BY BACKEND"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 1. Target Action */}
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            1. Target Action
          </span>
          <p
            data-testid="proposal-target-action"
            className="mt-1 font-mono text-sm font-bold text-amber-300"
          >
            {targetAction}
          </p>
        </div>

        {/* 4. Affected Resources */}
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            4. Affected Resources
          </span>
          <p
            data-testid="proposal-affected-resources"
            className="mt-1 font-mono text-sm font-semibold text-slate-200"
          >
            {affectedResources}
          </p>
        </div>
      </div>

      {/* 2. Operational Rationale */}
      <div>
        <span className="text-xs uppercase tracking-wider text-slate-400">
          2. Operational Rationale
        </span>
        <p
          data-testid="proposal-rationale"
          className="mt-1 text-sm leading-relaxed text-slate-300"
        >
          {operationalRationale}
        </p>
      </div>

      {/* 3. Projected Impact */}
      <div>
        <span className="text-xs uppercase tracking-wider text-slate-400">
          3. Projected Impact
        </span>
        <p
          data-testid="proposal-projected-impact"
          className="mt-1 text-sm leading-relaxed text-slate-300"
        >
          {projectedImpact}
        </p>
      </div>

      {/* 5 & 6. Current vs Expected Post-Action State */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-surface-border/80 bg-surface/30 p-3">
          <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
            5. Current State
          </span>
          <div
            data-testid="proposal-current-state"
            className="mt-1 font-mono text-xs text-slate-300"
          >
            {currentState}
          </div>
        </div>

        <div className="rounded border border-amber-500/30 bg-amber-950/15 p-3">
          <span className="font-mono text-xs uppercase tracking-wider text-amber-400">
            6. Expected / Post-Action State
          </span>
          <div
            data-testid="proposal-expected-state"
            className="mt-1 font-mono text-xs text-amber-200"
          >
            {expectedState}
          </div>
        </div>
      </div>

      {/* 7. Required Decision / UI State */}
      <div className="rounded border border-red-500/40 bg-red-950/20 p-3">
        <span className="font-mono text-xs uppercase tracking-wider text-red-400">
          7. Required Decision & UI State
        </span>
        <p
          data-testid="proposal-required-decision"
          className="mt-1 font-mono text-xs font-bold text-red-300"
        >
          AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          Execution loop is paused. Consequential mutation requires authenticated human authorization signal.
        </p>
      </div>
    </div>
  );
}
