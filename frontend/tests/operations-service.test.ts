import { describe, expect, it, vi } from "vitest";

import { ApiHttpError, ApiValidationError, MalformedResponseError } from "@/lib/errors";
import { toStaffAvailability } from "@/lib/mappers";
import { createApiClient } from "@/services/apiClient";
import { createOperationsService } from "@/services/operations";
import { API_PATHS } from "@/types/api/contracts";

/**
 * Service and contract tests for the six documented `[IMPLEMENTED]` endpoints.
 *
 * Transport is exercised through an injected fetch stub. The response bodies are
 * transcriptions of payloads captured from Member 1's running backend during
 * Phase 2 live verification — they are contract fixtures, not product mock data.
 */
const CONFIG = { backendBaseUrl: "http://127.0.0.1:8000", requestTimeoutMs: 2_000 } as const;

function serviceWith(fetchImpl: typeof fetch) {
  return createOperationsService(createApiClient({ config: CONFIG, fetchImpl }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const HEALTH_BODY = {
  status: "healthy",
  service: "aimbulence-backend",
  database: "connected",
  environment: "development",
  timestamp: "2026-09-26T09:36:28.753328+00:00",
};

const HOSPITAL_BODY = {
  hospital_name: "Metro Central Trauma Hospital",
  operational_code: "NORMAL",
  emergency_beds_available: 12,
  emergency_beds_total: 20,
  icu_beds_available: 4,
  icu_beds_total: 10,
  operating_rooms_available: 2,
  operating_rooms_total: 5,
  doctors_available: 8,
  nurses_available: 16,
  ambulances_available: 5,
  blood_units_available: 30,
  active_incidents_count: 1,
  last_updated: "2026-09-26T09:30:44.037431",
  departments: [
    {
      name: "Emergency Department",
      department_type: "EMERGENCY",
      total_beds: 20,
      available_beds: 12,
      occupied_beds: 8,
      staff_on_duty: 12,
      status_note: "Normal ED intake flow",
    },
  ],
};

const RESOURCES_BODY = {
  summary: { total_beds: 30, available_beds: 16 },
  beds: [
    {
      id: "bed-ed-01",
      bed_code: "ED-01",
      bed_type: "EMERGENCY",
      department: "Emergency Department",
      is_occupied: false,
      is_reserved: false,
    },
  ],
  operating_rooms: [
    {
      id: "or-03",
      room_number: "OR-3",
      status: "IN_USE",
      scheduled_procedure: "Elective Arthroscopic Knee Debridement",
      is_emergency_cleared: false,
    },
  ],
  staff: [
    {
      id: "staff-doc-01",
      name: "Dr. Marcus Chen",
      role: "TRAUMA_SURGEON",
      department: "Emergency Department",
      is_on_duty: true,
      is_assigned: false,
    },
    {
      id: "staff-nurse-01",
      name: "Nurse Specialist 01",
      role: "NURSE",
      department: "Emergency Department",
      is_on_duty: true,
      is_assigned: true,
    },
    {
      id: "staff-doc-09",
      name: "Dr. Off Duty",
      role: "DOCTOR",
      department: "Intensive Care Unit",
      is_on_duty: false,
      is_assigned: false,
    },
  ],
  ambulances: [
    { id: "amb-01", vehicle_code: "MEDIC-01", status: "AVAILABLE", crew_assigned: true },
  ],
  blood_inventory: [
    { id: "blood-o_neg", blood_type: "O_NEG", units_available: 18, minimum_threshold: 10 },
  ],
  last_updated: "2026-09-26T09:30:50.241692Z",
};

const INCIDENT_BODY = {
  id: "INC-7483875E",
  title: "Phase 2 Live Verification Incident",
  incident_type: "MASS_CASUALTY_COLLISION",
  severity: "CRITICAL",
  casualty_count: 42,
  location: "Mile Marker 48 Southbound",
  eta_minutes: 25,
  description: "Automated Phase 2 read-only verification probe.",
  status: "REPORTED",
  created_at: "2026-09-26T09:30:59.956072",
  updated_at: "2026-09-26T09:30:59.956072",
};

const AUDIT_BODY = [
  {
    id: "3960876f-3d2e-420e-a541-e1eb05c84075",
    incident_id: "INC-7483875E",
    event_type: "INCIDENT_REPORTED",
    action_name: "INGEST_EMERGENCY_DISPATCH",
    tier: "GREEN",
    details: { casualty_count: 42 },
    performed_by: "DISPATCH_RECEIVER",
    timestamp: "2026-09-26T09:30:59.956072",
  },
];

describe("documented endpoint paths", () => {
  it("calls exactly the six Phase 2 documented paths", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(HEALTH_BODY))
      .mockResolvedValueOnce(jsonResponse(HOSPITAL_BODY))
      .mockResolvedValueOnce(jsonResponse(RESOURCES_BODY))
      .mockResolvedValueOnce(jsonResponse([INCIDENT_BODY]))
      .mockResolvedValueOnce(jsonResponse(AUDIT_BODY));

    const service = serviceWith(fetchImpl);
    await service.getHealth();
    await service.getHospitalStatus();
    await service.getResources();
    await service.getIncidents();
    await service.getAuditLog();

    const requested = fetchImpl.mock.calls.map((call) => {
      const url = String(call[0]);
      return url.slice(url.indexOf("/api"));
    });

    expect(requested).toEqual([
      "/api/health",
      "/api/hospital/status",
      "/api/resources",
      "/api/incidents",
      "/api/audit-log?limit=50",
    ]);
  });

  it("clamps the audit limit to the documented default and maximum", async () => {
    // A Response body can only be read once, so the stub must build a fresh one
    // per call.
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse([]));
    const service = serviceWith(fetchImpl);

    await service.getAuditLog(5_000);
    await service.getAuditLog(0);

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("limit=200");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("limit=1");
  });

  it("never touches a planned endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const service = serviceWith(fetchImpl);

    await service.getIncidents();

    const urls = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("execute-runbook"))).toBe(false);
    expect(urls.some((url) => url.includes("approval"))).toBe(false);
  });
});

