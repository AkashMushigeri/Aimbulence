import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AuditActivityPanel,
  CapacityOverview,
  DeficitPanel,
  IncidentOverview,
  OperationsDashboard,
  ResourceOverview,
  RunbookSection,
  SystemStatus,
} from "@/components/dashboard";
import { SafetyTierBadge } from "@/components/common";
import { ApiNetworkError } from "@/lib/errors";
import { available, failed, LOADING } from "@/lib/loadState";
import type { AuditEvent, HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";
import type { BackendHealth } from "@/services/operations";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const MOCK_HEALTH: BackendHealth = {
  status: "healthy",
  service: "aimbulence-backend",
  database: "connected",
  environment: "development",
  timestamp: "2026-09-26T12:00:00Z",
};

const MOCK_HOSPITAL: HospitalCapacity = {
  hospitalName: "Metro Central Trauma Hospital",
  operationalCode: "NORMAL",
  emergencyBedsAvailable: 12,
  emergencyBedsTotal: 20,
  icuBedsAvailable: 4,
  icuBedsTotal: 10,
  operatingRoomsAvailable: 2,
  operatingRoomsTotal: 5,
  doctorsAvailable: 8,
  nursesAvailable: 16,
  ambulancesAvailable: 5,
  bloodUnitsAvailable: 30,
  activeIncidentCount: 1,
  lastUpdated: "2026-09-26T12:00:00Z",
  departments: [
    {
      name: "Emergency Department",
      departmentType: "EMERGENCY",
      totalBeds: 20,
      availableBeds: 12,
      occupiedBeds: 8,
      staffOnDuty: 12,
      statusNote: "Normal intake flow",
    },
  ],
};

const MOCK_INCIDENT: Incident = {
  id: "INC-7A8B9C0D",
  title: "Highway Interstate 95 Multi-Vehicle Transit Collision",
  incidentType: "MASS_CASUALTY_COLLISION",
  severity: "CRITICAL",
  casualtyCount: 42,
  location: "Mile Marker 48 Southbound",
  etaMinutes: 25,
  description: "Charter bus and multiple passenger vehicles involved.",
  status: "REPORTED",
  createdAt: "2026-09-26T12:05:00Z",
  updatedAt: "2026-09-26T12:05:00Z",
};

const MOCK_RESOURCES: ResourceStatus = {
  summary: { total_beds: 30, available_beds: 16 },
  beds: [
    { id: "b-1", bedCode: "ED-01", bedType: "EMERGENCY", department: "ED", isOccupied: false, isReserved: false },
  ],
  operatingRooms: [
    { id: "or-1", roomNumber: "OR-1", status: "OPEN", scheduledProcedure: undefined, isEmergencyCleared: true },
    { id: "or-3", roomNumber: "OR-3", status: "IN_USE", scheduledProcedure: "Elective Knee Repair", isEmergencyCleared: false },
  ],
  staff: [
    { id: "s-1", name: "Dr. Marcus Chen", role: "TRAUMA_SURGEON", department: "ED", isOnDuty: true, isAssigned: false },
  ],
  ambulances: [
    { id: "amb-1", vehicleCode: "MEDIC-01", status: "AVAILABLE", crewAssigned: true },
  ],
  bloodInventory: [
    { id: "blood-1", bloodType: "O_NEG", unitsAvailable: 18, minimumThreshold: 10 },
  ],
  lastUpdated: "2026-09-26T12:00:00Z",
};

const MOCK_AUDIT: AuditEvent[] = [
  {
    id: "evt-1",
    incidentId: "INC-7A8B9C0D",
    eventType: "INCIDENT_REPORTED",
    actionName: "INGEST_EMERGENCY_DISPATCH",
    tier: "GREEN",
    details: { message: "Dispatch received" },
    performedBy: "DISPATCH_RECEIVER",
    timestamp: "2026-09-26T12:05:00Z",
  },
  {
    id: "evt-2",
    incidentId: "INC-7A8B9C0D",
    eventType: "SURGE_INTERVENTION_AUTHORIZED",
    actionName: "DECLARE_CODE_ORANGE",
    tier: "RED",
    details: { verified: true },
    performedBy: "OPERATOR",
    timestamp: "2026-09-26T12:07:00Z",
  },
];

function fullSections() {
  return {
    health: { label: "System status", state: available(MOCK_HEALTH) },
    hospital: { label: "Hospital status", state: available(MOCK_HOSPITAL) },
    resources: { label: "Resources", state: available(MOCK_RESOURCES) },
    incidents: { label: "Incidents", state: available([MOCK_INCIDENT]) },
    audit: { label: "Audit trail", state: available(MOCK_AUDIT) },
  };
}

describe("AIMBULENCE Phase 3 Live Operations Control Center", () => {
  // 1. Dashboard renders
  it("1. renders the core dashboard with major operational sections", () => {
    render(
      <OperationsDashboard
        configured={true}
        sections={fullSections()}
        health={MOCK_HEALTH}
        hospital={MOCK_HOSPITAL}
        resources={MOCK_RESOURCES}
        incidents={[MOCK_INCIDENT]}
        audit={MOCK_AUDIT}
      />,
    );

    expect(screen.getByText("AIMBULENCE")).toBeDefined();
    expect(screen.getByText("LIVE OPS CONTROL CENTER")).toBeDefined();
    expect(screen.getByText("Incident Overview")).toBeDefined();
    expect(screen.getByText("Hospital Operational Capacity")).toBeDefined();
    expect(screen.getByText("Detailed Resource Status")).toBeDefined();
    expect(screen.getByText("Operational Deficits & Bottlenecks")).toBeDefined();
    expect(screen.getByText("RUNBOOK EXECUTION")).toBeDefined();
    expect(screen.getByText("Audit & Activity Trail")).toBeDefined();
  });

  // 2. Backend connected state
  it("2. displays CONNECTED state based on successful backend health response", () => {
    render(
      <OperationsDashboard
        configured={true}
        sections={fullSections()}
        health={MOCK_HEALTH}
      />,
    );

    const badge = screen.getByTestId("connection-CONNECTED");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("CONNECTED");
    expect(screen.getByTestId("api-health-status").textContent).toBe("healthy");
    expect(screen.getByTestId("database-status").textContent).toBe("connected");
  });

  // 3. Backend disconnected state
  it("3. displays DISCONNECTED state when backend is unreachable or unconfigured", () => {
    const failedSections = {
      health: { label: "System status", state: failed(new ApiNetworkError("connection refused")) },
      hospital: { label: "Hospital status", state: failed(new ApiNetworkError("connection refused")) },
      resources: { label: "Resources", state: failed(new ApiNetworkError("connection refused")) },
      incidents: { label: "Incidents", state: failed(new ApiNetworkError("connection refused")) },
      audit: { label: "Audit trail", state: failed(new ApiNetworkError("connection refused")) },
    };

    render(
      <OperationsDashboard
        configured={true}
        sections={failedSections}
      />,
    );

    const badge = screen.getByTestId("connection-DISCONNECTED");
    expect(badge).toBeDefined();
    expect(screen.getByTestId("backend-unreachable")).toBeDefined();
  });

  // 4. Incident success
  it("4. renders real incident information from GET /api/incidents", () => {
    render(<IncidentOverview state={available([MOCK_INCIDENT])} />);

    expect(screen.getByText("Highway Interstate 95 Multi-Vehicle Transit Collision")).toBeDefined();
    expect(screen.getByText("INC-7A8B9C0D")).toBeDefined();
    expect(screen.getByTestId("incident-casualties-INC-7A8B9C0D").textContent).toContain("42 casualties");
    expect(screen.getByText("Mile Marker 48 Southbound")).toBeDefined();
    expect(screen.getByText("25 minutes")).toBeDefined();
    expect(screen.getByTestId("incident-severity-INC-7A8B9C0D").textContent).toBe("CRITICAL");
  });

  // 5. Incident empty state
  it("5. renders explicit empty state when backend reports zero incidents", () => {
    render(<IncidentOverview state={available([])} />);

    expect(screen.getByText("No Active Emergency Incidents")).toBeDefined();
    expect(screen.getByText("Report Documented MCI-01 Alert")).toBeDefined();
  });

  // 6. Incident error
  it("6. renders error state cleanly without crashing when /api/incidents fails", () => {
    render(<IncidentOverview state={failed(new ApiNetworkError("Incident endpoint failure"))} />);

    expect(screen.getByText("Incident feed unavailable")).toBeDefined();
    expect(screen.queryByTestId("incident-list")).toBeNull();
  });

  // 7. Capacity success
  it("7. renders real hospital capacity cards and department metrics", () => {
    render(<CapacityOverview state={available(MOCK_HOSPITAL)} />);

    expect(screen.getByTestId("hospital-facility-name").textContent).toBe("Metro Central Trauma Hospital");
    expect(screen.getByTestId("operational-code-badge").textContent).toBe("NORMAL");
    expect(screen.getByTestId("ed-available-stat").textContent).toContain("12");
    expect(screen.getByTestId("icu-available-stat").textContent).toContain("4");
    expect(screen.getByTestId("or-available-stat").textContent).toContain("2");
    expect(screen.getByTestId("doctors-available-stat").textContent).toBe("8");
    expect(screen.getByTestId("nurses-available-stat").textContent).toBe("16");
    expect(screen.getByText("Normal intake flow")).toBeDefined();
  });

  // 8. Resource success
  it("8. renders real granular resource inventory across physical and human assets", () => {
    render(<ResourceOverview state={available(MOCK_RESOURCES)} />);

    expect(screen.getByTestId("res-beds-summary")).toBeDefined();
    expect(screen.getByTestId("res-ors-summary")).toBeDefined();
    expect(screen.getByTestId("res-staff-summary")).toBeDefined();
    expect(screen.getByText("OR-1")).toBeDefined();
    expect(screen.getByText("CLEARED FOR TRAUMA")).toBeDefined();
  });

  // 9. Audit log rendering
  it("9. renders real audit records and distinguishes VERIFIED from SUCCESS", () => {
    render(<AuditActivityPanel state={available(MOCK_AUDIT)} />);

    expect(screen.getByText("INCIDENT_REPORTED")).toBeDefined();
    expect(screen.getByText("SURGE_INTERVENTION_AUTHORIZED")).toBeDefined();
    expect(screen.getByTestId("audit-status-evt-1").textContent).toBe("SUCCESS");
    // Only shows VERIFIED when backend explicitly reports verification
    expect(screen.getByTestId("audit-status-evt-2").textContent).toBe("VERIFIED");
  });

  // 10. Partial endpoint failure
  it("10. supports partial endpoint failure with DEGRADED state and isolated error boundaries", () => {
    const partial = {
      health: { label: "System status", state: available(MOCK_HEALTH) },
      hospital: { label: "Hospital status", state: available(MOCK_HOSPITAL) },
      resources: { label: "Resources", state: failed(new ApiNetworkError("Resources down")) },
      incidents: { label: "Incidents", state: available([MOCK_INCIDENT]) },
      audit: { label: "Audit trail", state: available(MOCK_AUDIT) },
    };

    render(
      <OperationsDashboard
        configured={true}
        sections={partial}
        health={MOCK_HEALTH}
        hospital={MOCK_HOSPITAL}
      />,
    );

    const badge = screen.getByTestId("connection-DEGRADED");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("DEGRADED");
    expect(screen.getByTestId("partial-failure-alert")).toBeDefined();
    // Successfully loaded panel still renders!
    expect(screen.getByText("Metro Central Trauma Hospital")).toBeDefined();
  });

  // 11. Refresh state
  it("11. exposes explicit safe refresh controls with accessible labels", () => {
    render(<SystemStatus appName="AIMBULENCE" appTagline="Executor" connectionState="CONNECTED" />);

    const refreshBtn = screen.getByTestId("dashboard-refresh-btn");
    expect(refreshBtn).toBeDefined();
    expect(refreshBtn.getAttribute("aria-label")).toBe("Refresh operational dashboard data");
  });

  // 12. No fake values rendered when backend data is unavailable
  it("12. withholds all values when hospital capacity fails without fallback mocks", () => {
    render(<CapacityOverview state={failed(new ApiNetworkError("Service down"))} />);

    expect(screen.queryByTestId("hospital-facility-name")).toBeNull();
    expect(screen.queryByTestId("ed-available-stat")).toBeNull();
    expect(screen.getByText("Hospital capacity unavailable")).toBeDefined();
  });

  // 13. RED safety tier is displayed correctly
  it("13. renders RED safety tier with high-prominence human approval required badge", () => {
    render(<SafetyTierBadge tier="RED" />);

    const badge = screen.getByTestId("safety-tier-RED");
    expect(badge.textContent).toBe("RED · human approval required");
    expect(badge.className).toContain("text-red-300");
  });

  // 14. Runbook section does not fabricate execution progress
  it("14. renders runbook section as explicitly gated without fabricating steps or progress bars", () => {
    render(<RunbookSection />);

    expect(screen.getByText("RUNBOOK EXECUTION")).toBeDefined();
    expect(screen.getByTestId("runbook-id").textContent).toContain("MCI-01");
    expect(screen.getByTestId("runbook-status-badge").textContent).toBe(
      "NOT CONNECTED / WAITING FOR EXECUTION ENGINE",
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  // 15. Renders active runbook execution paused at TrueForge checkpoint
  it("15. renders active runbook execution with prominent paused alert and Step 10 waiting approval", () => {
    const mockExecution = {
      execution_id: "RBX-D736A471",
      runbook_id: "MCI-01",
      incident_id: "INC-MCI-42",
      state: "WAITING_FOR_APPROVAL" as const,
      current_step_id: "MCI-01-10",
      checkpoint_id: "CHK-4E728E62",
      parameters: { incoming_casualties: 42 },
      context: { checkpoint_id: "CHK-4E728E62" },
      completed_steps: [
        "MCI-01-01", "MCI-01-02", "MCI-01-03", "MCI-01-04", "MCI-01-05",
        "MCI-01-06", "MCI-01-07", "MCI-01-08", "MCI-01-09",
      ],
      step_results: {},
      started_at: "2026-09-26T12:00:00Z",
      updated_at: "2026-09-26T12:01:00Z",
    };

    render(
      <RunbookSection
        execution={mockExecution}
        activeCheckpoint={null}
      />,
    );

    expect(screen.getByTestId("runbook-status-badge").textContent).toBe("WAITING_FOR_APPROVAL");
    expect(screen.getByTestId("checkpoint-paused-alert")).toBeDefined();
    expect(screen.getByText("AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION")).toBeDefined();
    expect(screen.getByTestId("review-checkpoint-btn")).toBeDefined();
    expect(screen.getByTestId("step-status-10").textContent).toBe("WAITING_APPROVAL");
    expect(screen.getByTestId("step-status-1").textContent).toBe("COMPLETED");
  });

  // 16. Renders completed runbook execution
  it("16. renders completed runbook execution with all 15 steps verified", () => {
    const mockCompleted = {
      execution_id: "RBX-D736A471",
      runbook_id: "MCI-01",
      incident_id: "INC-MCI-42",
      state: "COMPLETED" as const,
      current_step_id: null,
      checkpoint_id: null,
      parameters: { incoming_casualties: 42 },
      context: {},
      completed_steps: Array.from({ length: 15 }, (_, i) => `MCI-01-${String(i + 1).padStart(2, "0")}`),
      step_results: {},
      started_at: "2026-09-26T12:00:00Z",
      updated_at: "2026-09-26T12:02:00Z",
      completed_at: "2026-09-26T12:02:00Z",
    };

    render(<RunbookSection execution={mockCompleted} />);

    expect(screen.getByTestId("runbook-status-badge").textContent).toBe("COMPLETED");
    expect(screen.getByTestId("runbook-completed-alert")).toBeDefined();
    expect(screen.getByText("SURGE READINESS REALIZED — EXECUTION COMPLETE & VERIFIED")).toBeDefined();
    expect(screen.getByTestId("step-status-15").textContent).toBe("COMPLETED");
  });
});
