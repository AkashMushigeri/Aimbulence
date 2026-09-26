import { describe, expect, it } from "vitest";

import { SAFETY_TIERS, requiresHumanApproval } from "@/types/domain/safety";
import { INCIDENT_STATUSES, INCIDENT_SEVERITIES, INCIDENT_TYPES } from "@/types/domain/incident";
import { APPROVAL_DECISIONS } from "@/types/domain/approval";
import { EXECUTION_STATUSES, isAgentBlocked } from "@/types/domain/execution";
import { MCI_01_APPROVAL_GATE_STEP_INDEXES, MCI_01_STEPS, PRIMARY_RUNBOOK_ID } from "@/lib/scenario";
import type { AgentExecutionState, ApprovalDecisionType, SafetyTier } from "@/types/domain";

/**
 * Domain type foundation.
 *
 * The `expectTypeOf` blocks below are compile-time assertions: if a type stops
 * existing or drifts, `npm run typecheck` fails even if the runtime suite passes.
 */
describe("documented safety vocabulary", () => {
  it("exposes exactly the three documented tiers", () => {
    expect(SAFETY_TIERS).toEqual(["GREEN", "YELLOW", "RED"]);
  });

  it("gates only RED actions behind a human decision", () => {
    const gated: Record<SafetyTier, boolean> = {
      GREEN: requiresHumanApproval("GREEN"),
      YELLOW: requiresHumanApproval("YELLOW"),
      RED: requiresHumanApproval("RED"),
    };

    expect(gated).toEqual({ GREEN: false, YELLOW: false, RED: true });
  });

  it("exposes exactly the three documented approval decisions", () => {
    expect(APPROVAL_DECISIONS).toEqual(["APPROVE", "MODIFY", "REJECT"]);
  });

  it("keeps incident and execution vocabularies in sync with the contract", () => {
    expect(INCIDENT_TYPES).toContain("MASS_CASUALTY_COLLISION");
    expect(INCIDENT_SEVERITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(INCIDENT_STATUSES).toEqual([
      "REPORTED",
      "TRIAGING",
      "MOBILIZING",
      "RESOLVED",
      "CANCELLED",
    ]);
    expect(EXECUTION_STATUSES).toContain("AWAITING_APPROVAL");
  });
});

describe("agent blocking semantics", () => {
  const base: AgentExecutionState = {
    executionId: "RUN-9821ABCD",
    incidentId: "INC-7A8B9C0D",
    runbookId: "MCI-01",
    status: "RUNNING",
    currentStep: 3,
    totalSteps: 15,
    activeCheckpoint: null,
    gateState: "NOT_BLOCKED",
    startedAt: "2026-09-26T12:06:00.000000Z",
  };

  it("is not blocked while running", () => {
    expect(isAgentBlocked(base)).toBe(false);
  });

  it("is blocked at an approval checkpoint", () => {
    expect(
      isAgentBlocked({
        ...base,
        status: "AWAITING_APPROVAL",
        activeCheckpoint: "CHK-4491-RED",
        gateState: "AWAITING_OPERATOR",
      }),
    ).toBe(true);
  });
});

describe("documented MCI-01 sequence", () => {
  it("carries the fifteen documented steps in order", () => {
    expect(MCI_01_STEPS).toHaveLength(15);
    expect(MCI_01_STEPS[0]?.title).toBe("Receive Emergency Incident Alert");
    expect(MCI_01_STEPS[14]?.title).toBe(
      "Log Immutable Audit Record; Escalate if Deficits Remain Unresolved",
    );
  });

  it("identifies the human-in-the-loop gate steps", () => {
    expect(MCI_01_APPROVAL_GATE_STEP_INDEXES).toEqual([10, 11, 12]);
  });

  it("scopes to the single in-scope runbook", () => {
    expect(PRIMARY_RUNBOOK_ID).toBe("MCI-01");
  });
});

describe("compile-time type assertions", () => {
  it("keeps the documented union types intact", () => {
    // Valid members of the documented unions.
    const decision: ApprovalDecisionType = "MODIFY";
    const tier: SafetyTier = "YELLOW";

    // The lines below must fail `tsc`. `@ts-expect-error` makes the test suite
    // fail to compile if the unions ever widen to accept undocumented values.
    // @ts-expect-error -- "CANCEL" is not a documented approval decision.
    const invalidDecision: ApprovalDecisionType = "CANCEL";
    // @ts-expect-error -- "BLUE" is not a documented safety tier.
    const invalidTier: SafetyTier = "BLUE";

    expect(decision).toBe("MODIFY");
    expect(tier).toBe("YELLOW");

    // Runtime confirmation that the deliberately invalid values are the
    // undocumented strings, i.e. the type layer is the only thing rejecting them.
    expect(invalidDecision as string).toBe("CANCEL");
    expect(invalidTier as string).toBe("BLUE");
  });
});
