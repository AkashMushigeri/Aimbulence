import { describe, expect, it } from "vitest";

import {
  toAuditEvent,
  toHospitalCapacity,
  toIncident,
  toResourceStatus,
  toStaffAvailability,
} from "@/lib/mappers";
import type {
  AuditEventWire,
  HospitalStatusWire,
  IncidentWire,
  ResourceStatusWire,
} from "@/types/api/contracts";

/**
 * Mapper contract fidelity.
 *
 * Fixtures below are transcriptions of the example payloads published in
 * `docs/api_contract.md` (Member 1), not invented product data.
 */
const HOSPITAL_WIRE: HospitalStatusWire = {
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
  active_incidents_count: 0,
  last_updated: "2026-09-26T12:00:00.000000Z",
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

const RESOURCES_WIRE: ResourceStatusWire = {
  summary: { total_beds: 30, available_beds: 16, total_staff_on_duty: 24 },
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
      name: "Nurse A. Reyes",
      role: "NURSE",
      department: "Emergency Department",
      is_on_duty: true,
      is_assigned: true,
    },
    {
      id: "staff-doc-02",
      name: "Dr. R. Osei",
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
  last_updated: "2026-09-26T12:00:00.000000Z",
};

describe("toHospitalCapacity", () => {
  it("maps every documented field to its domain name", () => {
    const capacity = toHospitalCapacity(HOSPITAL_WIRE);

    expect(capacity.hospitalName).toBe("Metro Central Trauma Hospital");
    expect(capacity.operationalCode).toBe("NORMAL");
    expect(capacity.emergencyBedsAvailable).toBe(12);
    expect(capacity.operatingRoomsTotal).toBe(5);
    expect(capacity.activeIncidentCount).toBe(0);
    expect(capacity.departments[0]?.departmentType).toBe("EMERGENCY");
    expect(capacity.departments[0]?.staffOnDuty).toBe(12);
  });

  it("omits an absent department note rather than inventing one", () => {
    const capacity = toHospitalCapacity({
      ...HOSPITAL_WIRE,
      departments: [{ ...HOSPITAL_WIRE.departments[0]!, status_note: null }],
    });

    expect(capacity.departments[0]?.statusNote).toBeUndefined();
  });

  it("throws on a contract violation instead of silently defaulting", () => {
    expect(() =>
      toHospitalCapacity({ ...HOSPITAL_WIRE, hospital_name: null as unknown as string }),
    ).toThrow(TypeError);
  });
});

describe("toResourceStatus", () => {
  it("maps nested resource collections", () => {
    const resources = toResourceStatus(RESOURCES_WIRE);

    expect(resources.beds[0]?.bedCode).toBe("ED-01");
    expect(resources.operatingRooms[0]?.roomNumber).toBe("OR-3");
    expect(resources.operatingRooms[0]?.scheduledProcedure).toBe("Elective Arthroscopic Knee Debridement");
    expect(resources.ambulances[0]?.vehicleCode).toBe("MEDIC-01");
    expect(resources.bloodInventory[0]?.unitsAvailable).toBe(18);
  });
});

describe("toStaffAvailability", () => {
  it("counts only on-duty staff and splits assigned from available", () => {
    const availability = toStaffAvailability(toResourceStatus(RESOURCES_WIRE).staff);

    expect(availability.totalOnDuty).toBe(2);
    expect(availability.available).toBe(1);
    expect(availability.assigned).toBe(1);
    expect(availability.byRole.TRAUMA_SURGEON).toBe(1);
    expect(availability.byRole.DOCTOR).toBeUndefined();
  });
});

describe("toIncident and toAuditEvent", () => {
  it("maps an incident and drops a null description", () => {
    const wire: IncidentWire = {
      id: "INC-7A8B9C0D",
      title: "Highway Interstate 95 Multi-Vehicle Transit Collision",
      incident_type: "MASS_CASUALTY_COLLISION",
      severity: "CRITICAL",
      casualty_count: 42,
      location: "Mile Marker 48 Southbound",
      eta_minutes: 25,
      description: null,
      status: "REPORTED",
      created_at: "2026-09-26T12:05:00.000000Z",
      updated_at: "2026-09-26T12:05:00.000000Z",
    };

    const incident = toIncident(wire);

    expect(incident.id).toBe("INC-7A8B9C0D");
    expect(incident.casualtyCount).toBe(42);
    expect(incident.etaMinutes).toBe(25);
    expect(incident.description).toBeUndefined();
  });

  it("maps an audit event and preserves optional nulls as absent", () => {
    const wire: AuditEventWire = {
      id: "3b12c45d-1234-5678-9abc-0123456789ab",
      incident_id: null,
      event_type: "SYSTEM_INITIALIZED",
      action_name: "SEED_BASELINE_CAPACITY",
      tier: "GREEN",
      details: { message: "baseline initialized" },
      performed_by: "SYSTEM",
      timestamp: "2026-09-26T12:00:00.000000Z",
    };

    const event = toAuditEvent(wire);

    expect(event.incidentId).toBeUndefined();
    expect(event.tier).toBe("GREEN");
    expect(event.performedBy).toBe("SYSTEM");
  });
});
