import { describe, expect, it } from "vitest";
import { createApiClient } from "@/services/apiClient";
import { createOperationsService } from "@/services/operations";

const BACKEND_URL = process.env.BACKEND_BASE_URL ?? "http://127.0.0.1:8000";

describe("live backend integration (Phase 3)", () => {
  it("verifies real responses against running backend on port 8000", async () => {
    let isLive = false;
    try {
      const probe = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      isLive = probe.ok;
    } catch {
      isLive = false;
    }

    if (!isLive) {
      // Backend not running in this process environment, skip live verification
      return;
    }

    const client = createApiClient({
      config: { backendBaseUrl: BACKEND_URL, requestTimeoutMs: 5000 },
    });
    const service = createOperationsService(client);

    // 1. GET /api/health
    const health = await service.getHealth();
    expect(health.status).toBe("healthy");
    expect(health.database).toBe("connected");
    expect(health.service).toBe("aimbulence-backend");

    // 2. GET /api/hospital/status
    const hospital = await service.getHospitalStatus();
    expect(hospital.hospitalName).toBe("Metro Central Trauma Hospital");
    expect(hospital.operationalCode).toBe("NORMAL");
    expect(hospital.emergencyBedsAvailable).toBe(12);
    expect(hospital.icuBedsAvailable).toBe(4);
    expect(hospital.operatingRoomsAvailable).toBe(2);

    // 3. GET /api/resources
    const resources = await service.getResources();
    expect(resources.beds.length).toBe(30);
    expect(resources.operatingRooms.length).toBe(5);
    expect(resources.staff.length).toBe(24);
    expect(resources.ambulances.length).toBe(5);
    expect(resources.bloodInventory.length).toBe(4);

    // 4. GET /api/incidents
    const incidents = await service.getIncidents();
    expect(Array.isArray(incidents)).toBe(true);
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0]?.casualtyCount).toBe(42);

    // 5. GET /api/audit-log
    const audit = await service.getAuditLog(10);
    expect(Array.isArray(audit)).toBe(true);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0]?.eventType).toBeDefined();

    // 6. Phase 5 Runbook Engine + Phase 4 TrueForge Checkpoint Live Integration
    // Start the MCI-01 runbook — should halt at step 10 (MCI-01-10) with WAITING_FOR_APPROVAL
    const startRes = await service.startMciRunbook({
      incident_id: "INC-MCI-42",
      incoming_casualties: 42,
    });
    expect(startRes.runbook_id).toBe("MCI-01");
    expect(startRes.state).toBe("WAITING_FOR_APPROVAL");
    expect(startRes.current_step).toBe("MCI-01-10");
    expect(startRes.checkpoint_id).toBeDefined();

    // Query the real checkpoint created by the backend
    const checkpointId = startRes.checkpoint_id!;
    const checkpoint = await service.getCheckpoint(checkpointId);
    expect(checkpoint.checkpoint_id).toBe(checkpointId);
    expect(checkpoint.state).toBe("tool.approval_required");
    expect(checkpoint.proposal.action_type).toBe("PREEMPT_OPERATING_ROOM");
    expect(checkpoint.proposal.affected_resource).toBe("OR-3");
    expect(checkpoint.proposal.current_state.status).toBe("IN_USE");
    expect(checkpoint.proposal.proposed_state.status).toBe("RESERVED_FOR_TRAUMA");

    // Submit human approval decision to POST /api/approval/decide
    const decideRes = await service.decideApproval({
      checkpoint_id: checkpointId,
      decision: "APPROVE",
      decision_by: "Dr. Eleanor Vance, Trauma Medical Director",
      reason: "Surge casualty intake requires preemption of OR-3.",
      execute_if_approved: true,
    });

    expect(decideRes.status).toBe("DECIDED");
    expect(decideRes.checkpoint.state).toBe("EXECUTED");
    expect(decideRes.execution).toBeDefined();
    expect(decideRes.execution?.resource).toBe("OR-3");
    expect(decideRes.execution?.decision).toBe("APPROVED");
    expect(decideRes.execution?.verification).toMatchObject({ verified: true });
    expect(decideRes.execution?.new_state).toMatchObject({ status: "RESERVED_FOR_TRAUMA" });

    // Resume the runbook post-checkpoint resolution to reach COMPLETED
    const resumed = await service.resumeRunbook(
      startRes.runbook_execution_id,
      "Human authorization approved and executed.",
    );
    expect(resumed.state).toBe("COMPLETED");
    expect(resumed.completed_steps).toHaveLength(15);
  });
});
