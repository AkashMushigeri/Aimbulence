import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VerificationCard, VerificationStatus } from "@/components/verification";
import { ApprovalCheckpointModal } from "@/components/approval";
import * as actions from "@/app/actions";
import {
  toVerificationResult,
  toActionResult,
  type VerificationResult,
  type ActionResult,
} from "@/types/domain";
import {
  AuditActivityPanel,
  determineEventStatus,
  determineLifecyclePhase,
} from "@/components/dashboard/AuditActivityPanel";
import { available } from "@/lib/loadState";
import type { AuditEvent } from "@/types/domain";

import { toApprovalProposal } from "@/lib/mappers";
import type { TrueForgeApprovalCheckpointWire } from "@/types/api/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const mockCheckpointWire: TrueForgeApprovalCheckpointWire = {
  checkpoint_id: "CHK-MCI-OR3",
  thread_id: "thread-1",
  tool_call_id: "call-1",
  state: "tool.approval_required",
  token_consumed: false,
  created_at: "2026-09-26T14:30:00Z",
  proposal: {
    action_id: "ACT-001",
    action_type: "PREEMPT_OPERATING_ROOM",
    risk_level: "RED",
    safety_category: "RED",
    affected_resource: "OR-3",
    current_state: { status: "IN_USE_ELECTIVE" },
    proposed_state: { status: "RESERVED_FOR_TRAUMA" },
    reason: "Incoming trauma cases",
    expected_benefit: "Immediate surgical capacity",
    potential_consequence: "Elective case deferred",
    requires_human_approval: true,
    created_at: "2026-09-26T14:30:00Z",
  },
};
const mockProposal = toApprovalProposal(mockCheckpointWire);

