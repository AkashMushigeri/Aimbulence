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
/* Section 3.2 — POST /api/approval/decide        [PLANNED - PHASE 4]   */
/* Not served. Declared so the approval UI can be typed later.             */
/* ------------------------------------------------------------------ */

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
 * Endpoint path constants, transcribed verbatim from `docs/api_contract.md`.
 * Only `[IMPLEMENTED]` paths are safe to call today.
 */
export const API_PATHS = {
  HEALTH: "/api/health",
  HOSPITAL_STATUS: "/api/hospital/status",
  RESOURCES: "/api/resources",
  INCIDENTS: "/api/incidents",
  AUDIT_LOG: "/api/audit-log",
} as const;

/** Paths documented but not yet served by the backend. */
export const PLANNED_API_PATHS = {
  EXECUTE_RUNBOOK: "/api/agent/execute-runbook",
  APPROVAL_DECIDE: "/api/approval/decide",
} as const;
