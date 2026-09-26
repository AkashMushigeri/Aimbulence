/**
 * State-verification and audit domain models.
 *
 * VerificationResult is PROVISIONAL. The backend exposes no dedicated
 * verification schema; it only surfaces a boolean `verified` on
 * `backend/app/models/actions.py::ActionResponse`. The fields below are shaped
 * by `instruction.md` section 17, which forbids assuming success from a
 * non-throwing tool call.
 *
 * AuditEvent is contract-backed (`docs/api_contract.md` section 2.6,
 * `backend/app/models/actions.py::AuditEvent`).
 */
import type { SafetyTier } from "./safety";

export type VerificationState = "PENDING" | "VERIFIED" | "FAILED" | "NOT_VERIFIED";

export interface VerificationResult {
  readonly actionId: string;
  readonly state: VerificationState;
  /**
   * Human-readable summary of what was re-queried and what the connected
   * system actually returned. Required before `state` may become "VERIFIED".
   */
  readonly evidence?: string;
  readonly verifiedAt?: string;
}

export const AUDIT_ACTORS = ["SYSTEM", "AGENT", "OPERATOR", "TOOL_LAYER", "DISPATCH_RECEIVER"] as const;

export type AuditActor = (typeof AUDIT_ACTORS)[number] | (string & {});

/** Immutable chronological audit record (`instruction.md` section 18). */
export interface AuditEvent {
  readonly id: string;
  readonly incidentId?: string;
  /** Free-form, e.g. INCIDENT_REPORTED, ACTION_PROPOSED, APPROVAL_GRANTED. */
  readonly eventType: string;
  readonly actionName?: string;
  readonly tier?: SafetyTier;
  readonly details: Readonly<Record<string, unknown>>;
  readonly performedBy: AuditActor;
  readonly timestamp: string;
}
