/**
 * State-verification and audit domain models.
 *
 * AuditEvent is contract-backed (`docs/api_contract.md` section 2.6,
 * `backend/app/models/actions.py::AuditEvent`).
 */
import type { SafetyTier } from "./safety";
export type { VerificationState, VerificationResult } from "./verification";

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
