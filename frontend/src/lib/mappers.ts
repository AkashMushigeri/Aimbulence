/**
 * Wire -> domain mappers.
 *
 * Each mapper converts a Member 1 transport contract
 * (`origin/member-1:docs/api_contract.md`, snake_case) into the camelCase
 * domain shape the UI consumes. Field names here are transcribed from that
 * document; no field is guessed.
 *
 * These are pure functions with no I/O, so they are safe to unit test without a
 * running backend.
 */
import type {
  AuditEventWire,
  BloodInventoryWire,
  DepartmentStatusWire,
  HospitalStatusWire,
  IncidentWire,
  ResourceStatusWire,
} from "@/types/api/contracts";
import type {
  AuditEvent,
  BloodInventory,
  DepartmentStatus,
  HospitalCapacity,
  Incident,
  ResourceStatus,
  StaffAvailability,
  StaffMember,
} from "@/types/domain";

function required<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) {
    throw new TypeError(`Contract violation: expected non-null value for "${field}"`);
  }
  return value;
}

export function toDepartmentStatus(wire: DepartmentStatusWire): DepartmentStatus {
  return {
    name: required(wire.name, "departments[].name"),
    departmentType: required(wire.department_type, "departments[].department_type"),
    totalBeds: required(wire.total_beds, "departments[].total_beds"),
    availableBeds: required(wire.available_beds, "departments[].available_beds"),
    occupiedBeds: required(wire.occupied_beds, "departments[].occupied_beds"),
    staffOnDuty: required(wire.staff_on_duty, "departments[].staff_on_duty"),
    ...(wire.status_note ? { statusNote: wire.status_note } : {}),
  };
}

export function toHospitalCapacity(wire: HospitalStatusWire): HospitalCapacity {
  return {
    hospitalName: required(wire.hospital_name, "hospital_name"),
    operationalCode: required(wire.operational_code, "operational_code"),
    emergencyBedsAvailable: required(wire.emergency_beds_available, "emergency_beds_available"),
    emergencyBedsTotal: required(wire.emergency_beds_total, "emergency_beds_total"),
    icuBedsAvailable: required(wire.icu_beds_available, "icu_beds_available"),
    icuBedsTotal: required(wire.icu_beds_total, "icu_beds_total"),
    operatingRoomsAvailable: required(wire.operating_rooms_available, "operating_rooms_available"),
    operatingRoomsTotal: required(wire.operating_rooms_total, "operating_rooms_total"),
    doctorsAvailable: required(wire.doctors_available, "doctors_available"),
    nursesAvailable: required(wire.nurses_available, "nurses_available"),
    ambulancesAvailable: required(wire.ambulances_available, "ambulances_available"),
    bloodUnitsAvailable: required(wire.blood_units_available, "blood_units_available"),
    // Backend field is `active_incidents_count` (plural) per the contract.
    activeIncidentCount: required(wire.active_incidents_count, "active_incidents_count"),
    lastUpdated: required(wire.last_updated, "last_updated"),
    departments: wire.departments.map(toDepartmentStatus),
  };
}

export function toStaffMember(wire: ResourceStatusWire["staff"][number]): StaffMember {
  return {
    id: required(wire.id, "staff[].id"),
    name: required(wire.name, "staff[].name"),
    role: required(wire.role, "staff[].role"),
    department: required(wire.department, "staff[].department"),
    isOnDuty: required(wire.is_on_duty, "staff[].is_on_duty"),
    isAssigned: required(wire.is_assigned, "staff[].is_assigned"),
  };
}

function toBloodInventory(wire: BloodInventoryWire): BloodInventory {
  return {
    id: required(wire.id, "blood_inventory[].id"),
    bloodType: required(wire.blood_type, "blood_inventory[].blood_type"),
    unitsAvailable: required(wire.units_available, "blood_inventory[].units_available"),
    minimumThreshold: required(wire.minimum_threshold, "blood_inventory[].minimum_threshold"),
  };
}

export function toResourceStatus(wire: ResourceStatusWire): ResourceStatus {
  return {
    summary: required(wire.summary, "summary"),
    beds: wire.beds.map((bed) => ({
      id: required(bed.id, "beds[].id"),
      bedCode: required(bed.bed_code, "beds[].bed_code"),
      bedType: required(bed.bed_type, "beds[].bed_type"),
      department: required(bed.department, "beds[].department"),
      isOccupied: required(bed.is_occupied, "beds[].is_occupied"),
      isReserved: required(bed.is_reserved, "beds[].is_reserved"),
    })),
    operatingRooms: wire.operating_rooms.map((room) => ({
      id: required(room.id, "operating_rooms[].id"),
      roomNumber: required(room.room_number, "operating_rooms[].room_number"),
      status: required(room.status, "operating_rooms[].status"),
      ...(room.scheduled_procedure ? { scheduledProcedure: room.scheduled_procedure } : {}),
      isEmergencyCleared: required(room.is_emergency_cleared, "operating_rooms[].is_emergency_cleared"),
    })),
    staff: wire.staff.map(toStaffMember),
    ambulances: wire.ambulances.map((ambulance) => ({
      id: required(ambulance.id, "ambulances[].id"),
      vehicleCode: required(ambulance.vehicle_code, "ambulances[].vehicle_code"),
      status: required(ambulance.status, "ambulances[].status"),
      crewAssigned: required(ambulance.crew_assigned, "ambulances[].crew_assigned"),
    })),
    bloodInventory: wire.blood_inventory.map(toBloodInventory),
    lastUpdated: required(wire.last_updated, "last_updated"),
  };
}

