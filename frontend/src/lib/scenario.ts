/**
 * Documented demo-scenario reference constants.
 *
 * SOURCE: `README.md` sections "First Use Case & Scenario" and
 * "Mass-Casualty Response Runbook (`MCI-01`)".
 *
 * These are DOCUMENTATION, not runtime data. They are the target baseline the
 * agent is expected to assess against, and they exist so that the scenario can
 * be type-checked in one place.
 *
 * They are deliberately NOT wired into any rendered view. Live figures must
 * always come from the connected operational store; hard-coding these into the
 * dashboard would present fabricated operational state.
 */
import type { SafetyTier } from "@/types/domain/safety";

/** The single runbook in scope for v1 (`instruction.md` section 4). */
export const PRIMARY_RUNBOOK_ID = "MCI-01";

/** Baseline hospital constraints from the documented first-use scenario. */
export const SCENARIO_BASELINE = {
  anticipatedCasualties: 42,
  anticipationWindowMinutes: 25,
  emergencyBedsAvailable: 12,
  icuBedsAvailable: 4,
  operatingRoomsStaffedAndOpen: 2,
  operatingRoomsInElectiveUse: 3,
  traumaSurgeonsOnDuty: 3,
  emergencyCareNursesAvailable: 8,
  oNegativeBloodUnits: 18,
} as const;

/** The 15 documented `MCI-01` steps, verbatim from `README.md`. */
export const MCI_01_STEPS: readonly { readonly index: number; readonly title: string }[] = [
  { index: 1, title: "Receive Emergency Incident Alert" },
  { index: 2, title: "Validate Incident Parameters & Integrity" },
  { index: 3, title: "Assess Incident Severity & Projected Casualty Intake" },
  { index: 4, title: "Query Hospital Operational Capacity (ED, ICU, OR)" },
  { index: 5, title: "Query Staff Availability (Trauma Specialists, Surgical Teams, Emergency Nurses)" },
  { index: 6, title: "Inspect Critical Consumables & Blood Bank Reserves" },
  { index: 7, title: "Compute Projected Deficits & Capacity Shortages" },
  { index: 8, title: "Synthesize Phased Response Plan" },
  { index: 9, title: "Execute Safe Actions [GREEN] (Internal alerts, triage staging, task creation)" },
  { index: 10, title: "Halt at Consequential Action Checkpoint [RED]" },
  { index: 11, title: "Present Authorization Request with Impact Briefing to Human Operator" },
  { index: 12, title: "Await Human Decision (Approve / Modify / Reject)" },
  { index: 13, title: "Execute Approved Action (e.g., Code Orange declaration, elective OR suspension)" },
  { index: 14, title: "Verify Operational State on Real Connected System" },
  { index: 15, title: "Log Immutable Audit Record; Escalate if Deficits Remain Unresolved" },
] as const;

/** Steps 10-12 are the documented human-in-the-loop gate. */
export const MCI_01_APPROVAL_GATE_STEP_INDEXES: readonly number[] = [10, 11, 12];

/** Documented tier for each step, derived from the step's own wording. */
export const MCI_01_STEP_TIERS: Readonly<Record<number, SafetyTier>> = {
  9: "GREEN",
  10: "RED",
  11: "RED",
  12: "RED",
  13: "RED",
};
