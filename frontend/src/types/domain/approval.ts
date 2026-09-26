/**
 * Human-in-the-loop approval domain models.
 *
 * PARTIALLY PROVISIONAL.
 *
 * The seven proposal fields below are mandated by `instruction.md` section 16
 * ("Approval Checkpoint Specifications") and are therefore authoritative.
 * The transport shape of the decision endpoint is documented in
 * `origin/member-1:docs/api_contract.md` section 3.2 but tagged
 * `[PLANNED - PHASE 4]` — the endpoint does not exist yet.
 *
 * TODO(Member 2 -> Member 1): reconcile `ApprovalProposal` with whatever
 * checkpoint model the approval engine emits in Phase 4. This frontend must
 * never construct, infer or pre-fill a decision.
 */
import type { SafetyTier } from "./safety";

/** The three decisions an operator may take. Exhaustive by contract. */
export const APPROVAL_DECISIONS = ["APPROVE", "MODIFY", "REJECT"] as const;

export type ApprovalDecisionType = (typeof APPROVAL_DECISIONS)[number];

/** Section 16.7: the dashboard must visibly indicate the agent is paused. */
export const AGENT_GATE_STATES = ["AWAITING_OPERATOR", "NOT_BLOCKED"] as const;

export type AgentGateState = (typeof AGENT_GATE_STATES)[number];

export interface ApprovalProposal {
  /** 1. Target action being authorized. */
  readonly targetAction: string;
  /** 2. Operational rationale, e.g. the quantified capacity deficit. */
  readonly operationalRationale: string;
  /** 3. Projected impact on resources that will be modified or diverted. */
  readonly projectedImpact: string;
  /** 4. Explicit listing of affected hospital units. */
  readonly affectedResources: readonly string[];
  /** 5. Current vs. post-action state, before and after. */
  readonly currentState: string;
  readonly postActionState: string;
  /** Safety tier of the proposed action. RED actions always reach this gate. */
  readonly tier: SafetyTier;
  /** 6. Options presented to the operator. */
  readonly availableDecisions: readonly ApprovalDecisionType[];
  /** 7. UI state: the agent is halted pending human input. */
  readonly gateState: AgentGateState;
  /** Contract-supplied identifiers, once the Phase 4 endpoint exists. */
  readonly checkpointId?: string;
  readonly actionId?: string;
  /** Backend-provided granular fields */
  readonly actionType?: string;
  readonly reason?: string;
  readonly expectedBenefit?: string;
  readonly potentialConsequence?: string;
  readonly affectedResource?: string;
  readonly currentStateDetails?: Readonly<Record<string, unknown>>;
  readonly proposedStateDetails?: Readonly<Record<string, unknown>>;
  readonly incidentId?: string | null;
  readonly requiresHumanApproval?: boolean;
}

export interface ApprovalDecision {
  /** Contract field: `checkpoint_id`. */
  readonly checkpointId: string;
  /** Contract field: `action_id`. */
  readonly actionId: string;
  /** Contract field: `decision`. */
  readonly decision: ApprovalDecisionType;
  /** Contract field: `operator_notes`. */
  readonly operatorNotes?: string;
}

export interface ConsequentialExecutionResult {
  readonly status: string;
  readonly checkpointId: string;
  readonly actionId: string;
  readonly resource: string;
  readonly decision: string;
  readonly authorizedBy: string;
  readonly executedAt: string;
  readonly previousState: Readonly<Record<string, unknown>>;
  readonly newState: Readonly<Record<string, unknown>>;
  readonly verification: Readonly<Record<string, unknown>>;
  readonly auditRecorded: boolean;
}

export interface ResolvedCheckpointResult {
  readonly status: string;
  readonly checkpointId: string;
  readonly state: string;
  readonly decision: string;
  readonly decisionBy?: string | null;
  readonly reason?: string | null;
  readonly executed: boolean;
  readonly verified: boolean;
  readonly execution?: ConsequentialExecutionResult | null;
}

