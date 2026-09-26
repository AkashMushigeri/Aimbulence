/**
 * Server-side load of the documented read-only endpoints.
 *
 * Runs during server render so the console paints real operational state on
 * first request, without a client round trip and without ever placing the
 * backend origin in the browser bundle.
 *
 * Each section settles independently: one failing endpoint is reported as a
 * partial failure instead of blanking the whole console.
 */
import "server-only";

import { ApiConfigurationError, type ApiError } from "@/lib/errors";
import { available, failed, loadSections, LOADING, type LoadRequest, type SectionState, type SectionStates } from "@/lib/loadState";
import { getOperationsService, type BackendHealth } from "@/services/operations";
import type { AuditEvent, HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";

export const SECTION_KEYS = ["health", "hospital", "resources", "incidents", "audit"] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface ConsoleData {
  readonly configured: boolean;
  readonly sections: SectionStates;
  /** Convenience accessors so the view does not re-narrow on every panel. */
  readonly health?: BackendHealth;
  readonly hospital?: HospitalCapacity;
  readonly resources?: ResourceStatus;
  readonly incidents?: readonly Incident[];
  readonly audit?: readonly AuditEvent[];
}

/** A not-configured backend is a first-class state, not an exception. */
function unconfigured(): ConsoleData {
  const error: ApiError = new ApiConfigurationError(
    "Backend base URL is not configured. Set BACKEND_BASE_URL on the server to enable live data.",
  );
  return {
    configured: false,
    sections: {
      health: { label: "System status", state: failed(error) },
      hospital: { label: "Hospital status", state: failed(error) },
      resources: { label: "Resources", state: failed(error) },
      incidents: { label: "Incidents", state: failed(error) },
      audit: { label: "Audit trail", state: failed(error) },
    },
  };
}

export async function loadConsoleData(): Promise<ConsoleData> {
  const service = getOperationsService();
  if (!service) {
    return unconfigured();
  }

  const requests: LoadRequest<unknown>[] = [
    { key: "health", label: "System status", load: () => service.getHealth() },
    { key: "hospital", label: "Hospital status", load: () => service.getHospitalStatus() },
    { key: "resources", label: "Resources", load: () => service.getResources() },
    { key: "incidents", label: "Incidents", load: () => service.getIncidents() },
    { key: "audit", label: "Audit trail", load: () => service.getAuditLog() },
  ];

  const sections = await loadSections(requests);

  return {
    configured: true,
    sections,
    health: pick(sections.health),
    hospital: pick(sections.hospital),
    resources: pick(sections.resources),
    incidents: pick<readonly Incident[]>(sections.incidents),
    audit: pick<readonly AuditEvent[]>(sections.audit),
  };
}

function pick<T>(section: SectionState | undefined): T | undefined {
  const state = section?.state;
  if (!state || state.status !== "available") {
    return undefined;
  }
  return state.data as T;
}

export { LOADING };