describe("successful mapping", () => {
  it("maps health verbatim", async () => {
    const service = serviceWith(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(HEALTH_BODY)));
    await expect(service.getHealth()).resolves.toEqual(HEALTH_BODY);
  });

  it("maps hospital capacity to camelCase domain fields", async () => {
    const service = serviceWith(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(HOSPITAL_BODY)));
    const capacity = await service.getHospitalStatus();

    expect(capacity.hospitalName).toBe("Metro Central Trauma Hospital");
    expect(capacity.operationalCode).toBe("NORMAL");
    expect(capacity.emergencyBedsAvailable).toBe(12);
    expect(capacity.activeIncidentCount).toBe(1);
    expect(capacity.departments[0]?.staffOnDuty).toBe(12);
  });

  it("maps nested resources", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(RESOURCES_BODY)),
    );
    const resources = await service.getResources();

    expect(resources.operatingRooms[0]?.roomNumber).toBe("OR-3");
    expect(resources.bloodInventory[0]?.unitsAvailable).toBe(18);

    // The staff aggregate is derived from the mapped roster, not fetched again.
    const staff = toStaffAvailability(resources.staff);
    expect(staff.totalOnDuty).toBe(2);
    expect(staff.assigned).toBe(1);
    expect(staff.available).toBe(1);
  });

  it("maps incidents and preserves a null description as absent", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ ...INCIDENT_BODY, description: null }])),
    );
    const incidents = await service.getIncidents();

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.casualtyCount).toBe(42);
    expect(incidents[0]?.description).toBeUndefined();
  });

  it("maps audit events and preserves optional nulls as absent", async () => {
    const service = serviceWith(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse([{ ...AUDIT_BODY[0], incident_id: null, tier: null, action_name: null }]),
        ),
    );
    const events = await service.getAuditLog();

    expect(events[0]?.incidentId).toBeUndefined();
    expect(events[0]?.tier).toBeUndefined();
    expect(events[0]?.actionName).toBeUndefined();
  });

  it("handles the empty-array responses the backend returns when nothing is recorded", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse([])),
    );

    await expect(service.getIncidents()).resolves.toEqual([]);
    await expect(service.getAuditLog()).resolves.toEqual([]);
  });
});

describe("structured error preservation", () => {
  it("preserves the documented 404 detail envelope", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockImplementation(async () =>
        jsonResponse({ detail: "Hospital operational baseline not initialized." }, 404),
      ),
    );

    const error = await service.getHospitalStatus().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({
      status: 404,
      message: "Hospital operational baseline not initialized.",
    });
  });

  it("preserves the documented 422 field-level validation errors", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            detail: "Request validation failed",
            errors: [
              { field: "body -> casualty_count", message: "too small", type: "greater_than_equal" },
            ],
          },
          422,
        ),
      ),
    );

    const error = await service.createIncident({
      title: "invalid",
      incident_type: "MASS_CASUALTY_COLLISION",
      severity: "CRITICAL",
      casualty_count: 0,
      location: "nowhere",
      eta_minutes: 5,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiValidationError);
    expect((error as ApiValidationError).fieldErrors[0]?.field).toBe("body -> casualty_count");
  });

  it("surfaces an unreachable backend as a typed network error", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")),
    );

    await expect(service.getHealth()).rejects.toMatchObject({ kind: "NETWORK" });
  });
});

describe("invalid response shape rejection", () => {
  it("rejects a non-object body for a documented object endpoint", async () => {
    const service = serviceWith(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([])));
    await expect(service.getHospitalStatus()).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it("rejects a non-array body for a documented list endpoint", async () => {
    const service = serviceWith(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ oops: true })));
    await expect(service.getIncidents()).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it("rejects a null contract field rather than surfacing a half-built domain object", async () => {
    const service = serviceWith(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...HOSPITAL_BODY, hospital_name: null })),
    );
    await expect(service.getHospitalStatus()).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it("rejects a list containing a non-object row", async () => {
    const service = serviceWith(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(["nope"])));
    await expect(service.getIncidents()).rejects.toBeInstanceOf(MalformedResponseError);
  });

  it("rejects an unparseable body", async () => {
    const service = serviceWith(vi.fn<typeof fetch>().mockResolvedValue(new Response("not json")));
    await expect(service.getHealth()).rejects.toBeInstanceOf(MalformedResponseError);
  });
});

