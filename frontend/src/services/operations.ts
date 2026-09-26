/**
 * Documented read-only operational services.
 *
 * SCOPE — Phase 2. Exactly the six REST operations published as
 * `[IMPLEMENTED]` in `docs/api_contract.md` (Member 1, `origin/member-1`).
 *
 * Deliberately NOT implemented, because their contracts are still planned:
 *   - POST /api/agent/execute-runbook   [PLANNED - PHASE 3]
 *   - POST /api/approval/decide         [PLANNED - PHASE 4]
 * There is no WebSocket or event-stream contract, so none is used.
 *
 * Every function here is server-side: it runs through `apiClient`, which reads
 * the backend origin from server-only environment configuration. The browser
 * never sees `BACKEND_BASE_URL` and never holds a backend credential.
 */
import { assertArray, assertObject, mapOrThrow } from "@/lib/guards";
import {
  toAuditEvent,
  toHospitalCapacity,
  toIncident,
  toResourceStatus,
} from "@/lib/mappers";
import type { AuditEvent, HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";
import { API_PATHS } from "@/types/api/contracts";
import type {
  AuditEventWire,
  DecideRequestWire,
  DecideResponseWire,
  HealthResponse,
  HospitalStatusWire,
  IncidentCreateWire,
  IncidentWire,
  ResourceStatusWire,
  ResumeRunbookRequestWire,
  RunbookExecutionStateWire,
  StartRunbookRequestWire,
  StartRunbookResponseWire,
  TrueForgeApprovalCheckpointWire,
} from "@/types/api/contracts";
import { createApiClient, type ApiClient } from "./apiClient";

/** Health snapshot. The backend reports its own status strings verbatim. */
export interface BackendHealth {
  readonly status: string;
  readonly service: string;
  readonly database: string;
  readonly environment: string;
  readonly timestamp: string;
}

export interface OperationsService {
  getHealth(signal?: AbortSignal): Promise<BackendHealth>;
  getHospitalStatus(signal?: AbortSignal): Promise<HospitalCapacity>;
  getResources(signal?: AbortSignal): Promise<ResourceStatus>;
  getIncidents(signal?: AbortSignal): Promise<Incident[]>;
  createIncident(payload: IncidentCreateWire, signal?: AbortSignal): Promise<Incident>;
  getAuditLog(limit?: number, signal?: AbortSignal): Promise<AuditEvent[]>;
  listCheckpoints(stateFilter?: string, signal?: AbortSignal): Promise<TrueForgeApprovalCheckpointWire[]>;
  getCheckpoint(checkpointId: string, signal?: AbortSignal): Promise<TrueForgeApprovalCheckpointWire>;
  decideApproval(payload: DecideRequestWire, signal?: AbortSignal): Promise<DecideResponseWire>;
  startMciRunbook(payload?: StartRunbookRequestWire, signal?: AbortSignal): Promise<StartRunbookResponseWire>;
  getRunbookExecution(executionId: string, signal?: AbortSignal): Promise<RunbookExecutionStateWire>;
  getLatestRunbook(signal?: AbortSignal): Promise<RunbookExecutionStateWire | null>;
  resumeRunbook(executionId: string, reason?: string, signal?: AbortSignal): Promise<RunbookExecutionStateWire>;
}

/** `docs/api_contract.md` section 2.6: default 50, maximum 200. */
const AUDIT_DEFAULT_LIMIT = 50;
const AUDIT_MAX_LIMIT = 200;

export function createOperationsService(client: ApiClient): OperationsService {
  return {
    async getHealth(signal) {
      const wire = await client.request<HealthResponse>(API_PATHS.HEALTH, { signal });
      const body = assertObject<HealthResponse>(wire, API_PATHS.HEALTH);
      return {
        status: String(body.status),
        service: String(body.service),
        database: String(body.database),
        environment: String(body.environment),
        timestamp: String(body.timestamp),
      };
    },

    async getHospitalStatus(signal) {
      const wire = await client.request<HospitalStatusWire>(API_PATHS.HOSPITAL_STATUS, { signal });
      return mapOrThrow(
        assertObject<HospitalStatusWire>(wire, API_PATHS.HOSPITAL_STATUS),
        toHospitalCapacity,
        API_PATHS.HOSPITAL_STATUS,
      );
    },

    async getResources(signal) {
      const wire = await client.request<ResourceStatusWire>(API_PATHS.RESOURCES, { signal });
      return mapOrThrow(
        assertObject<ResourceStatusWire>(wire, API_PATHS.RESOURCES),
        toResourceStatus,
        API_PATHS.RESOURCES,
      );
    },

    async getIncidents(signal) {
      const wire = await client.request<IncidentWire[]>(API_PATHS.INCIDENTS, { signal });
      const rows = assertArray<IncidentWire>(wire, API_PATHS.INCIDENTS);
      return rows.map((row) =>
        mapOrThrow(assertObject<IncidentWire>(row, `${API_PATHS.INCIDENTS}[]`), toIncident, API_PATHS.INCIDENTS),
      );
    },

    /**
     * Reports a new incident.
     */
    async createIncident(payload, signal) {
      const wire = await client.request<IncidentWire>(API_PATHS.INCIDENTS, {
        method: "POST",
        body: payload,
        signal,
      });
      return mapOrThrow(
        assertObject<IncidentWire>(wire, `${API_PATHS.INCIDENTS} (POST)`),
        toIncident,
        `${API_PATHS.INCIDENTS} (POST)`,
      );
    },

    async getAuditLog(limit, signal) {
      const bounded = Math.min(
        AUDIT_MAX_LIMIT,
        Math.max(1, limit ?? AUDIT_DEFAULT_LIMIT),
      );
      const wire = await client.request<AuditEventWire[]>(API_PATHS.AUDIT_LOG, {
        query: { limit: bounded },
        signal,
      });
      const rows = assertArray<AuditEventWire>(wire, API_PATHS.AUDIT_LOG);
      return rows.map((row) =>
        mapOrThrow(assertObject<AuditEventWire>(row, `${API_PATHS.AUDIT_LOG}[]`), toAuditEvent, API_PATHS.AUDIT_LOG),
      );
    },

    async listCheckpoints(stateFilter, signal) {
      const query = stateFilter ? { state: stateFilter } : undefined;
      const wire = await client.request<TrueForgeApprovalCheckpointWire[]>(API_PATHS.APPROVAL_CHECKPOINTS, {
        query,
        signal,
      });
      return assertArray<TrueForgeApprovalCheckpointWire>(wire, API_PATHS.APPROVAL_CHECKPOINTS);
    },

    async getCheckpoint(checkpointId, signal) {
      const path = `${API_PATHS.APPROVAL_CHECKPOINTS}/${encodeURIComponent(checkpointId)}`;
      const wire = await client.request<TrueForgeApprovalCheckpointWire>(path, { signal });
      return assertObject<TrueForgeApprovalCheckpointWire>(wire, path);
    },

    async decideApproval(payload, signal) {
      const wire = await client.request<DecideResponseWire>(API_PATHS.APPROVAL_DECIDE, {
        method: "POST",
        body: payload,
        signal,
      });
      return assertObject<DecideResponseWire>(wire, API_PATHS.APPROVAL_DECIDE);
    },

    async startMciRunbook(payload, signal) {
      const wire = await client.request<StartRunbookResponseWire>(API_PATHS.RUNBOOKS_START_MCI, {
        method: "POST",
        body: payload ?? {},
        signal,
      });
      return assertObject<StartRunbookResponseWire>(wire, API_PATHS.RUNBOOKS_START_MCI);
    },

    async getRunbookExecution(executionId, signal) {
      const path = API_PATHS.RUNBOOKS_EXECUTION(encodeURIComponent(executionId));
      const wire = await client.request<RunbookExecutionStateWire>(path, { signal });
      return assertObject<RunbookExecutionStateWire>(wire, path);
    },

    async getLatestRunbook(signal) {
      try {
        const path = API_PATHS.RUNBOOKS_LATEST;
        const wire = await client.request<RunbookExecutionStateWire>(path, { signal });
        return assertObject<RunbookExecutionStateWire>(wire, path);
      } catch {
        return null;
      }
    },
    async resumeRunbook(executionId, reason, signal) {
      const path = API_PATHS.RUNBOOKS_RESUME(encodeURIComponent(executionId));
      const body: ResumeRunbookRequestWire = reason ? { reason } : {};
      const wire = await client.request<RunbookExecutionStateWire>(path, {
        method: "POST",
        body,
        signal,
      });
      return assertObject<RunbookExecutionStateWire>(wire, path);
    },
  };
}

let sharedService: OperationsService | null = null;

/**
 * Lazily-created server-side service bound to the ambient environment.
 * Returns `null` when no backend is configured, so callers can degrade to an
 * explicit "disconnected" state instead of throwing during render.
 */
export function getOperationsService(): OperationsService | null {
  if (sharedService) {
    return sharedService;
  }
  const client = createApiClient();
  if (!client.describe().configured) {
    return null;
  }
  sharedService = createOperationsService(client);
  return sharedService;
}
