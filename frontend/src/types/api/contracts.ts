/**
 * API transport contracts.
 *
 * SOURCE OF TRUTH: `docs/api_contract.md` on branch `member-1`
 * (commit a06f891 / c33db4a), cross-read against
 * `backend/app/api/routes/*.py` and `backend/app/models/*.py`.
 *
 * Every interface below mirrors a contract that Member 1 has actually
 * documented. Nothing in this file is invented. Endpoints are grouped by the
 * status tag Member 1 assigned them:
 *
 *   [IMPLEMENTED]            — served today by the running FastAPI app.
 *   [PLANNED - PHASE 3/4]    — documented shape only; NOT yet served.
 *                             The UI must not assume these resolve.
 *
 * There is NO WebSocket contract in `docs/api_contract.md`. The backend
 * exposes REST only. No streaming/event interface is declared here, and none
 * may be invented (Phase 1 scope, `instruction.md` section 14).
 */

/* ------------------------------------------------------------------ */
/* Section 2.1 — GET /api/health                            [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  readonly status: string;
  readonly service: string;
  readonly database: string;
  readonly environment: string;
  readonly timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Section 2.2 — GET /api/hospital/status                   [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export type EmergencyCodeWire = "NORMAL" | "CODE_YELLOW" | "CODE_ORANGE" | "CODE_RED";

export type DepartmentTypeWire =
  | "EMERGENCY"
  | "ICU"
  | "SURGERY"
  | "TRAUMA"
  | "GENERAL_WARD"
  | "BLOOD_BANK";

export interface DepartmentStatusWire {
  readonly name: string;
  readonly department_type: DepartmentTypeWire;
  readonly total_beds: number;
  readonly available_beds: number;
  readonly occupied_beds: number;
  readonly staff_on_duty: number;
  readonly status_note: string | null;
}

export interface HospitalStatusWire {
  readonly hospital_name: string;
  readonly operational_code: EmergencyCodeWire;
  readonly emergency_beds_available: number;
  readonly emergency_beds_total: number;
  readonly icu_beds_available: number;
  readonly icu_beds_total: number;
  readonly operating_rooms_available: number;
  readonly operating_rooms_total: number;
  readonly doctors_available: number;
  readonly nurses_available: number;
  readonly ambulances_available: number;
  readonly blood_units_available: number;
  readonly active_incidents_count: number;
  readonly last_updated: string;
  readonly departments: readonly DepartmentStatusWire[];
}

/* ------------------------------------------------------------------ */
/* Section 2.3 — GET /api/resources                         [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export type BedTypeWire = "EMERGENCY" | "ICU" | "SURGICAL" | "GENERAL";

export type OperatingRoomStatusWire = "OPEN" | "IN_USE" | "RESERVED_FOR_TRAUMA" | "MAINTENANCE";

export type StaffRoleWire = "DOCTOR" | "TRAUMA_SURGEON" | "NURSE" | "PARAMEDIC" | "ANESTHESIOLOGIST";

export type AmbulanceStatusWire = "AVAILABLE" | "DISPATCHED" | "RETURNING" | "MAINTENANCE";

export type BloodTypeWire =
  | "O_NEG"
  | "O_POS"
  | "A_NEG"
  | "A_POS"
  | "B_NEG"
  | "B_POS"
  | "AB_NEG"
  | "AB_POS";

export interface BedWire {
  readonly id: string;
  readonly bed_code: string;
  readonly bed_type: BedTypeWire;
  readonly department: string;
  readonly is_occupied: boolean;
  readonly is_reserved: boolean;
}

export interface OperatingRoomWire {
  readonly id: string;
  readonly room_number: string;
  readonly status: OperatingRoomStatusWire;
  readonly scheduled_procedure: string | null;
  readonly is_emergency_cleared: boolean;
}

export interface StaffWire {
  readonly id: string;
  readonly name: string;
  readonly role: StaffRoleWire;
  readonly department: string;
  readonly is_on_duty: boolean;
  readonly is_assigned: boolean;
}

export interface AmbulanceWire {
  readonly id: string;
  readonly vehicle_code: string;
  readonly status: AmbulanceStatusWire;
  readonly crew_assigned: boolean;
}

export interface BloodInventoryWire {
  readonly id: string;
  readonly blood_type: BloodTypeWire;
  readonly units_available: number;
  readonly minimum_threshold: number;
}

export interface ResourceStatusWire {
  readonly summary: Readonly<Record<string, number>>;
  readonly beds: readonly BedWire[];
  readonly operating_rooms: readonly OperatingRoomWire[];
  readonly staff: readonly StaffWire[];
  readonly ambulances: readonly AmbulanceWire[];
  readonly blood_inventory: readonly BloodInventoryWire[];
  readonly last_updated: string;
}

/* ------------------------------------------------------------------ */
/* Section 2.4/2.5 — POST & GET /api/incidents              [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export type IncidentTypeWire =
  | "MASS_CASUALTY_COLLISION"
  | "TRANSIT_ACCIDENT"
  | "STRUCTURAL_COLLAPSE"
  | "HAZMAT"
  | "OTHER";

export type IncidentSeverityWire = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IncidentStatusWire = "REPORTED" | "TRIAGING" | "MOBILIZING" | "RESOLVED" | "CANCELLED";

export interface IncidentCreateWire {
  readonly title: string;
  readonly incident_type: IncidentTypeWire;
  readonly severity: IncidentSeverityWire;
  readonly casualty_count: number;
  readonly location: string;
  readonly eta_minutes: number;
  readonly description?: string;
}

export interface IncidentWire {
  readonly id: string;
  readonly title: string;
  readonly incident_type: IncidentTypeWire;
  readonly severity: IncidentSeverityWire;
  readonly casualty_count: number;
  readonly location: string;
  readonly eta_minutes: number;
  readonly description: string | null;
  readonly status: IncidentStatusWire;
  readonly created_at: string;
  readonly updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Section 2.6 — GET /api/audit-log                         [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export type SafetyTierWire = "GREEN" | "YELLOW" | "RED";

export interface AuditEventWire {
  readonly id: string;
  readonly incident_id: string | null;
  readonly event_type: string;
  readonly action_name: string | null;
  readonly tier: SafetyTierWire | null;
  readonly details: Readonly<Record<string, unknown>>;
  readonly performed_by: string;
  readonly timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Section 3.1 — POST /api/agent/execute-runbook   [PLANNED - PHASE 3]   */