describe("endpoint path constants", () => {
  it("transcribes the documented paths verbatim", () => {
    expect(API_PATHS.HEALTH).toBe("/api/health");
    expect(API_PATHS.HOSPITAL_STATUS).toBe("/api/hospital/status");
    expect(API_PATHS.RESOURCES).toBe("/api/resources");
    expect(API_PATHS.INCIDENTS).toBe("/api/incidents");
    expect(API_PATHS.AUDIT_LOG).toBe("/api/audit-log");
    expect(API_PATHS.APPROVAL_DECIDE).toBe("/api/approval/decide");
    expect(API_PATHS.APPROVAL_CHECKPOINTS).toBe("/api/approval/checkpoints");
    expect(API_PATHS.RUNBOOKS_START_MCI).toBe("/api/runbooks/mci/start");
    expect(API_PATHS.RUNBOOKS_EXECUTION("RBX-123")).toBe("/api/runbooks/RBX-123");
    expect(API_PATHS.RUNBOOKS_RESUME("RBX-123")).toBe("/api/runbooks/RBX-123/resume");
  });
});

describe("Phase 4 & 5 approval and runbook services", () => {
  const MOCK_CHECKPOINT = {
    checkpoint_id: "CHK-4E728E62",
    thread_id: "thread-mci-42",
    tool_call_id: "call-123",
    proposal: {
      action_id: "ACT-PREEMPT-OR3",
      action_type: "PREEMPT_OPERATING_ROOM",
      risk_level: "RED",
      safety_category: "RED",
      affected_resource: "OR-3",
      current_state: { status: "IN_USE", scheduled_procedure: "Knee Debridement" },
      proposed_state: { status: "RESERVED_FOR_TRAUMA", is_emergency_cleared: true },
      reason: "MCI surge requires trauma surgical capacity.",
      expected_benefit: "Unlocks trauma surgical suite OR-3.",
      potential_consequence: "Elective orthopedic procedure postponed.",
      requires_human_approval: true,
      incident_id: "INC-MCI-42",
      created_at: "2026-09-26T12:00:00Z",
    },
    state: "tool.approval_required",
    token_consumed: false,
    created_at: "2026-09-26T12:00:00Z",
  };

  it("lists active checkpoints with optional state filter", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([MOCK_CHECKPOINT]));
    const service = serviceWith(fetchMock);

    const list = await service.listCheckpoints("tool.approval_required");
    expect(list).toHaveLength(1);
    expect(list[0]?.checkpoint_id).toBe("CHK-4E728E62");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/approval/checkpoints?state=tool.approval_required");
  });

  it("submits an authorization decision with execute_if_approved", async () => {
    const decideResponse = {
      status: "DECIDED",
      checkpoint: { ...MOCK_CHECKPOINT, state: "EXECUTED" },
      execution: {
        status: "SUCCESS",
        checkpoint_id: "CHK-4E728E62",
        action_id: "ACT-PREEMPT-OR3",
        resource: "OR-3",
        decision: "APPROVED",
        authorized_by: "Dr. Eleanor Vance",
        executed_at: "2026-09-26T12:05:00Z",
        previous_state: { status: "IN_USE" },
        new_state: { status: "RESERVED_FOR_TRAUMA", is_emergency_cleared: true },
        verification: { verified: true, actual_value: "RESERVED_FOR_TRAUMA" },
        audit_recorded: true,
      },
    };

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(decideResponse));
    const service = serviceWith(fetchMock);

    const result = await service.decideApproval({
      checkpoint_id: "CHK-4E728E62",
      decision: "APPROVE",
      decision_by: "Dr. Eleanor Vance",
      reason: "Surge preemption authorized",
      execute_if_approved: true,
    });

    expect(result.status).toBe("DECIDED");
    expect(result.checkpoint.state).toBe("EXECUTED");
    expect(result.execution?.verification).toEqual({ verified: true, actual_value: "RESERVED_FOR_TRAUMA" });
  });

  it("initiates MCI-01 runbook and resumes after resolution", async () => {
    const startResponse = {
      runbook_execution_id: "RBX-D736A471",
      runbook_id: "MCI-01",
      incident_id: "INC-MCI-42",
      state: "WAITING_FOR_APPROVAL",
      current_step: "MCI-01-10",
      checkpoint_id: "CHK-4E728E62",
      message: "Runbook initiated.",
    };

    const startMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(startResponse));
    const service = serviceWith(startMock);

    const started = await service.startMciRunbook({
      incident_id: "INC-MCI-42",
      incoming_casualties: 42,
    });
    expect(started.runbook_execution_id).toBe("RBX-D736A471");
    expect(started.state).toBe("WAITING_FOR_APPROVAL");
  });
});
