/**
 * Emergency incident domain model.
 *
 * Field set is contract-backed: mirrored from
 * `origin/member-1:docs/api_contract.md` section 2.4/2.5 and
 * `backend/app/models/incidents.py`. Domain form uses camelCase; the wire form
 * lives in `src/types/api/contracts.ts`.
 *
 * Scope note (`instruction.md` section 4): v1 supports exactly ONE incident
 * scenario, a multi-vehicle mass-casualty collision. The type therefore stays
 * generic and carries no scenario values.
 */
export const INCIDENT_TYPES = [
  "MASS_CASUALTY_COLLISION",
  "TRANSIT_ACCIDENT",
  "STRUCTURAL_COLLAPSE",
  "HAZMAT",
  "OTHER",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = [
  "REPORTED",
  "TRIAGING",
  "MOBILIZING",
  "RESOLVED",
  "CANCELLED",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface Incident {
  /** Unique incident identifier, e.g. `INC-7A8B9C0D`. */
  readonly id: string;
  readonly title: string;
  readonly incidentType: IncidentType;
  readonly severity: IncidentSeverity;
  /** Estimated incoming casualty count. Operational only — never a patient count. */
  readonly casualtyCount: number;
  readonly location: string;
  /** Estimated minutes until first arrivals. */
  readonly etaMinutes: number;
  readonly description?: string;
  readonly status: IncidentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