describe("Phase 6: State Verification UI & Governance", () => {
  const sampleVerifiedResult: VerificationResult = {
    verified: true,
    status: "VERIFIED",
    targetEntity: "operating_room",
    entityId: "OR-3",
    expectedField: "status",
    expectedValue: "RESERVED_FOR_TRAUMA",
    observedValue: "RESERVED_FOR_TRAUMA",
    matched: true,
    timestamp: "2026-09-26T14:32:00Z",
  };

  const sampleAction: ActionResult = {
    actionId: "ACT-PREEMPT-OR3",
    status: "EXECUTED",
    resource: "OR-3",
    decision: "APPROVE",
    authorizedBy: "Dr. Sarah Chen (Chief of Trauma Surgery)",
    executedAt: "2026-09-26T14:31:58Z",
  };

  it("renders VerificationCard with 3-phase progression: REQUESTED → EXECUTED → STATE VERIFIED", () => {
    render(<VerificationCard action={sampleAction} verification={sampleVerifiedResult} />);

    expect(screen.getByTestId("phase-requested")).toHaveTextContent("1. ACTION REQUESTED");
    expect(screen.getByTestId("phase-executed")).toHaveTextContent("2. ACTION EXECUTED");
    expect(screen.getByTestId("phase-verified")).toHaveTextContent("3. STATE VERIFIED");

    // Status badge
    expect(screen.getByTestId("verification-status-badge")).toHaveTextContent("VERIFIED");

    // Granular evidence fields
    expect(screen.getByTestId("verified-target-entity")).toHaveTextContent("operating_room");
    expect(screen.getByTestId("verified-affected-resource")).toHaveTextContent("OR-3");
    expect(screen.getByTestId("verification-timestamp")).toHaveTextContent("2026-09-26T14:32:00Z");
    expect(screen.getByTestId("verification-expected-state")).toHaveTextContent("RESERVED_FOR_TRAUMA");
    expect(screen.getByTestId("verification-observed-state")).toHaveTextContent("RESERVED_FOR_TRAUMA");

    // Safety governance callout
    expect(
      screen.getByText(/Never treat execution success as verification/i),
    ).toBeInTheDocument();

    // No mismatch error on verified state
    expect(screen.queryByTestId("verification-mismatch-error")).not.toBeInTheDocument();
  });

  it("renders VerificationCard with discrepancy / mismatch error when disk state diverges", () => {
    const failedVerification: VerificationResult = {
      verified: false,
      status: "FAILED",
      targetEntity: "operating_room",
      entityId: "OR-3",
      expectedField: "status",
      expectedValue: "RESERVED_FOR_TRAUMA",
      observedValue: "IN_USE_ELECTIVE",
      matched: false,
      timestamp: "2026-09-26T14:32:05Z",
      mismatchError:
        "Expected status='RESERVED_FOR_TRAUMA', but observed='IN_USE_ELECTIVE' in database.",
    };

    render(<VerificationCard action={sampleAction} verification={failedVerification} />);

    expect(screen.getByTestId("verification-status-badge")).toHaveTextContent("FAILED");
    expect(screen.getByTestId("verification-observed-state")).toHaveTextContent("IN_USE_ELECTIVE");

    const mismatchEl = screen.getByTestId("verification-mismatch-error");
    expect(mismatchEl).toBeInTheDocument();
    expect(mismatchEl).toHaveTextContent("State Mismatch / Discrepancy Detected");
    expect(mismatchEl).toHaveTextContent("Expected status='RESERVED_FOR_TRAUMA'");
  });

  it("renders pending VerificationCard gracefully", () => {
    const pendingVerification: VerificationResult = {
      verified: false,
      status: "PENDING",
      targetEntity: "operating_room",
      entityId: "OR-3",
      expectedField: "status",
      expectedValue: "RESERVED_FOR_TRAUMA",
      observedValue: null,
      matched: false,
    };

    render(<VerificationCard verification={pendingVerification} />);

    expect(screen.getByTestId("verification-status-badge")).toHaveTextContent("PENDING");
    expect(screen.getByTestId("verification-observed-state")).toHaveTextContent("null (Not recorded)");
    expect(screen.getByTestId("verification-timestamp")).toHaveTextContent("AWAITING BACKEND VERIFICATION");
  });

  it("normalizes backend raw payloads correctly via toVerificationResult and toActionResult", () => {
    const rawBackendVerification = {
      verified: true,
      status: "VERIFIED",
      target_entity: "operating_room",
      entity_id: "OR-3",
      expected_field: "status",
      expected_value: "RESERVED_FOR_TRAUMA",
      actual_value: "RESERVED_FOR_TRAUMA",
      matched: true,
      timestamp: "2026-09-26T14:32:00Z",
    };

    const parsed = toVerificationResult(rawBackendVerification);
    expect(parsed).not.toBeNull();
    expect(parsed?.verified).toBe(true);
    expect(parsed?.status).toBe("VERIFIED");
    expect(parsed?.targetEntity).toBe("operating_room");
    expect(parsed?.entityId).toBe("OR-3");
    expect(parsed?.expectedValue).toBe("RESERVED_FOR_TRAUMA");
    expect(parsed?.observedValue).toBe("RESERVED_FOR_TRAUMA");

    const rawBackendAction = {
      action_id: "ACT-001",
      status: "SUCCESS",
      resource: "OR-3",
      decision: "APPROVE",
      authorized_by: "Chief Surgeon",
      executed_at: "2026-09-26T14:31:00Z",
    };

    const parsedAction = toActionResult(rawBackendAction);
    expect(parsedAction).not.toBeNull();
    expect(parsedAction?.status).toBe("EXECUTED");
    expect(parsedAction?.resource).toBe("OR-3");
    expect(parsedAction?.authorizedBy).toBe("Chief Surgeon");
  });

  it("detects mismatch in toVerificationResult when matched is false", () => {
    const rawMismatch = {
      verified: false,
      status: "VERIFICATION_FAILED",
      target_entity: "operating_room",
      entity_id: "OR-3",
      expected_field: "status",
      expected_value: "RESERVED_FOR_TRAUMA",
      actual_value: "OCCUPIED",
      matched: false,
    };

    const parsed = toVerificationResult(rawMismatch);
    expect(parsed?.status).toBe("FAILED");
    expect(parsed?.mismatchError).toContain("Expected status='RESERVED_FOR_TRAUMA', but observed='OCCUPIED'");
  });

  it("renders VerificationCard in ApprovalCheckpointModal when decision is approved and verified", async () => {
    vi.spyOn(actions, "submitApprovalDecisionAction").mockResolvedValueOnce({
      ok: true,
      result: {
        status: "SUCCESS",
        checkpoint: {
          checkpoint_id: "CHK-MCI-OR3",
          thread_id: "thread-1",
          tool_call_id: "call-1",
          state: "EXECUTED",
          token_consumed: true,
          created_at: "2026-09-26T14:30:00Z",
          proposal: {
            action_id: "ACT-001",
            action_type: "preempt_resource",
            risk_level: "HIGH",
            safety_category: "RED",
            affected_resource: "OR-3",
            current_state: { status: "IN_USE_ELECTIVE" },
            proposed_state: { status: "RESERVED_FOR_TRAUMA" },
            reason: "Incoming trauma cases",
            expected_benefit: "Immediate surgical capacity",
            potential_consequence: "Elective case deferred",
            requires_human_approval: true,
            created_at: "2026-09-26T14:30:00Z",
          },
        },
        execution: {
          status: "SUCCESS",
          checkpoint_id: "CHK-MCI-OR3",
          action_id: "ACT-001",
          resource: "OR-3",
          decision: "APPROVE",
          authorized_by: "Dr. Sarah Chen",
          executed_at: "2026-09-26T14:32:00Z",
          previous_state: { status: "IN_USE_ELECTIVE" },
          new_state: { status: "RESERVED_FOR_TRAUMA" },
          verification: {
            verified: true,
            status: "VERIFIED",
            target_entity: "operating_room",
            entity_id: "OR-3",
            expected_field: "status",
            expected_value: "RESERVED_FOR_TRAUMA",
            actual_value: "RESERVED_FOR_TRAUMA",
            matched: true,
            timestamp: "2026-09-26T14:32:01Z",
          },
          audit_recorded: true,
        },
      },
    });

    render(
      <ApprovalCheckpointModal
        isOpen={true}
        proposal={mockProposal}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("operator-name-input"), {
      target: { value: "Dr. Sarah Chen" },
    });
    fireEvent.click(screen.getByTestId("decision-approve-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("resolved-execution-details")).toBeInTheDocument();
      expect(screen.getByTestId("verification-card")).toBeInTheDocument();
      expect(screen.getByTestId("phase-verified")).toBeInTheDocument();
      expect(screen.getByTestId("verified-affected-resource")).toHaveTextContent("OR-3");
    });
  });

  it("renders rejection safety notice and keeps SQLite unmodified when decision is rejected", async () => {
    vi.spyOn(actions, "submitApprovalDecisionAction").mockResolvedValueOnce({
      ok: true,
      result: {
        status: "SUCCESS",
        checkpoint: {
          checkpoint_id: "CHK-MCI-OR3",
          thread_id: "thread-1",
          tool_call_id: "call-1",
          state: "REJECTED",
          token_consumed: true,
          created_at: "2026-09-26T14:30:00Z",
          proposal: {
            action_id: "ACT-001",
            action_type: "preempt_resource",
            risk_level: "HIGH",
            safety_category: "RED",
            affected_resource: "OR-3",
            current_state: { status: "IN_USE_ELECTIVE" },
            proposed_state: { status: "RESERVED_FOR_TRAUMA" },
            reason: "Incoming trauma cases",
            expected_benefit: "Immediate surgical capacity",
            potential_consequence: "Elective case deferred",
            requires_human_approval: true,
            created_at: "2026-09-26T14:30:00Z",
          },
        },
        execution: null,
      },
    });

    render(
      <ApprovalCheckpointModal
        isOpen={true}
        proposal={mockProposal}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("operator-name-input"), {
      target: { value: "Dr. Sarah Chen" },
    });
    fireEvent.click(screen.getByTestId("decision-reject-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("resolved-execution-details")).toBeInTheDocument();
      expect(screen.getByTestId("rejection-safety-notice")).toBeInTheDocument();
      expect(screen.getByText(/Safety Boundary Maintained/i)).toBeInTheDocument();
      expect(screen.queryByTestId("verification-card")).not.toBeInTheDocument();
    });
  });
});

