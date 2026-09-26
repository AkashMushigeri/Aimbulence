/**
 * Safety classification primitives.
 *
 * Source of truth: `instruction.md` section 6 ("Agent Authority & Action
 * Classification") and `backend/app/models/actions.py::ActionSafetyTier`
 * (read-only reference to `origin/member-1:docs/api_contract.md`).
 *
 * The three tiers encode the governing principle:
 *   "The agent is autonomous in execution, but not autonomous in authority."
 */
export const SAFETY_TIERS = ["GREEN", "YELLOW", "RED"] as const;

export type SafetyTier = (typeof SAFETY_TIERS)[number];

/** GREEN / YELLOW actions may proceed without a human gate. RED may not. */
export function requiresHumanApproval(tier: SafetyTier): boolean {
  return tier === "RED";
}