/* Not served. Declared so the runbook visualizer can be typed later.       */
/* ------------------------------------------------------------------ */

export type RunbookExecutionStatusWire = "RUNNING" | (string & {});

export interface RunbookExecutionRequestWire {
  readonly incident_id: string;
  readonly runbook_id: string;
  readonly auto_execute_green: boolean;
}

export interface RunbookExecutionResponseWire {
  readonly execution_id: string;
  readonly incident_id: string;
  readonly runbook_id: string;
  readonly status: RunbookExecutionStatusWire;
  readonly current_step: number;
  readonly total_steps: number;
  readonly active_checkpoint: string | null;
  readonly started_at: string;
}

/* ------------------------------------------------------------------ */
/* Phase 4 — TrueForge Human Approval Checkpoints      [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export type CheckpointStateWire =
  | "tool.approval_required"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTED"
  | "FAILED";

export type ApprovalDecisionTypeWire = "allow" | "deny" | "APPROVE" | "REJECT";

export interface RedActionProposalWire {
  readonly action_id: string;
  readonly action_type: string;
  readonly risk_level: string;
  readonly safety_category: string;
  readonly affected_resource: string;
  readonly current_state: Readonly<Record<string, unknown>>;
  readonly proposed_state: Readonly<Record<string, unknown>>;
  readonly reason: string;
  readonly expected_benefit: string;
  readonly potential_consequence: string;
  readonly requires_human_approval: boolean;
  readonly incident_id?: string | null;
  readonly created_at: string;
}

export interface TrueForgeApprovalCheckpointWire {
  readonly checkpoint_id: string;
  readonly thread_id: string;
  readonly tool_call_id: string;
  readonly proposal: RedActionProposalWire;
  readonly state: CheckpointStateWire;
  readonly authorization_token?: string | null;
  readonly token_consumed: boolean;
  readonly decision_by?: string | null;
  readonly decision_reason?: string | null;
  readonly created_at: string;
  readonly resolved_at?: string | null;
  readonly executed_at?: string | null;
  readonly execution_result?: Readonly<Record<string, unknown>> | null;
}

export interface DecideRequestWire {
  readonly checkpoint_id: string;
  readonly decision: ApprovalDecisionTypeWire;
  readonly decision_by: string;
  readonly reason?: string | null;
  readonly execute_if_approved?: boolean;
}

export interface ConsequentialExecutionResultWire {
  readonly status: string;
  readonly checkpoint_id: string;
  readonly action_id: string;
  readonly resource: string;
  readonly decision: string;
  readonly authorized_by: string;
  readonly executed_at: string;
  readonly previous_state: Readonly<Record<string, unknown>>;
  readonly new_state: Readonly<Record<string, unknown>>;
  readonly verification: Readonly<Record<string, unknown>>;
  readonly audit_recorded: boolean;
}

export interface DecideResponseWire {
  readonly status: string;
  readonly checkpoint: TrueForgeApprovalCheckpointWire;
  readonly execution: ConsequentialExecutionResultWire | null;
}

/* Backward-compatibility types for previous draft contracts */
export type ApprovalDecisionWire = "APPROVE" | "MODIFY" | "REJECT";