describe("Phase 6: Audit Trail & Chronological Execution Lifecycle", () => {
  it("determines correct lifecycle phase for different audit events", () => {
    const stepEvent: AuditEvent = {
      id: "aud-1",
      incidentId: "INC-MCI-001",
      eventType: "RUNBOOK_STEP_STARTED",
      actionName: undefined,
      tier: "GREEN",
      details: { step_number: 1, runbook_id: "MCI-01" },
      performedBy: "TrueForge Agent",
      timestamp: "2026-09-26T14:30:00Z",
    };
    expect(determineLifecyclePhase(stepEvent)).toBe("RUNBOOK_STEP");

    const actionEvent: AuditEvent = {
      id: "aud-2",
      incidentId: "INC-MCI-001",
      eventType: "TOOL_CALL_PROPOSED",
      actionName: "assess_capacity_deficits",
      tier: "GREEN",
      details: { tool_name: "assess_capacity_deficits" },
      performedBy: "TrueForge Agent",
      timestamp: "2026-09-26T14:30:10Z",
    };
    expect(determineLifecyclePhase(actionEvent)).toBe("ACTION");

    const approvalEvent: AuditEvent = {
      id: "aud-3",
      incidentId: "INC-MCI-001",
      eventType: "CHECKPOINT_RESOLVED",
      actionName: undefined,
      tier: "RED",
      details: {
        checkpoint_id: "CHK-001",
        decision: "APPROVE",
        decision_by: "Dr. Sarah Chen",
      },
      performedBy: "Human Operator",
      timestamp: "2026-09-26T14:31:00Z",
    };
    expect(determineLifecyclePhase(approvalEvent)).toBe("APPROVAL");

    const executionEvent: AuditEvent = {
      id: "aud-4",
      incidentId: "INC-MCI-001",
      eventType: "CONSEQUENTIAL_ACTION_EXECUTED",
      actionName: "preempt_operating_room",
      tier: "RED",
      details: {
        affected_resource: "OR-3",
        execution: { status: "SUCCESS" },
      },
      performedBy: "TrueForge Consequential Executor",
      timestamp: "2026-09-26T14:31:30Z",
    };
    expect(determineLifecyclePhase(executionEvent)).toBe("EXECUTION");

    const verificationEvent: AuditEvent = {
      id: "aud-5",
      incidentId: "INC-MCI-001",
      eventType: "STATE_VERIFICATION_COMPLETED",
      actionName: "verify_operational_status",
      tier: "RED",
      details: {
        verified: true,
        target_entity: "operating_room",
        entity_id: "OR-3",
        actual_value: "RESERVED_FOR_TRAUMA",
      },
      performedBy: "State Verification Subsystem",
      timestamp: "2026-09-26T14:32:00Z",
    };
    expect(determineLifecyclePhase(verificationEvent)).toBe("VERIFICATION");
  });

  it("strictly requires verification flag before classifying event status as VERIFIED", () => {
    // Normal execution success is NOT verified
    const executedEvent: AuditEvent = {
      id: "aud-ex",
      incidentId: undefined,
      eventType: "ACTION_EXECUTED",
      actionName: "preempt_or",
      tier: "RED",
      details: { status: "SUCCESS" },
      performedBy: "Executor",
      timestamp: "2026-09-26T14:31:00Z",
    };
    expect(determineEventStatus(executedEvent).status).toBe("SUCCESS");

    // Only with explicit verified evidence does it become VERIFIED
    const verifiedEvent: AuditEvent = {
      id: "aud-ver",
      incidentId: undefined,
      eventType: "STATE_VERIFIED",
      actionName: "verify_operational_status",
      tier: "RED",
      details: { verified: true, status: "VERIFIED" },
      performedBy: "Verifier",
      timestamp: "2026-09-26T14:32:00Z",
    };
    expect(determineEventStatus(verifiedEvent).status).toBe("VERIFIED");

    // Discrepancy or error flags yield ERROR
    const errorEvent: AuditEvent = {
      id: "aud-err",
      incidentId: undefined,
      eventType: "VERIFICATION_FAILED",
      actionName: "verify_operational_status",
      tier: "RED",
      details: { error: "Database returned UNCHANGED state" },
      performedBy: "Verifier",
      timestamp: "2026-09-26T14:32:05Z",
    };
    const errStatus = determineEventStatus(errorEvent);
    expect(errStatus.status).toBe("ERROR");
    expect(errStatus.errorMessage).toBe("Database returned UNCHANGED state");
  });

  it("renders AuditActivityPanel with lifecycle sequence badges and granular details", () => {
    const events: AuditEvent[] = [
      {
        id: "ev-step-1",
        incidentId: "INC-MCI-001",
        eventType: "RUNBOOK_STEP_COMPLETED",
        actionName: "assess_capacity",
        tier: "GREEN",
        details: { step_number: 1, runbook_id: "MCI-01" },
        performedBy: "TrueForge Agent",
        timestamp: "2026-09-26T14:30:00Z",
      },
      {
        id: "ev-appr-1",
        incidentId: "INC-MCI-001",
        eventType: "CHECKPOINT_APPROVED",
        actionName: undefined,
        tier: "RED",
        details: {
          decision: "APPROVE",
          decision_by: "Dr. Sarah Chen",
          reason: "Mass casualty trauma incoming",
        },
        performedBy: "Dr. Sarah Chen",
        timestamp: "2026-09-26T14:31:00Z",
      },
      {
        id: "ev-ver-1",
        incidentId: "INC-MCI-001",
        eventType: "STATE_VERIFIED",
        actionName: "verify_operational_status",
        tier: "RED",
        details: {
          verified: true,
          actual_value: "RESERVED_FOR_TRAUMA",
          affected_resource: "OR-3",
        },
        performedBy: "System Verifier",
        timestamp: "2026-09-26T14:32:00Z",
      },
    ];

    render(<AuditActivityPanel state={available(events)} />);

    // Lifecycle sequence guide is visible in header
    expect(
      screen.getByText(/RUNBOOK STEP → ACTION → APPROVAL → EXECUTION → VERIFICATION → AUDIT/i),
    ).toBeInTheDocument();

    // Verify lifecycle phase pills
    expect(screen.getByTestId("audit-phase-ev-step-1")).toHaveTextContent("RUNBOOK STEP");
    expect(screen.getByTestId("audit-phase-ev-appr-1")).toHaveTextContent("APPROVAL");
    expect(screen.getByTestId("audit-phase-ev-ver-1")).toHaveTextContent("VERIFICATION");

    // Verify status badges
    expect(screen.getByTestId("audit-status-ev-step-1")).toHaveTextContent("SUCCESS");
    expect(screen.getByTestId("audit-status-ev-ver-1")).toHaveTextContent("VERIFIED");

    // Verify decision and verified evidence
    expect(screen.getByText(/Decision: APPROVE by Dr. Sarah Chen/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Evidence:/i)).toBeInTheDocument();
    expect(screen.getByText(/disk: RESERVED_FOR_TRAUMA/i)).toBeInTheDocument();
  });
});
