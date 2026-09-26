import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditPanel } from "@/components/console/AuditPanel";
import { HealthPanel } from "@/components/console/HealthPanel";
import { HospitalPanel } from "@/components/console/HospitalPanel";
import { IncidentsPanel } from "@/components/console/IncidentsPanel";
import { ResourcesPanel } from "@/components/console/ResourcesPanel";
import { connectionStateOf } from "@/components/common/ConnectionBadge";
import { ApiConfigurationError, ApiNetworkError } from "@/lib/errors";
import { available, failed, LOADING } from "@/lib/loadState";
import { toStaffAvailability } from "@/lib/mappers";
import type { AuditEvent, HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";

/**
 * Panel rendering across every connection state.
 *
 * Fixtures are transcriptions of payloads captured from Member 1's running
 * backend during Phase 2 live verification.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const HEALTH = {
  status: "healthy",
  service: "aimbulence-backend",
  database: "connected",
  environment: "development",
  timestamp: "2026-09-26T09:36:28.753328+00:00",
};

const CAPACITY: HospitalCapacity = {
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
  lastUpdated: new Date().toISOString(),
  departments: [
    {
      name: "Emergency Department",
      departmentType: "EMERGENCY",
      totalBeds: 20,
      availableBeds: 12,
      occupiedBeds: 8,
      staffOnDuty: 12,
      statusNote: "Normal ED intake flow",
    },
  ],
};

const RESOURCES: ResourceStatus = {
  summary: {},
  beds: [
    {
      id: "bed-ed-01",
      bedCode: "ED-01",
      bedType: "EMERGENCY",
      department: "Emergency Department",
      isOccupied: false,
      isReserved: false,
    },
    {
      id: "bed-ed-02",
      bedCode: "ED-02",
      bedType: "EMERGENCY",
      department: "Emergency Department",
      isOccupied: true,
      isReserved: false,
    },
  ],
  operatingRooms: [
    {
      id: "or-01",
      roomNumber: "OR-1",
      status: "OPEN",
      isEmergencyCleared: true,
    },
  ],
  staff: [
    {
      id: "staff-doc-01",
      name: "Dr. Marcus Chen",
      role: "TRAUMA_SURGEON",
      department: "Emergency Department",
      isOnDuty: true,
      isAssigned: false,
    },
  ],
  ambulances: [
    { id: "amb-01", vehicleCode: "MEDIC-01", status: "AVAILABLE", crewAssigned: true },
  ],
  bloodInventory: [
    { id: "blood-o_neg", bloodType: "O_NEG", unitsAvailable: 18, minimumThreshold: 10 },
  ],
  lastUpdated: new Date().toISOString(),
};

const INCIDENT: Incident = {
  id: "INC-7483875E",
  title: "Phase 2 Live Verification Incident",
  incidentType: "MASS_CASUALTY_COLLISION",
  severity: "CRITICAL",
  casualtyCount: 42,
  location: "Mile Marker 48 Southbound",
  etaMinutes: 25,
  status: "REPORTED",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const AUDIT: AuditEvent = {
  id: "3960876f-3d2e-420e-a541-e1eb05c84075",
  incidentId: "INC-7483875E",
  eventType: "INCIDENT_REPORTED",
  actionName: "INGEST_EMERGENCY_DISPATCH",
  tier: "GREEN",
  details: { casualty_count: 42 },
  performedBy: "DISPATCH_RECEIVER",
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connection state mapping", () => {
  it("maps loadable states to the five operator-facing states", () => {
    expect(connectionStateOf(LOADING)).toBe("LOADING");
    expect(connectionStateOf(available("x"))).toBe("AVAILABLE");
    expect(connectionStateOf(failed(new ApiNetworkError("down")))).toBe("FAILED");
    expect(connectionStateOf(failed(new ApiConfigurationError("unset")))).toBe("DISCONNECTED");
  });
});

describe("available state", () => {
  it("renders live health detail", () => {
    render(<HealthPanel state={available(HEALTH)} />);

    expect(screen.getByTestId("health-status")).toHaveTextContent("healthy");
    expect(screen.getByTestId("connection-AVAILABLE")).toBeInTheDocument();
  });

  it("renders real capacity figures and department breakdown", () => {
    render(<HospitalPanel state={available(CAPACITY)} />);

    expect(screen.getByText("Metro Central Trauma Hospital")).toBeInTheDocument();
    expect(screen.getByTestId("operational-code")).toHaveTextContent("NORMAL");
    expect(screen.getByText("12/20")).toBeInTheDocument();
    expect(screen.getByTestId("department-list")).toBeInTheDocument();
  });

  it("renders resource inventory and the derived staff aggregate", () => {
    render(
      <ResourcesPanel
        state={available(RESOURCES)}
        staffAvailability={toStaffAvailability(RESOURCES.staff)}
      />,
    );

    expect(screen.getByTestId("operating-room-list")).toHaveTextContent("OR-1");
    expect(screen.getByTestId("staff-list")).toHaveTextContent("Dr. Marcus Chen");
    expect(screen.getByTestId("blood-list")).toHaveTextContent("O NEG");
    // 2 beds tracked, 1 free.
    expect(screen.getByText("Beds free").parentElement).toHaveTextContent("1");
  });

  it("renders the incident list", () => {
    render(<IncidentsPanel state={available([INCIDENT])} />);

    expect(screen.getByTestId("incident-list")).toHaveTextContent("INC-7483875E");
    expect(screen.getByTestId("incident-list")).toHaveTextContent("MASS_CASUALTY_COLLISION");
  });

  it("renders an explicit empty state for no incidents", () => {
    render(<IncidentsPanel state={available([])} />);

    expect(screen.getByText("No incidents reported")).toBeInTheDocument();
    expect(screen.queryByTestId("incident-list")).toBeNull();
  });

  it("renders the audit trail with its safety tier", () => {
    render(<AuditPanel state={available([AUDIT])} />);

    expect(screen.getByTestId("audit-list")).toHaveTextContent("INCIDENT_REPORTED");
    expect(screen.getByTestId("safety-tier-GREEN")).toBeInTheDocument();
  });
});

describe("failed state", () => {
  it("shows an error and no figures for an unreachable backend", () => {
    render(<HospitalPanel state={failed(new ApiNetworkError("connection refused"))} />);

    expect(screen.getByTestId("error-notice")).toBeInTheDocument();
    expect(screen.getByTestId("connection-FAILED")).toBeInTheDocument();
    // Critically: no capacity is rendered at all.
    expect(screen.queryByText("Metro Central Trauma Hospital")).toBeNull();
    expect(screen.queryByTestId("department-list")).toBeNull();
  });

  it("offers a safe retry for read-only sections", () => {
    render(<IncidentsPanel state={failed(new ApiNetworkError("down"))} />);

    expect(screen.getByTestId("refresh-incidents")).toBeInTheDocument();
  });

  it("distinguishes an unconfigured backend from a failure", () => {
    render(<AuditPanel state={failed(new ApiConfigurationError("BACKEND_BASE_URL unset"))} />);

    expect(screen.getByTestId("connection-DISCONNECTED")).toBeInTheDocument();
  });

  it("states that no figures are fabricated when a section fails", () => {
    render(<ResourcesPanel state={failed(new ApiNetworkError("down"))} />);

    expect(screen.getByTestId("error-notice")).toHaveTextContent(
      /never fabricated or carried over/i,
    );
  });
});

describe("loading state", () => {
  it("renders a loading placeholder rather than placeholder figures", () => {
    render(<ResourcesPanel state={LOADING} />);

    expect(screen.getByTestId("connection-LOADING")).toBeInTheDocument();
    expect(screen.queryByTestId("blood-list")).toBeNull();
  });
});

describe("phase boundary", () => {
  it("renders no approval or runbook execution control anywhere", () => {
    const { container } = render(
      <>
        <HealthPanel state={available(HEALTH)} />
        <HospitalPanel state={available(CAPACITY)} />
        <ResourcesPanel state={available(RESOURCES)} />
        <IncidentsPanel state={available([INCIDENT])} />
        <AuditPanel state={available([AUDIT])} />
      </>,
    );
    const text = (container.textContent ?? "").toLowerCase();

    for (const forbidden of ["approve", "modify", "reject", "execute runbook", "authorise"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
