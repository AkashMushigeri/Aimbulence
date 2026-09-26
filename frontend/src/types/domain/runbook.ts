/**
 * Runbook and runbook-step domain models.
 */
import type { SafetyTier } from "./safety";

export type StepExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "PAUSED"
  | "SKIPPED"
  | "FAILED"
  | "BLOCKED"
  | "REJECTED";

export interface RunbookStep {
  /** 1-based position within the runbook sequence. */
  readonly index: number;
  /** Sequential step number (alias of index). */
  readonly stepNumber?: number;
  /** Verbatim step title from the documented `MCI-01` procedure. */
  readonly title: string;
  /** Step operational name. */
  readonly name?: string;
  /** Safety tier the step's actions belong to. */
  readonly tier: SafetyTier;
  /** Safety category classification. */
  readonly safetyCategory?: SafetyTier;
  /** True when this step halts execution and awaits a human decision. */
  readonly isApprovalCheckpoint: boolean;
  /** Execution status of the step. */
  readonly status?: StepExecutionStatus;
  /** Associated action tool name. */
  readonly actionTool?: string;
  /** Detailed operational purpose. */
  readonly description?: string;
  /** Verification payload or confirmed state. */
  readonly verification?: Readonly<Record<string, unknown>> | boolean | null;
  /** Error message if execution failed. */
  readonly error?: string | null;
}

export interface RunbookStepDetail {
  readonly stepId: string;
  readonly stepNumber: number;
  readonly name: string;
  readonly description: string;
  readonly safetyCategory: SafetyTier;
  readonly status: StepExecutionStatus;
  readonly actionTool: string;
  readonly isApprovalCheckpoint: boolean;
  readonly inputSource?: string;
  readonly expectedOutput?: string;
  readonly verificationRequirement?: string;
  readonly verification?: Readonly<Record<string, unknown>> | boolean | null;
  readonly error?: string | null;
  readonly startedAt?: string;
  readonly completedAt?: string | null;
}

