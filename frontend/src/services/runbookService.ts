/**
 * Runbook Execution Query Service.
 *
 * Provides typed read-only inspection of runbook execution state from the
 * backend operations store.
 *
 * SAFETY & GOVERNANCE:
 * - Read-only query (GET) operation only.
 * - Does not invent fake or simulated execution progress.
 * - Gracefully falls back when execution engine is not connected or endpoint is unserved.
 */
import { assertObject, mapOrThrow } from "@/lib/guards";
import { toAgentExecutionState } from "@/lib/mappers";
import { PLANNED_API_PATHS } from "@/types/api/contracts";
import type { RunbookExecutionStateWire } from "@/types/api/contracts";
import type { AgentExecutionState } from "@/types/domain";
import { createApiClient, type ApiClient } from "./apiClient";

export interface RunbookService {
  /**
   * Query current execution state for a given execution ID.
   * Returns null if unserved, not found, or backend unavailable.
   */
  getExecutionStatus(executionId: string, signal?: AbortSignal): Promise<AgentExecutionState | null>;
}

export function createRunbookService(client: ApiClient): RunbookService {
  return {
    async getExecutionStatus(executionId: string, signal?: AbortSignal): Promise<AgentExecutionState | null> {
      if (!executionId) {
        return null;
      }
      try {
        const path = `${PLANNED_API_PATHS.RUNBOOK_STATUS}/${encodeURIComponent(executionId)}`;

        const wire = await client.request<RunbookExecutionStateWire>(path, { signal });
        const obj = assertObject<RunbookExecutionStateWire>(wire, path);
        return mapOrThrow(obj, toAgentExecutionState, path);
      } catch {
        return null;
      }
    },
  };
}

let sharedRunbookService: RunbookService | null = null;

export function getRunbookService(): RunbookService | null {
  if (sharedRunbookService) {
    return sharedRunbookService;
  }
  const client = createApiClient();
  if (!client.describe().configured) {
    return null;
  }
  sharedRunbookService = createRunbookService(client);
  return sharedRunbookService;
}
