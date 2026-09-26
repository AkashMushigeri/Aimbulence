/**
 * Hospital capacity and resource availability domain models.
 *
 * Contract-backed: mirrored from `origin/member-1:docs/api_contract.md`
 * sections 2.2/2.3 and `backend/app/models/hospital.py` /
 * `backend/app/models/resources.py`.
 *
 * These describe *operational assets and staff availability only*. They carry
 * no patient data and no clinical meaning (`instruction.md` section 5).
 */

export const EMERGENCY_CODES = ["NORMAL", "CODE_YELLOW", "CODE_ORANGE", "CODE_RED"] as const;

export type EmergencyCode = (typeof EMERGENCY_CODES)[number];

export const DEPARTMENT_TYPES = [
  "EMERGENCY",
  "ICU",
  "SURGERY",
  "TRAUMA",
  "GENERAL_WARD",
  "BLOOD_BANK",
] as const;

export type DepartmentType = (typeof DEPARTMENT_TYPES)[number];

export interface DepartmentStatus {
  readonly name: string;
  readonly departmentType: DepartmentType;
  readonly totalBeds: number;
  readonly availableBeds: number;
  readonly occupiedBeds: number;
  readonly staffOnDuty: number;
  readonly statusNote?: string;
}

/** Aggregate operational capacity snapshot for the whole facility. */
export interface HospitalCapacity {
  readonly hospitalName: string;
  readonly operationalCode: EmergencyCode;
  readonly emergencyBedsAvailable: number;
  readonly emergencyBedsTotal: number;
  readonly icuBedsAvailable: number;
  readonly icuBedsTotal: number;
  readonly operatingRoomsAvailable: number;
  readonly operatingRoomsTotal: number;
  readonly doctorsAvailable: number;
  readonly nursesAvailable: number;
  readonly ambulancesAvailable: number;
  readonly bloodUnitsAvailable: number;
  readonly activeIncidentCount: number;
  readonly lastUpdated: string;
  readonly departments: readonly DepartmentStatus[];
}

export const STAFF_ROLES = [
  "DOCTOR",
  "TRAUMA_SURGEON",
  "NURSE",
  "PARAMEDIC",
  "ANESTHESIOLOGIST",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffMember {
  readonly id: string;
  /** Synthetic staff name. Never a real patient or clinician identity. */
  readonly name: string;
  readonly role: StaffRole;
  readonly department: string;
  readonly isOnDuty: boolean;
  readonly isAssigned: boolean;
}

/**
 * Staff availability is derived by the frontend from `ResourceStatus.staff`;
 * the backend exposes no dedicated aggregate model.
 */
export interface StaffAvailability {
  readonly totalOnDuty: number;
  readonly available: number;
  readonly assigned: number;
  readonly byRole: Readonly<Partial<Record<StaffRole, number>>>;
}

export const BED_TYPES = ["EMERGENCY", "ICU", "SURGICAL", "GENERAL"] as const;

export type BedType = (typeof BED_TYPES)[number];

export interface Bed {
  readonly id: string;
  readonly bedCode: string;
  readonly bedType: BedType;
  readonly department: string;
  readonly isOccupied: boolean;
  readonly isReserved: boolean;
}

export const OPERATING_ROOM_STATUSES = [
  "OPEN",
  "IN_USE",
  "RESERVED_FOR_TRAUMA",
  "MAINTENANCE",
] as const;

export type OperatingRoomStatus = (typeof OPERATING_ROOM_STATUSES)[number];

export interface OperatingRoom {
  readonly id: string;
  readonly roomNumber: string;
  readonly status: OperatingRoomStatus;
  /** Synthetic procedure label; operational scheduling data only. */
  readonly scheduledProcedure?: string;
  readonly isEmergencyCleared: boolean;
}

export const AMBULANCE_STATUSES = ["AVAILABLE", "DISPATCHED", "RETURNING", "MAINTENANCE"] as const;

export type AmbulanceStatus = (typeof AMBULANCE_STATUSES)[number];

export interface Ambulance {
  readonly id: string;
  readonly vehicleCode: string;
  readonly status: AmbulanceStatus;
  readonly crewAssigned: boolean;
}

export const BLOOD_TYPES = [
  "O_NEG",
  "O_POS",
  "A_NEG",
  "A_POS",
  "B_NEG",
  "B_POS",
  "AB_NEG",
  "AB_POS",
] as const;

export type BloodType = (typeof BLOOD_TYPES)[number];

export interface BloodInventory {
  readonly id: string;
  readonly bloodType: BloodType;
  readonly unitsAvailable: number;
  readonly minimumThreshold: number;
}

/** Detailed inventory across every operational asset. */
export interface ResourceStatus {
  readonly summary: Readonly<Record<string, number>>;
  readonly beds: readonly Bed[];
  readonly operatingRooms: readonly OperatingRoom[];
  readonly staff: readonly StaffMember[];
  readonly ambulances: readonly Ambulance[];
  readonly bloodInventory: readonly BloodInventory[];
  readonly lastUpdated: string;
}
