/**
 * AIMBULENCE Pre-Arrival Emergency Coordination Service.
 *
 * Bridge between Next.js server components/actions and the FastAPI backend.
 * Delegates to the unified OperationsService backend client.
 */
import { createApiClient } from "./apiClient";
import { createOperationsService, type OperationsService } from "./operations";
import type {
  CaseCreatePayload,
  PreArrivalAction,
  PreArrivalCase,
  PreArrivalResourcesOverview,
} from "@/types/domain/prearrival";

export interface PreArrivalService {
  listCases(signal?: AbortSignal): Promise<PreArrivalCase[]>;
  getCase(caseId: string, signal?: AbortSignal): Promise<PreArrivalCase>;
  createCase(payload: CaseCreatePayload, signal?: AbortSignal): Promise<PreArrivalCase>;
  decideAction(
    caseId: string,
    actionId: string,
    decision: "APPROVE" | "REJECT" | "ACKNOWLEDGE",
    authorizedBy: string,
    reason?: string,
    signal?: AbortSignal,
  ): Promise<PreArrivalAction>;
  updateLocation(
    caseId: string,
    payload: { current_location_name?: string; distance_km?: number; eta_minutes?: number },
    signal?: AbortSignal,
  ): Promise<PreArrivalCase>;
  markArrived(caseId: string, signal?: AbortSignal): Promise<PreArrivalCase>;
  getResources(signal?: AbortSignal): Promise<PreArrivalResourcesOverview>;
  seedDemo(signal?: AbortSignal): Promise<PreArrivalCase>;
}

export function createPreArrivalService(opsService: OperationsService = createOperationsService(createApiClient())): PreArrivalService {
  return {
    listCases: (signal) => opsService.getPreArrivalCases(signal),
    getCase: (caseId, signal) => opsService.getPreArrivalCase(caseId, signal),
    createCase: (payload, signal) => opsService.createPreArrivalCase(payload, signal),
    decideAction: (caseId, actionId, decision, authorizedBy, reason, signal) =>
      opsService.decidePreArrivalAction(caseId, actionId, decision, authorizedBy, reason, signal),
    updateLocation: (caseId, payload, signal) => opsService.updatePreArrivalLocation(caseId, payload, signal),
    markArrived: (caseId, signal) => opsService.markPreArrivalArrived(caseId, signal),
    getResources: (signal) => opsService.getPreArrivalResources(signal),
    seedDemo: (signal) => opsService.seedPreArrivalDemo(signal),
  };
}

export const prearrivalService: PreArrivalService = createPreArrivalService();
