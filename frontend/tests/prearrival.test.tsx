import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmbulanceIntake } from "@/components/ambulance/AmbulanceIntake";
import {
  ActiveEmergenciesQueue,
  HospitalCommandCenter,
  HospitalResourcesGrid,
  PatientSummaryCard,
  PreArrivalPlanView,
} from "@/components/hospital";
import { OperationsDashboard } from "@/components/dashboard/OperationsDashboard";
import { available } from "@/lib/loadState";
import type { PreArrivalAction, PreArrivalCase, PreArrivalResourcesOverview } from "@/types/domain/prearrival";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const MOCK_ACTION: PreArrivalAction = {
  id: "ACT-TRAUMA-BED-101",
  case_id: "PAC-AMB102-DEMO",
  resource_category: "BED",
  resource_name: "Trauma Resuscitation Bay 1",
  recommended_status: "RESERVED & MONITORED",
  reason: "Severe hemorrhagic trauma with hemodynamic instability (BP 90/60, HR 118) requires immediate specialized resuscitation equipment and direct monitoring upon arrival.",
  hospital_availability: "AVAILABLE",
  decision_type: "PENDING",
  requires_approval: true,
  created_at: "2026-09-29T18:00:00Z",
};

const MOCK_ACTION_BLOOD: PreArrivalAction = {
  id: "ACT-BLOOD-102",
  case_id: "PAC-AMB102-DEMO",
  resource_category: "BLOOD",
  resource_name: "4 Units O-Negative Uncrossmatched PRBC",
  recommended_status: "PREPARED & TRANSIT",
  reason: "Suspected severe hemorrhagic shock with unknown patient blood group requires immediate uncrossmatched O-negative PRBC on standby in the trauma bay.",
  hospital_availability: "AVAILABLE",
  decision_type: "APPROVED",
  decision_by: "Dr. Marcus Chen",
  requires_approval: true,
  created_at: "2026-09-29T18:00:00Z",
};

const MOCK_CASE: PreArrivalCase = {
  id: "PAC-AMB102-DEMO",
  ambulance_id: "AMB-102",
  patient_name: "Alex Turner",
  patient_age: 28,
  patient_gender: "Male",
  symptoms: [
    "Severe Hemorrhage Left Leg",
    "Open Compound Fracture",
    "Hypotension",
    "Tachycardia",
    "Acute Hypoxemia",
  ],
  vitals: {
    bp: "90/60",
    hr: 118,
    spo2: 88,
    temp: "98.4 F",
    rr: 24,
  },
  oxygen_required: true,
  emergency_category: "TRAUMA / SEVERE BLEEDING",
  priority: "CRITICAL",
  clinical_summary: "28-year-old male involved in a high-speed road traffic accident. Presents with severe hemorrhaging from a compound left lower extremity fracture. Hemodynamically compromised with hypotension (BP 90/60) and tachycardia (HR 118 bpm). Hypoxemic on room air (SpO2 88%), currently receiving supplemental oxygen. Conscious but confused and disoriented.",
  current_location_name: "Tumakuru Road, Mile 8",
  destination_hospital: "Metro Central Trauma Hospital",
  distance_km: 8.4,
  eta_minutes: 14,
  status: "EN_ROUTE",
  immediate_actions: [
    "Prepare Rapid Infuser & IV Crystalloids",
    "Page Orthopedic Trauma Surgeon on call",
  ],
  actions: [MOCK_ACTION, MOCK_ACTION_BLOOD],
  created_at: "2026-09-29T18:00:00Z",
  updated_at: "2026-09-29T18:00:00Z",
};

