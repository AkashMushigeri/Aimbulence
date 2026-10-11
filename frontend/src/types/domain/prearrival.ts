/**
 * AIMBULENCE Pre-Arrival Emergency Coordination Domain Types.
 */

export interface Vitals {
  readonly bp?: string;
  readonly hr?: number;
  readonly spo2?: number;
  readonly temp?: string;
  readonly rr?: number;
}

export type ActionDecisionType = "PENDING" | "APPROVED" | "REJECTED" | "ACKNOWLEDGED";

export interface PreArrivalAction {
  readonly id: string;
  readonly case_id: string;
  readonly resource_category: string;
  readonly resource_name: string;
  readonly recommended_status: string;
  readonly reason: string;
  readonly hospital_availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "PREPARING" | "RESERVED";
  readonly decision_type: ActionDecisionType;
  readonly decision_by?: string;
  readonly decision_reason?: string;
  readonly decision_timestamp?: string;
  readonly requires_approval: boolean;
  readonly created_at: string;
}

export type EmergencyPriorityType = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type PreArrivalStatusType = "EN_ROUTE" | "PREPARING" | "ARRIVED" | "CANCELLED";

export interface PreArrivalCase {
  readonly id: string;
  readonly ambulance_id: string;
  readonly patient_name?: string;
  readonly patient_age?: number;
  readonly patient_gender?: string;
  readonly symptoms: readonly string[];
  readonly vitals: Vitals;
  readonly allergies?: string;
  readonly medical_conditions?: string;
  readonly current_medications?: string;
  readonly incident_type?: string;
  readonly consciousness?: string;
  readonly blood_group?: string;
  readonly oxygen_required: boolean;
  readonly pain_level?: string;
  readonly raw_description?: string;
  readonly emergency_category: string;
  readonly priority: EmergencyPriorityType;
  readonly clinical_summary: string;
  readonly current_location_name: string;
  readonly destination_hospital: string;
  readonly distance_km: number;
  readonly eta_minutes: number;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly status: PreArrivalStatusType;
  readonly immediate_actions: readonly string[];
  readonly actions: readonly PreArrivalAction[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly arrived_at?: string;
}

export interface HospitalBedMetric {
  readonly total: number;
  readonly available: number;
  readonly reserved: number;
  readonly status: string;
}

export interface PreArrivalResourcesOverview {
  readonly source: string;
  readonly hospital_name: string;
  readonly emergency_beds: HospitalBedMetric;
  readonly icu_beds: HospitalBedMetric;
  readonly operating_rooms: ReadonlyArray<{
    readonly room: string;
    readonly status: string;
    readonly procedure: string;
    readonly emergency_cleared: boolean;
  }>;
  readonly blood_inventory: ReadonlyArray<{
    readonly type: string;
    readonly units_available: number;
    readonly minimum_threshold: number;
    readonly status: string;
  }>;
  readonly trauma_surgeons: ReadonlyArray<{
    readonly name: string;
    readonly department: string;
    readonly status: string;
  }>;
  readonly scanners_and_equipment: ReadonlyArray<{
    readonly equipment: string;
    readonly location: string;
    readonly status: string;
  }>;
}

export interface CaseCreatePayload {
  ambulance_id: string;
  raw_description?: string;
  patient_name?: string;
  patient_age?: number;
  patient_gender?: string;
  symptoms?: string[];
  vitals?: Vitals;
  allergies?: string;
  medical_conditions?: string;
  current_medications?: string;
  incident_type?: string;
  consciousness?: string;
  blood_group?: string;
  oxygen_required?: boolean;
  pain_level?: string;
  current_location_name?: string;
  destination_hospital?: string;
  distance_km?: number;
  eta_minutes?: number;
}
