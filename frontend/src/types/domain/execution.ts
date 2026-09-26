/**
 * Agent execution lifecycle domain model.
 *
 * PROVISIONAL — derived from the planned Phase 3 contract in
 * `origin/member-1:docs/api_contract.md` section 3.1, which is tagged
 * `[PLANNED - PHASE 3]` and is therefore not yet served by the backend.
 *
 * TODO(Member 2 -> Member 1): the status values below are the UI-facing
 * vocabulary needed to render a paused agent. The only status string the
 * contract actually documents is "RUNNING". The remaining values describe
 * operator-visible lifecycle concepts named in `README.md` (Core Workflow,
 * demo flow step 7) and must be reconciled with Member 1's execution state
 * machine before the runbook visualizer is built.
 */
import type { AgentGateState } from "./approval";

export const EXECUTION_STATUSES = [
  /** Not started. */
  "IDLE",
  "PENDING",
  /** Contract-documented status for an in-flight execution. */
  "RUNNING",
  /** Halted at a RED checkpoint awaiting an operator decision. */
  "PAUSED",
  "AWAITING_APPROVAL",
  /** Finished with all steps executed and verified. */
  "COMPLETED",
  /** Halted by operator rejection; agent adapts or escalates. */
  "HALTED",
  "REJECTED",
  /** Stopped by a tool error; per `instruction.md` section 15 fails safe. */
  "FAILED",
  /** State verified on real connected system. */
  "VERIFIED",
  /** Escalated to higher human authority when deficits remain unresolved. */
  "ESCALATED",
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export interface AgentExecutionState {
  readonly executionId: string;
  readonly incidentId: string;
  readonly runbookId: string;
  readonly status: ExecutionStatus;
  readonly currentStep: number;
  readonly totalSteps: number;
  /**
   * Identifier of the checkpoint the agent is currently blocked on, or null
   * when no gate is active. Contract field: `active_checkpoint` / `checkpoint_id`.
   */
  readonly activeCheckpoint: string | null;
  readonly gateState: AgentGateState;
  readonly startedAt: string;
  readonly currentStepId?: string | null;
  readonly completedSteps?: readonly string[];
  readonly stepResults?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string | null;
  readonly completedAt?: string | null;
}

/** True when the agent is halted and must not advance without a human signal. */
export function isAgentBlocked(state: AgentExecutionState): boolean {
  return (
    state.status === "AWAITING_APPROVAL" ||
    state.status === "PAUSED" ||
    state.gateState === "AWAITING_OPERATOR"
  );
}

