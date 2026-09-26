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
