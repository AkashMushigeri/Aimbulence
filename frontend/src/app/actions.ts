"use server";

import { revalidatePath } from "next/cache";
import { getOperationsService } from "@/services/operations";
import type { IncidentCreateWire } from "@/types/api/contracts";

export interface CreateIncidentActionResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly incidentId?: string;
}

/**
 * Controlled operator action to trigger the documented MCI-01 incident.
 *
 * GOVERNANCE:
 * - Only uses fields supported by the existing contract (docs/api_contract.md §2.4).
 * - No invented request fields.
 * - Triggers backend mutation only via the verified server-side operations service.
 */
export async function triggerDocumentedMciAction(): Promise<CreateIncidentActionResult> {
  const service = getOperationsService();
  if (!service) {
    return { ok: false, message: "Backend is not configured. Cannot dispatch incident." };
  }

  const payload: IncidentCreateWire = {
    title: "Highway Interstate 95 Multi-Vehicle Transit Collision",
    incident_type: "MASS_CASUALTY_COLLISION",
    severity: "CRITICAL",
    casualty_count: 42,
    location: "Mile Marker 48 Southbound",
    eta_minutes: 25,
    description: "Charter bus and multiple passenger vehicles involved. Heavy entrapment.",
  };

  try {
    const created = await service.createIncident(payload);
    revalidatePath("/");
    return { ok: true, incidentId: created.id, message: `Incident ${created.id} successfully reported to backend.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to report emergency incident.",
    };
  }
}

export interface ApprovalActionResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly result?: import("@/types/api/contracts").DecideResponseWire;
}

/**
 * Server action to submit human approval or denial for a TrueForge checkpoint.
 *
 * Strict governance:
 * - Uses exact endpoint POST /api/approval/decide.
 * - Operator identity is strictly required (min 2 chars).
 * - Deliberate human submission only.
 */
export async function submitApprovalDecisionAction(
  payload: import("@/types/api/contracts").DecideRequestWire,
): Promise<ApprovalActionResult> {
  const service = getOperationsService();
  if (!service) {
    return { ok: false, message: "Backend is not configured. Cannot submit approval decision." };
  }

  if (!payload.checkpoint_id) {
    return { ok: false, message: "Invalid submission: Checkpoint ID is missing." };
  }

  if (!payload.decision_by || payload.decision_by.trim().length < 2) {
    return {
      ok: false,
      message: "Human operator identification is required (minimum 2 characters).",
    };
  }

  if (!["APPROVE", "REJECT", "allow", "deny"].includes(payload.decision)) {
    return {
      ok: false,
      message: `Invalid decision '${payload.decision}'. Supported values are APPROVE or REJECT.`,
    };
  }

  try {
    const response = await service.decideApproval({
      checkpoint_id: payload.checkpoint_id,
      decision: payload.decision,
      decision_by: payload.decision_by.trim(),
      reason: payload.reason ? payload.reason.trim() : undefined,
      execute_if_approved: payload.execute_if_approved ?? true,
    });
    revalidatePath("/");
    return {
      ok: true,
      result: response,
      message:
        response.checkpoint.state === "REJECTED"
          ? "Consequential action successfully rejected. Runbook blocked safely."
          : "Consequential action authorized and executed.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to submit approval decision.",
    };
  }
}

export interface RunbookActionResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly execution?:
    | import("@/types/api/contracts").StartRunbookResponseWire
    | import("@/types/api/contracts").RunbookExecutionStateWire;
}

/**
 * Server action to initiate the MCI-01 Mass Casualty Response Runbook.
 */
export async function startMciRunbookAction(
  payload?: import("@/types/api/contracts").StartRunbookRequestWire,
): Promise<RunbookActionResult> {
  const service = getOperationsService();
  if (!service) {
    return { ok: false, message: "Backend is not configured. Cannot initiate runbook." };
  }

  try {
    const res = await service.startMciRunbook(payload);
    let fullState: import("@/types/api/contracts").RunbookExecutionStateWire | null = null;
    if (res.runbook_execution_id) {
      try {
        fullState = await service.getRunbookExecution(res.runbook_execution_id);
      } catch {
        // Fall back to StartRunbookResponse
      }
    }
    revalidatePath("/");
    return {
      ok: true,
      execution: fullState ?? res,
      message: res.message,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to start MCI runbook.",
    };
  }
}

/**
 * Server action to resume a runbook paused at a TrueForge checkpoint.
 */
export async function resumeRunbookAction(
  executionId: string,
  reason?: string,
): Promise<RunbookActionResult> {
  const service = getOperationsService();
  if (!service) {
    return { ok: false, message: "Backend is not configured. Cannot resume runbook." };
  }

  try {
    const res = await service.resumeRunbook(executionId, reason);
    revalidatePath("/");
    return {
      ok: true,
      execution: res,
      message: `Runbook ${executionId} resumed. State: ${res.state}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to resume runbook.",
    };
  }
}

