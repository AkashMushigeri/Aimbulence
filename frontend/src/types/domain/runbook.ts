/**
 * Runbook and runbook-step domain models.
 *
 * PROVISIONAL — NOT YET BACKED BY A BACKEND CONTRACT.
 *
 * TODO(Member 2 -> Member 1): Member 1 has published no `Runbook` or
 * `RunbookStep` model and no runbook-inspection endpoint. The only documented
 * runbook contract is the planned execution response in
 * `origin/member-1:docs/api_contract.md` section 3.1, which exposes
 * `runbook_id`, `status`, `current_step`, `total_steps` and `active_checkpoint`
 * and nothing about step definitions.
 *
 * The step sequence below is derived from the 15-step `MCI-01` procedure listed
 * in `README.md` ("Mass-Casualty Response Runbook (`MCI-01`)"). Terminology is
 * reused verbatim from that document; no step was invented.
 *
 * These interfaces must be reconciled with Member 1's runbook schema before any
 * runbook visualizer UI is built. Do not treat them as an API contract.
 */
import type { SafetyTier } from "./safety";

export interface RunbookStep {
  /** 1-based position within the runbook sequence. */
  readonly index: number;
  /** Verbatim step title from the documented `MCI-01` procedure. */
  readonly title: string;
  /**
   * Safety tier the step's actions belong to. A step is not itself executed by
   * the agent; its actions are, and each carries its own tier.
   */
  readonly tier: SafetyTier;
  /**
   * True when this step halts execution and awaits a human decision
   * (`instruction.md` section 16).
   */
  readonly isApprovalCheckpoint: boolean;
}

export interface Runbook {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly totalSteps: number;
  readonly steps: readonly RunbookStep[];
}

export const ACTION_STATUSES = [
  "PROPOSED",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXECUTED",
  "REJECTED",
  "FAILED",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** PROVISIONAL. Mirrors `backend/app/models/actions.py::ActionProposal` / `ActionResponse`. */
export interface Action {
  readonly actionId: string;
  readonly name: string;
  readonly tier: SafetyTier;
  readonly description: string;
  /** Operational justification, including shortage context. Never clinical advice. */
  readonly rationale: string;
  readonly affectedResources: readonly string[];
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly requiresHumanApproval: boolean;
  readonly createdAt: string;
  readonly status: ActionStatus;
  readonly approvedBy?: string;
  readonly decisionNote?: string;
  readonly executedAt?: string;
  readonly executionResult?: Readonly<Record<string, unknown>>;
  /**
   * Post-action verification flag. Defaults to false; per
   * `instruction.md` section 17 a UI must never imply success without a
   * server-confirmed verification.
   */
  readonly verified: boolean;
}
