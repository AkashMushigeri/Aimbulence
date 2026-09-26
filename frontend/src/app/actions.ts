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
