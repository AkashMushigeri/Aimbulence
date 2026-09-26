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
  });
});