const MOCK_RESOURCES: PreArrivalResourcesOverview = {
  source: "Demo Hospital Data",
  hospital_name: "Metro Central Trauma Hospital",
  emergency_beds: { total: 10, available: 3, reserved: 1, status: "AVAILABLE" },
  icu_beds: { total: 8, available: 2, reserved: 0, status: "AVAILABLE" },
  operating_rooms: [
    { room: "OR-1", status: "OPEN", procedure: "None", emergency_cleared: true },
    { room: "OR-3", status: "STANDBY", procedure: "Pre-Op Knee Arthroscopy", emergency_cleared: false },
  ],
  blood_inventory: [
    { type: "O_NEG", units_available: 18, minimum_threshold: 10, status: "STABLE" },
  ],
  trauma_surgeons: [
    { name: "Dr. Marcus Chen", department: "Trauma Surgery", status: "ON_DUTY" },
    { name: "Dr. Elena Rostova", department: "Emergency Medicine", status: "ON_DUTY" },
  ],
  scanners_and_equipment: [
    { equipment: "Rapid Pan-Scan CT (Scanner 1)", location: "Trauma Bay Adjacent", status: "READY" },
  ],
};

describe("AIMBULENCE Pre-Arrival Emergency Coordination Agent", () => {
  it("1. renders Ambulance Intake cockpit and fills 28yo RTA demo scenario", () => {
    render(<AmbulanceIntake />);

    expect(screen.getByText("AMBULANCE TELEMETRY & PATIENT PRE-CHECK")).toBeDefined();
    expect(screen.getByText(/Load 28yo Collision Scenario/i)).toBeDefined();

    // Verify fill demo scenario button fills inputs
    fireEvent.click(screen.getByText(/Load 28yo Collision Scenario/i));

    const bpInput = screen.getByPlaceholderText("e.g. 90/60") as HTMLInputElement;
    expect(bpInput.value).toBe("90/60");

    const descTextarea = screen.getByLabelText(/Natural Language Clinical Incident Description/i) as HTMLTextAreaElement;
    expect(descTextarea.value).toContain("28 year old male");
    expect(descTextarea.value).toContain("Severe bleeding from left leg");
  });

  it("2. renders Active Emergencies Queue with inbound ambulance card and priority badge", () => {
    render(
      <ActiveEmergenciesQueue
        cases={[MOCK_CASE]}
        activeCaseId={MOCK_CASE.id}
        onSelectCase={vi.fn()}
      />,
    );

    expect(screen.getByText(/Active Inbound Ambulances/i)).toBeDefined();
    expect(screen.getByText("AMB-102")).toBeDefined();
    expect(screen.getByText("CRITICAL")).toBeDefined();
    expect(screen.getByText("14m ETA")).toBeDefined();
    expect(screen.getByText(/Alex Turner/i)).toBeDefined();
  });

  it("3. renders Patient Summary Card with physiological alarms and AI assessment", () => {
    render(<PatientSummaryCard activeCase={MOCK_CASE} />);

    expect(screen.getByText("Alex Turner")).toBeDefined();
    expect(screen.getByText(/28 yrs/i)).toBeDefined();
    expect(screen.getByText(/CRITICAL PRIORITY/i)).toBeDefined();

    // Physiological alarms
    expect(screen.getByText("HYPOTENSIVE")).toBeDefined();
    expect(screen.getByText("TACHYCARDIA")).toBeDefined();
    expect(screen.getByText("HYPOXEMIC")).toBeDefined();

    // Symptoms and AI Assessment
    expect(screen.getByText(/Severe Hemorrhage Left Leg/i)).toBeDefined();
    expect(screen.getByText(/AI PRE-ARRIVAL PREPARATION ASSESSMENT/i)).toBeDefined();
  });

  it("4. renders Pre-Arrival Preparation Plan with explainable clinical rationales and authorization buttons", () => {
    const handleActionUpdated = vi.fn();
    render(
      <PreArrivalPlanView
        activeCase={MOCK_CASE}
        onActionUpdated={handleActionUpdated}
      />,
    );

    expect(screen.getByText("AIMBULENCE PRE-ARRIVAL PREPARATION PLAN")).toBeDefined();
    expect(screen.getByText("Trauma Resuscitation Bay 1")).toBeDefined();
    expect(screen.getByText("4 Units O-Negative Uncrossmatched PRBC")).toBeDefined();

    // Verify clinical medical rationale is visible
    expect(
      screen.getByText(/Severe hemorrhagic trauma with hemodynamic instability/i),
    ).toBeDefined();

    // Verify human authorization buttons for pending action
    expect(screen.getByTestId("approve-btn-ACT-TRAUMA-BED-101")).toBeDefined();
    expect(screen.getByTestId("reject-btn-ACT-TRAUMA-BED-101")).toBeDefined();

    // Verify already approved action status
    expect(screen.getByText("✓ APPROVED")).toBeDefined();
    expect(screen.getByText(/by Dr. Marcus Chen/i)).toBeDefined();
  });

  it("5. renders Demo Hospital Data resource capacity matrix", () => {
    render(<HospitalResourcesGrid resources={MOCK_RESOURCES} />);

    expect(screen.getByText("Demo Hospital Data")).toBeDefined();
    expect(screen.getByText("Emergency Beds")).toBeDefined();
    expect(screen.getByText("Dr. Marcus Chen")).toBeDefined();
    expect(screen.getByText("Dr. Elena Rostova")).toBeDefined();
    expect(screen.getByText("Rapid Pan-Scan CT (Scanner 1)")).toBeDefined();
  });

  it("6. renders full Hospital Command Center integrating queue, patient card, plan, and map", () => {
    render(
      <HospitalCommandCenter
        initialCases={[MOCK_CASE]}
        initialResources={MOCK_RESOURCES}
        initialAuditEvents={[]}
      />,
    );

    expect(screen.getByText(/CRITICAL PRE-ARRIVAL ALERT/i)).toBeDefined();
    expect(screen.getAllByText(/Unit AMB-102/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tumakuru Road, Mile 8").length).toBeGreaterThan(0);
    expect(screen.getByText("8.4 km")).toBeDefined();
    expect(screen.getByText(/Live Ambulance Radar & GPS Telemetry/i)).toBeDefined();
  });

  it("7. supports tab switching in OperationsDashboard between Pre-Arrival Command, Ambulance Cockpit, and MCI Runbook", () => {
    const sections = {
      health: { label: "System status", state: available({ status: "healthy", service: "aimbulence", database: "connected", environment: "test", timestamp: "2026-09-29T18:00:00Z" }) },
      hospital: { label: "Hospital", state: available({ hospitalName: "Metro Central", operationalCode: "NORMAL" as const, emergencyBedsAvailable: 10, emergencyBedsTotal: 20, icuBedsAvailable: 4, icuBedsTotal: 10, operatingRoomsAvailable: 2, operatingRoomsTotal: 5, doctorsAvailable: 8, nursesAvailable: 16, ambulancesAvailable: 5, bloodUnitsAvailable: 30, activeIncidentCount: 0, lastUpdated: "2026-09-29T18:00:00Z", departments: [] }) },
      resources: { label: "Resources", state: available({ summary: { total_beds: 30, available_beds: 14 }, beds: [], operatingRooms: [], staff: [], ambulances: [], bloodInventory: [], lastUpdated: "2026-09-29T18:00:00Z" }) },
      incidents: { label: "Incidents", state: available([]) },
      audit: { label: "Audit", state: available([]) },
    };

    render(
      <OperationsDashboard
        configured={true}
        sections={sections}
        prearrivalCases={[MOCK_CASE]}
        prearrivalResources={MOCK_RESOURCES}
        defaultTab="HOSPITAL_COMMAND"
      />,
    );

    // Initial default tab is HOSPITAL_COMMAND
    expect(screen.getByTestId("tab-hospital-command")).toBeDefined();
    expect(screen.getByTestId("prearrival-command-view")).toBeDefined();
    expect(screen.getByTestId("seed-demo-scenario-btn")).toBeDefined();

    // Switch to Ambulance Cockpit
    fireEvent.click(screen.getByTestId("tab-ambulance-dispatch"));
    const ambView = screen.getByTestId("ambulance-intake-view");
    expect(ambView.className).toContain("block");

    // Switch to MCI Runbook
    fireEvent.click(screen.getByTestId("tab-mci-runbook"));
    const mciView = screen.getByTestId("mci-runbook-container");
    expect(mciView.className).toContain("grid");
  });
});