/**
 * Server action to fetch active checkpoints.
 */
export async function fetchCheckpointsAction(stateFilter?: string) {
  const service = getOperationsService();
  if (!service) {
    return { ok: false, checkpoints: [], message: "Backend not configured." };
  }

  try {
    const list = await service.listCheckpoints(stateFilter);
    return { ok: true, checkpoints: list };
  } catch (error) {
    return {
      ok: false,
      checkpoints: [],
      message: error instanceof Error ? error.message : "Failed to fetch checkpoints.",
    };
  }
}

/**
 * Server action to create a new en-route ambulance pre-arrival case.
 */
export async function createPreArrivalCaseAction(payload: import("@/types/domain/prearrival").CaseCreatePayload) {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const created = await prearrivalService.createCase(payload);
    revalidatePath("/");
    return { ok: true, case: created, message: `Emergency case ${created.id} initialized for ambulance ${created.ambulance_id}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to create pre-arrival emergency case.",
    };
  }
}

/**
 * Server action for authorized hospital human-in-the-loop decision (APPROVE / REJECT / ACKNOWLEDGE).
 */
export async function decidePreArrivalActionAction(
  caseId: string,
  actionId: string,
  decision: "APPROVE" | "REJECT" | "ACKNOWLEDGE",
  authorizedBy: string,
  reason?: string,
) {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const updated = await prearrivalService.decideAction(caseId, actionId, decision, authorizedBy, reason);
    revalidatePath("/");
    return { ok: true, action: updated, message: `Action ${actionId} marked ${decision} by ${authorizedBy}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to record action decision.",
    };
  }
}

/**
 * Server action to update ambulance GPS location / ETA countdown.
 */
export async function updatePreArrivalLocationAction(
  caseId: string,
  payload: { current_location_name?: string; distance_km?: number; eta_minutes?: number },
) {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const updated = await prearrivalService.updateLocation(caseId, payload);
    revalidatePath("/");
    return { ok: true, case: updated };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update ambulance telemetry.",
    };
  }
}

/**
 * Server action to mark an ambulance as arrived at the hospital.
 */
export async function markPreArrivalArrivedAction(caseId: string) {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const updated = await prearrivalService.markArrived(caseId);
    revalidatePath("/");
    return { ok: true, case: updated, message: `Ambulance ${updated.ambulance_id} arrived at trauma bay.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to record ambulance arrival.",
    };
  }
}

/**
 * Server action to seed the flagship 28yo male RTA scenario.
 */
export async function seedPreArrivalDemoAction() {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const seeded = await prearrivalService.seedDemo();
    revalidatePath("/");
    return { ok: true, case: seeded, message: "Flagship 28yo male collision demo case seeded successfully." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to seed demo case.",
    };
  }
}

/**
 * Server action to fetch active pre-arrival emergency cases.
 */
export async function fetchPreArrivalCasesAction() {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const cases = await prearrivalService.listCases();
    return { ok: true, cases };
  } catch (error) {
    return {
      ok: false,
      cases: [],
      message: error instanceof Error ? error.message : "Failed to fetch pre-arrival cases.",
    };
  }
}

/**
 * Server action to fetch real-time hospital resource matrix.
 */
export async function fetchPreArrivalResourcesAction() {
  try {
    const { prearrivalService } = await import("@/services/prearrivalService");
    const resources = await prearrivalService.getResources();
    return { ok: true, resources };
  } catch (error) {
    return {
      ok: false,
      resources: null,
      message: error instanceof Error ? error.message : "Failed to fetch hospital resources.",
    };
  }
}
