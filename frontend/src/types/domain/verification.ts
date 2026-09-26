/**
 * Verification domain models and status classifications.
 *
 * SAFETY & GOVERNANCE:
 * - Distinguishes ACTION REQUESTED, ACTION EXECUTED, and STATE VERIFIED.
 * - Never treats execution success as state verification.
 * - Captures actual backend-observed disk state vs expected state.
 */

export type VerificationStatus = "VERIFIED" | "FAILED" | "PENDING";
export type VerificationState = VerificationStatus | "NOT_VERIFIED";

export type ActionExecutionPhase = "REQUESTED" | "EXECUTED" | "FAILED" | "REJECTED";

export interface ActionResult {
  readonly actionId: string;
  readonly status: ActionExecutionPhase;
  readonly resource: string;
  readonly decision?: string;
  readonly executedAt?: string;
  readonly authorizedBy?: string;
  readonly previousState?: Readonly<Record<string, unknown>>;
  readonly newState?: Readonly<Record<string, unknown>>;
  readonly error?: string | null;
}

export interface VerificationResult {
  readonly verified: boolean;
  readonly status: VerificationStatus;
  readonly targetEntity: string;
  readonly entityId: string;
  readonly expectedField: string;
  readonly expectedValue: unknown;
  readonly observedValue: unknown;
  readonly matched: boolean;
  readonly timestamp?: string;
  readonly reason?: string | null;
  readonly mismatchError?: string | null;

  // Compatibility fields
  readonly actionId?: string;
  readonly state?: VerificationState;
  readonly evidence?: string;
  readonly verifiedAt?: string;
}

/**
 * Normalizes backend verification payload into typed VerificationResult.
 */
export function toVerificationResult(raw: unknown): VerificationResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const v = raw as Record<string, unknown>;

  // Check if raw is already an inner verification dict or has 'verification' wrapper
  const verifObj = (v.verification && typeof v.verification === "object" ? v.verification : v) as Record<string, unknown>;

  const isVerified = verifObj.verified === true;
  const rawStatus = String(verifObj.status ?? "").toUpperCase();
  const status: VerificationStatus =
    isVerified || rawStatus === "VERIFIED"
      ? "VERIFIED"
      : rawStatus === "FAILED" || rawStatus === "VERIFICATION_FAILED" || verifObj.matched === false
      ? "FAILED"
      : "PENDING";

  const targetEntity = String(verifObj.target_entity ?? verifObj.targetEntity ?? "operating_room");
  const entityId = String(verifObj.entity_id ?? verifObj.entityId ?? "OR-3");
  const expectedField = String(verifObj.expected_field ?? verifObj.expectedField ?? "status");
  const expectedValue = verifObj.expected_value ?? verifObj.expectedValue ?? "RESERVED_FOR_TRAUMA";
  const observedValue = verifObj.actual_value ?? verifObj.observedValue ?? verifObj.disk_status ?? null;
  const matched = verifObj.matched !== undefined ? Boolean(verifObj.matched) : isVerified;
  const timestamp = typeof verifObj.timestamp === "string" ? verifObj.timestamp : undefined;
  const reason = typeof verifObj.reason === "string" ? verifObj.reason : null;

  let mismatchError: string | null = null;
  if (!matched && observedValue !== null && observedValue !== expectedValue) {
    mismatchError = `Expected ${expectedField}='${String(expectedValue)}', but observed='${String(observedValue)}' in database.`;
  } else if (reason) {
    mismatchError = reason;
  }

  return {
    verified: isVerified,
    status,
    targetEntity,
    entityId,
    expectedField,
    expectedValue,
    observedValue,
    matched,
    ...(timestamp ? { timestamp } : {}),
    ...(reason ? { reason } : {}),
    ...(mismatchError ? { mismatchError } : {}),
  };
}

/**
 * Normalizes backend action execution payload into typed ActionResult.
 */
export function toActionResult(raw: unknown): ActionResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const act = raw as Record<string, unknown>;
  const rawStatus = String(act.status ?? "").toUpperCase();

  const status: ActionExecutionPhase =
    rawStatus === "SUCCESS" || rawStatus === "EXECUTED"
      ? "EXECUTED"
      : rawStatus === "REJECTED" || rawStatus === "DENIED"
      ? "REJECTED"
      : rawStatus === "FAILED" || rawStatus === "ERROR"
      ? "FAILED"
      : "REQUESTED";

  return {
    actionId: String(act.action_id ?? act.actionId ?? "ACT-PREEMPT-OR3"),
    status,
    resource: String(act.resource ?? act.affected_resource ?? act.affectedResource ?? "OR-3"),
    ...(act.decision ? { decision: String(act.decision) } : {}),
    ...(typeof act.executed_at === "string" ? { executedAt: act.executed_at } : {}),
    ...(typeof act.authorized_by === "string" ? { authorizedBy: act.authorized_by } : {}),
    ...(act.previous_state && typeof act.previous_state === "object"
      ? { previousState: act.previous_state as Readonly<Record<string, unknown>> }
      : {}),
    ...(act.new_state && typeof act.new_state === "object"
      ? { newState: act.new_state as Readonly<Record<string, unknown>> }
      : {}),
    ...(typeof act.error === "string" ? { error: act.error } : {}),
  };
}