export const MCI_01_STEP_DEFINITIONS: readonly RunbookStepDetail[] = [
  {
    stepId: "MCI-01-01",
    stepNumber: 1,
    name: "Receive Emergency Incident Alert",
    description: "Inspect database for incoming mass casualty dispatch report or verify existing emergency incident record.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "detect_incident",
    isApprovalCheckpoint: false,
    inputSource: "incident_id and incoming_casualties parameter",
    expectedOutput: "Validated incident_id, casualty count, location, and severity.",
    verificationRequirement: "Incident record exists in database.",
  },
  {
    stepId: "MCI-01-02",
    stepNumber: 2,
    name: "Validate Incident Parameters & Integrity",
    description: "Confirm casualty count, estimated time of arrival (ETA), severity level, and geographical triage location.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "verify_incident",
    isApprovalCheckpoint: false,
    inputSource: "Incident record from Step 1",
    expectedOutput: "Verified operational parameters: casualty_count >= 1, severity in [HIGH, CRITICAL].",
    verificationRequirement: "Valid casualty demand threshold.",
  },
  {
    stepId: "MCI-01-03",
    stepNumber: 3,
    name: "Assess Incident Severity & Projected Casualty Intake",
    description: "Query live persistent database for emergency department beds, intensive care beds, operating rooms, staff, and blood supply.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "get_hospital_capacity",
    isApprovalCheckpoint: false,
    inputSource: "Live operational database via Session",
    expectedOutput: "Live counts of available emergency beds, ICU beds, open ORs, staff on duty, ambulances, blood inventory.",
    verificationRequirement: "Hospital record and resource counts returned successfully.",
  },
  {
    stepId: "MCI-01-04",
    stepNumber: 4,
    name: "Query Hospital Operational Capacity (ED, ICU, OR)",
    description: "Compute acute deficits across beds, critical care, surgical suites, and blood units against incoming casualty demand.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "calculate_resource_shortage",
    isApprovalCheckpoint: false,
    inputSource: "Hospital capacity from Step 3 + incoming casualty count",
    expectedOutput: "Deficit matrix (emergency beds, ICU, ORs, blood) and critical shortage flag.",
    verificationRequirement: "Deficit calculations verified against live hospital baselines.",
  },
  {
    stepId: "MCI-01-05",
    stepNumber: 5,
    name: "Query Staff Availability & Register Task",
    description: "Persist the primary hospital-wide MCI response coordination task in the operational task registry.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "create_operational_task",
    isApprovalCheckpoint: false,
    inputSource: "Incident title, casualty count, incident_id",
    expectedOutput: "Created task_id in PENDING status.",
    verificationRequirement: "Operational task persisted in SQLite database.",
  },
  {
    stepId: "MCI-01-06",
    stepNumber: 6,
    name: "Inspect Critical Consumables & Blood Bank Reserves",
    description: "Enumerate granular status of emergency beds, surgical suites, transport ambulances, and blood inventory.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "get_resource_status",
    isApprovalCheckpoint: false,
    inputSource: "Live database resource tables",
    expectedOutput: "Catalog of specific available beds, ambulances, and operating rooms.",
    verificationRequirement: "Lists of specific resources ready for allocation.",
  },
  {
    stepId: "MCI-01-07",
    stepNumber: 7,
    name: "Stage Safe Available Resources",
    description: "Reserve available emergency bed (ED-01), dispatch available trauma ambulance (MEDIC-01), and reserve open surgical suite (OR-2).",
    safetyCategory: "YELLOW",
    status: "PENDING",
    actionTool: "stage_safe_resources",
    isApprovalCheckpoint: false,
    inputSource: "Resource inventory from Step 6",
    expectedOutput: "Reservations confirmed for ED-01, MEDIC-01, and OR-2 with audit entries.",
    verificationRequirement: "Resources verified reserved in SQLite.",
  },
  {
    stepId: "MCI-01-08",
    stepNumber: 8,
    name: "Compute Projected Deficits & Remaining Shortages",
    description: "Recompute resource balance after staging all immediately available safe capacity to determine residual unmet demand.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "recalculate_shortages",
    isApprovalCheckpoint: false,
    inputSource: "Updated capacity post-Step 7 staging",
    expectedOutput: "Residual deficit matrix highlighting remaining unmet surgical capacity.",
    verificationRequirement: "Remaining OR deficit calculated.",
  },
  {
    stepId: "MCI-01-09",
    stepNumber: 9,
    name: "Synthesize Phased Response Plan",
    description: "Assess whether residual surgical deficit demands preempting an occupied operating room scheduled for elective surgery (OR-3).",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "identify_red_action",
    isApprovalCheckpoint: false,
    inputSource: "Residual shortages from Step 8 and OR inventory from Step 6",
    expectedOutput: "Identification of OR-3 (Elective Arthroscopic Knee Debridement) as the required preemption target.",
    verificationRequirement: "Consequential action necessity confirmed (OR deficit > 0).",
  },
  {
    stepId: "MCI-01-10",
    stepNumber: 10,
    name: "Halt at Consequential Action Checkpoint [RED]",
    description: "Generate structured RedActionProposal to preempt OR-3 and halt execution at the TrueForge approval checkpoint awaiting human decision.",
    safetyCategory: "RED",
    status: "PENDING",
    actionTool: "propose_and_pause_red_action",
    isApprovalCheckpoint: true,
    inputSource: "Target resource OR-3, incident_id, and clinical trade-offs",
    expectedOutput: "TrueForge checkpoint created in tool.approval_required state; Runbook transitions to WAITING_FOR_APPROVAL.",
    verificationRequirement: "Audit record CHECKPOINT_CREATED in SQLite.",
  },
  {
    stepId: "MCI-01-11",
    stepNumber: 11,
    name: "Present Authorization Request with Impact Briefing",
    description: "Deliver structured impact briefing and risk trade-off parameters to the human supervisor.",
    safetyCategory: "RED",
    status: "PENDING",
    actionTool: "present_authorization_request",
    isApprovalCheckpoint: true,
    inputSource: "RedActionProposal from Step 10",
    expectedOutput: "Operator console authorization card rendered with full clinical justification and impact assessment.",
    verificationRequirement: "Authorization request rendered to human supervisor.",
  },
  {
    stepId: "MCI-01-12",
    stepNumber: 12,
    name: "Await Human Decision",
    description: "Halt execution state machine until authenticated supervisor submits approval decision.",
    safetyCategory: "RED",
    status: "PENDING",
    actionTool: "await_human_decision",
    isApprovalCheckpoint: true,
    inputSource: "Supervisor action in operator console",
    expectedOutput: "Operator decision submitted via TrueForge governance checkpoint.",
    verificationRequirement: "Cryptographic human authorization token issued.",
  },
  {
    stepId: "MCI-01-13",
    stepNumber: 13,
    name: "Execute Approved Consequential Action",
    description: "Inspect TrueForge approval decision. If authorized, consume single-use token and mutate OR-3 to RESERVED_FOR_TRAUMA.",
    safetyCategory: "RED",
    status: "PENDING",
    actionTool: "execute_approved_consequential_action",
    isApprovalCheckpoint: true,
    inputSource: "Checkpoint decision and authorization token from Step 12",
    expectedOutput: "OR-3 mutated to RESERVED_FOR_TRAUMA (if approved) OR runbook marked BLOCKED without mutation (if denied).",
    verificationRequirement: "Authorization token validated and consumed on execution.",
  },
  {
    stepId: "MCI-01-14",
    stepNumber: 14,
    name: "Verify Operational State on Real Connected System",
    description: "Perform direct database verification to confirm OR-3 status is RESERVED_FOR_TRAUMA and emergency clearance flag is active on disk.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "verify_consequential_state",
    isApprovalCheckpoint: false,
    inputSource: "Target resource OR-3 and database state",
    expectedOutput: "State verification confirmed on disk (status == RESERVED_FOR_TRAUMA, is_emergency_cleared == True).",
    verificationRequirement: "verify_operational_status returns verified=True.",
  },
  {
    stepId: "MCI-01-15",
    stepNumber: 15,
    name: "Log Immutable Audit Record & Escalate if Necessary",
    description: "Synthesize operational runbook audit trail, resource metrics, approval decisions, and final surge readiness report.",
    safetyCategory: "GREEN",
    status: "PENDING",
    actionTool: "generate_execution_summary",
    isApprovalCheckpoint: false,
    inputSource: "Execution context across all completed steps",
    expectedOutput: "Comprehensive JSON summary report containing operational timeline, resources allocated, audit hashes, and final status.",
    verificationRequirement: "Final execution state persisted in SQLite as COMPLETED.",
  },
] as const;

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