/**
 * Derive the staff availability aggregate. The backend exposes no such model;
 * it is computed here from `GET /api/resources` staff records.
 */
export function toStaffAvailability(staff: readonly StaffMember[]): StaffAvailability {
  const onDuty = staff.filter((member) => member.isOnDuty);
  const byRole: Partial<Record<StaffMember["role"], number>> = {};
  for (const member of onDuty) {
    byRole[member.role] = (byRole[member.role] ?? 0) + 1;
  }
  return {
    totalOnDuty: onDuty.length,
    available: onDuty.filter((member) => !member.isAssigned).length,
    assigned: onDuty.filter((member) => member.isAssigned).length,
    byRole,
  };
}

export function toIncident(wire: IncidentWire): Incident {
  return {
    id: required(wire.id, "id"),
    title: required(wire.title, "title"),
    incidentType: required(wire.incident_type, "incident_type"),
    severity: required(wire.severity, "severity"),
    casualtyCount: required(wire.casualty_count, "casualty_count"),
    location: required(wire.location, "location"),
    etaMinutes: required(wire.eta_minutes, "eta_minutes"),
    ...(wire.description ? { description: wire.description } : {}),
    status: required(wire.status, "status"),
    createdAt: required(wire.created_at, "created_at"),
    updatedAt: required(wire.updated_at, "updated_at"),
  };
}

export function toAuditEvent(wire: AuditEventWire): AuditEvent {
  return {
    id: required(wire.id, "id"),
    ...(wire.incident_id ? { incidentId: wire.incident_id } : {}),
    eventType: required(wire.event_type, "event_type"),
    ...(wire.action_name ? { actionName: wire.action_name } : {}),
    ...(wire.tier ? { tier: wire.tier } : {}),
    details: wire.details ?? {},
    performedBy: required(wire.performed_by, "performed_by"),
    timestamp: required(wire.timestamp, "timestamp"),
  };
}

export function formatStateSummary(state: Readonly<Record<string, unknown>> | undefined): string {
  if (!state || Object.keys(state).length === 0) {
    return "NOT PROVIDED BY BACKEND";
  }
  return Object.entries(state)
    .map(
      ([k, v]) =>
        `${k.replace(/_/g, " ")}: ${v === null ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v)}`,
    )
    .join(" | ");
}

export function toApprovalProposal(
  checkpoint: import("@/types/api/contracts").TrueForgeApprovalCheckpointWire,
): import("@/types/domain").ApprovalProposal {
  const p = checkpoint.proposal;
  if (!p) {
    throw new TypeError("Contract violation: checkpoint missing proposal object");
  }

  const currentSummary = formatStateSummary(p.current_state);
  const proposedSummary = formatStateSummary(p.proposed_state);

  return {
    targetAction: p.action_type || p.action_id || "NOT PROVIDED BY BACKEND",
    operationalRationale: p.reason || p.expected_benefit || "NOT PROVIDED BY BACKEND",
    projectedImpact: p.potential_consequence || "NOT PROVIDED BY BACKEND",
    affectedResources: p.affected_resource ? [p.affected_resource] : ["NOT PROVIDED BY BACKEND"],
    currentState: currentSummary,
    postActionState: proposedSummary,
    tier: "RED",
    availableDecisions: ["APPROVE", "REJECT"],
    gateState: checkpoint.state === "tool.approval_required" ? "AWAITING_OPERATOR" : "NOT_BLOCKED",
    checkpointId: checkpoint.checkpoint_id,
    actionId: p.action_id,
    actionType: p.action_type,
    reason: p.reason,
    expectedBenefit: p.expected_benefit,
    potentialConsequence: p.potential_consequence,
    affectedResource: p.affected_resource,
    currentStateDetails: p.current_state,
    proposedStateDetails: p.proposed_state,
    incidentId: p.incident_id,
    requiresHumanApproval: p.requires_human_approval ?? true,
  };
}

export function toRunbookExecution(
  wire: import("@/types/api/contracts").RunbookExecutionStateWire,
): import("@/types/domain").AgentExecutionState {
  const isAwaiting = wire.state === "WAITING_FOR_APPROVAL";
  const stepNum = wire.current_step_id
    ? parseInt(wire.current_step_id.replace(/^MCI-\d+-0*/, ""), 10) || 1
    : 1;

  return {
    executionId: wire.execution_id,
    incidentId: wire.incident_id,
    runbookId: wire.runbook_id,
    status: isAwaiting
      ? "AWAITING_APPROVAL"
      : wire.state === "COMPLETED"
      ? "COMPLETED"
      : wire.state === "BLOCKED"
      ? "HALTED"
      : wire.state === "FAILED"
      ? "FAILED"
      : "RUNNING",
    currentStep: stepNum,
    totalSteps: 15,
    activeCheckpoint: wire.checkpoint_id ?? null,
    gateState: isAwaiting ? "AWAITING_OPERATOR" : "NOT_BLOCKED",
    startedAt: wire.started_at,
  };
}

