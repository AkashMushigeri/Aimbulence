import { describe, expect, it } from "vitest";
import { computeOperationalDeficits } from "@/lib/deficits";
import type { HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";

describe("deterministic operational deficits", () => {
  const mockHospital: HospitalCapacity = {
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
    departments: [],
  };

  const mockResources: ResourceStatus = {
    summary: {},
    beds: [],
    operatingRooms: [
      { id: "or-1", roomNumber: "OR-1", status: "OPEN", isEmergencyCleared: true },
      { id: "or-2", roomNumber: "OR-2", status: "OPEN", isEmergencyCleared: true },
      { id: "or-3", roomNumber: "OR-3", status: "IN_USE", isEmergencyCleared: false },
      { id: "or-4", roomNumber: "OR-4", status: "IN_USE", isEmergencyCleared: false },
      { id: "or-5", roomNumber: "OR-5", status: "IN_USE", isEmergencyCleared: false },
    ],
    staff: [
      { id: "s-1", name: "Dr. Chen", role: "TRAUMA_SURGEON", department: "ED", isOnDuty: true, isAssigned: false },
      { id: "s-2", name: "Dr. Vance", role: "TRAUMA_SURGEON", department: "Surgery", isOnDuty: true, isAssigned: false },
      { id: "s-3", name: "Dr. Rostova", role: "TRAUMA_SURGEON", department: "ED", isOnDuty: true, isAssigned: false },
    ],
    ambulances: [],
    bloodInventory: [
      { id: "b-1", bloodType: "O_NEG", unitsAvailable: 18, minimumThreshold: 10 },
    ],
    lastUpdated: "2026-09-26T12:00:00Z",
  };

  const mockIncident: Incident = {
    id: "INC-MCI-01",
    title: "Highway Interstate 95 Collision",
    incidentType: "MASS_CASUALTY_COLLISION",
    severity: "CRITICAL",
    casualtyCount: 42,
    location: "Mile Marker 48",
    etaMinutes: 25,
    status: "REPORTED",
    createdAt: "2026-09-26T12:00:00Z",
    updatedAt: "2026-09-26T12:00:00Z",
  };

  it("calculates exact ED surge deficit from incident casualties and available beds", () => {
    const deficits = computeOperationalDeficits(mockHospital, mockResources, mockIncident);
    const edDeficit = deficits.find((d) => d.id === "ed-surge-deficit");

    expect(edDeficit).toBeDefined();
    expect(edDeficit?.severity).toBe("CRITICAL");
    // 42 casualties - 12 available beds = 30 bed deficit
    expect(edDeficit?.derivedMetric.value).toBe("-30 beds");
    expect(edDeficit?.derivedMetric.source).toBe("DERIVED");
    expect(edDeficit?.backendSources).toEqual([
      { label: "Incoming Casualties", value: 42, source: "BACKEND" },
      { label: "Available ED Beds", value: 12, source: "BACKEND" },
      { label: "Total ED Capacity", value: 20, source: "BACKEND" },
    ]);
  });

  it("calculates baseline occupancy when no active incident exists", () => {
    const deficits = computeOperationalDeficits(mockHospital, mockResources, undefined);
    const edOccupancy = deficits.find((d) => d.id === "ed-baseline-occupancy");

    expect(edOccupancy).toBeDefined();
    // 20 total - 12 available = 8 occupied => 8/20 = 40%
    expect(edOccupancy?.derivedMetric.value).toBe("40% (8/20 occupied)");
    expect(edOccupancy?.severity).toBe("NOMINAL");
  });

  it("calculates ICU buffer deterministically", () => {
    const deficits = computeOperationalDeficits(mockHospital, mockResources, mockIncident);
    const icu = deficits.find((d) => d.id === "icu-surge-buffer");

    expect(icu).toBeDefined();
    expect(icu?.severity).toBe("WARNING"); // 4 available <= 4
    expect(icu?.derivedMetric.value).toContain("60% (6/10 occupied)");
  });

  it("calculates OR clearance requirement deterministically", () => {
    const deficits = computeOperationalDeficits(mockHospital, mockResources, mockIncident);
    const or = deficits.find((d) => d.id === "or-theater-readiness");

    expect(or).toBeDefined();
    // 5 total - 2 open = 3 occupied/elective
    expect(or?.derivedMetric.value).toBe("3 occupied / elective");
  });

  it("calculates O-negative blood reserve margin above threshold", () => {
    const deficits = computeOperationalDeficits(mockHospital, mockResources, mockIncident);
    const blood = deficits.find((d) => d.id === "blood-oneg-reserves");

    expect(blood).toBeDefined();
    // 18 available - 10 threshold = +8 buffer
    expect(blood?.derivedMetric.value).toBe("+8 units buffer");
    expect(blood?.severity).toBe("NOMINAL");
  });

  it("calculates trauma surgeon ratio based on incoming casualties", () => {
    const deficits = computeOperationalDeficits(mockHospital, mockResources, mockIncident);
    const staff = deficits.find((d) => d.id === "trauma-staffing-load");

    expect(staff).toBeDefined();
    // 42 casualties / 3 surgeons = 14:1 ratio
    expect(staff?.derivedMetric.value).toBe("14:1 ratio");
    expect(staff?.severity).toBe("CRITICAL"); // ratio > 12 is critical
  });
});