export interface ApprovalDecisionRequestWire {
  readonly checkpoint_id: string;
  readonly action_id: string;
  readonly decision: ApprovalDecisionWire;
  readonly operator_notes?: string;
}

export interface ApprovalDecisionResponseWire {
  readonly checkpoint_id: string;
  readonly decision: ApprovalDecisionWire;
  readonly status: string;
  readonly verified: boolean;
  readonly resumed_runbook_step: number;
  readonly processed_at: string;
}

/* ------------------------------------------------------------------ */
/* Phase 5 — MCI-01 Runbook Execution Engine           [IMPLEMENTED] */
/* ------------------------------------------------------------------ */

export type RunbookWireState =
  | "PENDING"
  | "RUNNING"
  | "WAITING_FOR_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | (string & {});

export type StepWireStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "SKIPPED"
  | "WAITING_FOR_APPROVAL"
  | "FAILED"
  | "BLOCKED"
  | (string & {});

export interface RunbookStepResultWire {
  readonly step_id: string;
  readonly step_number: number;
  readonly name: string;
  readonly safety_category: SafetyTierWire;
  readonly status: StepWireStatus;
  readonly input_summary?: Readonly<Record<string, unknown>>;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly verification?: Readonly<Record<string, unknown>> | null;
  readonly error?: string | null;
  readonly started_at?: string;
  readonly completed_at?: string | null;
}

export interface RunbookExecutionStateWire {
  readonly execution_id: string;
  readonly runbook_id: string;
  readonly incident_id: string;
  readonly state: RunbookWireState;
  readonly current_step_id?: string | null;
  readonly checkpoint_id?: string | null;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly completed_steps?: readonly string[];
  readonly step_results?: Readonly<Record<string, RunbookStepResultWire | Record<string, unknown>>>;
  readonly summary?: Readonly<Record<string, unknown>> | null;
  readonly error_message?: string | null;
  readonly started_at: string;
  readonly updated_at?: string;
  readonly completed_at?: string | null;
}

export type RunbookStateWire = RunbookWireState;
export type StepStatusWire = StepWireStatus;

export interface StartRunbookRequestWire {
  readonly incident_id?: string;
  readonly incoming_casualties?: number;
  readonly acute_ratio?: number;
}

export interface StartRunbookResponseWire {
  readonly runbook_execution_id: string;
  readonly runbook_id: string;
  readonly incident_id: string;
  readonly state: RunbookStateWire;
  readonly current_step: string | null;
  readonly checkpoint_id: string | null;
  readonly message: string;
}

export interface ResumeRunbookRequestWire {
  readonly reason?: string;
}

/* ------------------------------------------------------------------ */
/* Error envelopes — from `backend/app/main.py` exception handlers        */
/* ------------------------------------------------------------------ */

/** FastAPI `HTTPException` shape: `{ "detail": ... }`, detail may be a string or object. */
export interface ApiErrorDetailWire {
  readonly detail: string | Readonly<Record<string, unknown>>;
}

/** Structured 422 from the project's `RequestValidationError` handler. */
export interface ApiValidationErrorWire {
  readonly detail: string;
  readonly errors: readonly {
    readonly field: string;
    readonly message: string;
    readonly type: string;
  }[];
}

/**
 * Endpoint path constants, transcribed verbatim from backend routes and contracts.
 */
export const API_PATHS = {
  HEALTH: "/api/health",
  HOSPITAL_STATUS: "/api/hospital/status",
  RESOURCES: "/api/resources",
  INCIDENTS: "/api/incidents",
  AUDIT_LOG: "/api/audit-log",
  APPROVAL_DECIDE: "/api/approval/decide",
  APPROVAL_CHECKPOINTS: "/api/approval/checkpoints",
  RUNBOOKS_START_MCI: "/api/runbooks/mci/start",
  RUNBOOKS_LATEST: "/api/runbooks/latest",
  RUNBOOKS_LIST: "/api/runbooks",
  RUNBOOKS_EXECUTION: (executionId: string) => `/api/runbooks/${executionId}`,
  RUNBOOKS_RESUME: (executionId: string) => `/api/runbooks/${executionId}/resume`,
} as const;

/** Legacy / planned endpoint reference */
export const PLANNED_API_PATHS = {
  EXECUTE_RUNBOOK: "/api/agent/execute-runbook",
  APPROVAL_DECIDE: "/api/approval/decide",
  RUNBOOK_STATUS: "/api/runbooks",
} as const;
