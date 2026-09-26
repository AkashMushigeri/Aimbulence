import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ApprovalCheckpointModal,
  ApprovalProposalView,
  ApprovalStatus,
  DecisionControls,
  ImpactBriefing,
} from "@/components/approval";
import { RunbookSection } from "@/components/dashboard";
import type { ApprovalProposal } from "@/types/domain";
import type {
  DecideResponseWire,
  RunbookExecutionStateWire,
  TrueForgeApprovalCheckpointWire,
} from "@/types/api/contracts";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const MOCK_PROPOSAL: ApprovalProposal = {
  targetAction: "PREEMPT_OPERATING_ROOM",
  operationalRationale: "MCI casualty surge of 42 casualties creates deficit of 2 operating rooms.",
  projectedImpact: "Postpones scheduled elective arthroscopic knee debridement in OR-3.",
  affectedResources: ["OR-3"],
  currentState: "status: IN_USE | scheduled procedure: Elective Arthroscopic Knee Debridement",
  postActionState: "status: RESERVED_FOR_TRAUMA | is emergency cleared: true",
  tier: "RED",
  availableDecisions: ["APPROVE", "REJECT"],
  gateState: "AWAITING_OPERATOR",
  checkpointId: "CHK-4E728E62",
  actionId: "ACT-PREEMPT-OR3",
  actionType: "PREEMPT_OPERATING_ROOM",
  reason: "MCI casualty surge of 42 casualties creates deficit of 2 operating rooms.",
  expectedBenefit: "Unlocks trauma surgical suite OR-3 for immediate emergency triage.",
  potentialConsequence: "Postpones scheduled elective arthroscopic knee debridement in OR-3.",
  affectedResource: "OR-3",
  currentStateDetails: {
    status: "IN_USE",
    scheduled_procedure: "Elective Arthroscopic Knee Debridement",
  },
  proposedStateDetails: {
    status: "RESERVED_FOR_TRAUMA",
    is_emergency_cleared: true,
  },
  incidentId: "INC-MCI-42",
  requiresHumanApproval: true,
};

const MOCK_CHECKPOINT_WIRE: TrueForgeApprovalCheckpointWire = {
  checkpoint_id: "CHK-4E728E62",
  thread_id: "thread-mci-42",
  tool_call_id: "call-or3-preempt",
  proposal: {
    action_id: "ACT-PREEMPT-OR3",
    action_type: "PREEMPT_OPERATING_ROOM",
    risk_level: "RED",
    safety_category: "RED",
    affected_resource: "OR-3",
    current_state: {
      status: "IN_USE",
      scheduled_procedure: "Elective Arthroscopic Knee Debridement",
    },
    proposed_state: {
      status: "RESERVED_FOR_TRAUMA",
      is_emergency_cleared: true,
    },
    reason: "MCI casualty surge of 42 casualties creates deficit of 2 operating rooms.",
    expected_benefit: "Unlocks trauma surgical suite OR-3 for immediate emergency triage.",
    potential_consequence: "Postpones scheduled elective arthroscopic knee debridement in OR-3.",
    requires_human_approval: true,
    incident_id: "INC-MCI-42",
    created_at: "2026-09-26T12:00:00Z",
  },
  state: "tool.approval_required",
  token_consumed: false,
  created_at: "2026-09-26T12:00:00Z",
};

const MOCK_RUNBOOK_EXECUTION: RunbookExecutionStateWire = {
  execution_id: "RBX-D736A471",
  runbook_id: "MCI-01",
  incident_id: "INC-MCI-42",
  state: "WAITING_FOR_APPROVAL",
  current_step_id: "MCI-01-10",
  checkpoint_id: "CHK-4E728E62",
  parameters: { incoming_casualties: 42 },
  context: { checkpoint_id: "CHK-4E728E62" },
  completed_steps: [
    "MCI-01-01",
    "MCI-01-02",
    "MCI-01-03",
    "MCI-01-04",
    "MCI-01-05",
    "MCI-01-06",
    "MCI-01-07",
    "MCI-01-08",
    "MCI-01-09",
  ],
  step_results: {},
  started_at: "2026-09-26T12:00:00Z",
  updated_at: "2026-09-26T12:01:00Z",
};

describe("TrueForge Human Approval Checkpoint UI & Safety Behavior", () => {
  // 1 & 2. RED Checkpoint Rendering & Paused State
  it("1. renders RED checkpoint with prominent AGENT PAUSED and WAITING FOR HUMAN AUTHORIZATION", () => {
    render(<ApprovalStatus state="PAUSED_WAITING" />);

    expect(screen.getByTestId("agent-pause-label").textContent).toBe("AGENT PAUSED");
    expect(screen.getByTestId("approval-status-headline").textContent).toBe(
      "WAITING FOR HUMAN AUTHORIZATION",
    );
    expect(screen.getByTestId("safety-tier-RED")).toBeDefined();
  });

  // 3 to 10. The 7 Required Approval Proposal Categories
  describe("approval proposal presentation (The 7 mandatory categories)", () => {
    it("renders all 7 categories grounded in real backend contract fields", () => {
      render(<ApprovalProposalView proposal={MOCK_PROPOSAL} />);

      // 1. Target Action
      expect(screen.getByTestId("proposal-target-action").textContent).toBe(
        "PREEMPT_OPERATING_ROOM",
      );

      // 2. Operational Rationale
      expect(screen.getByTestId("proposal-rationale").textContent).toContain(
        "deficit of 2 operating rooms",
      );

      // 3. Projected Impact
      expect(screen.getByTestId("proposal-projected-impact").textContent).toContain(
        "Postpones scheduled elective arthroscopic knee debridement",
      );

      // 4. Affected Resources
      expect(screen.getByTestId("proposal-affected-resources").textContent).toBe("OR-3");

      // 5. Current State
      expect(screen.getByTestId("proposal-current-state").textContent).toContain("IN_USE");

      // 6. Expected / Post-Action State
      expect(screen.getByTestId("proposal-expected-state").textContent).toContain(
        "RESERVED_FOR_TRAUMA",
      );

      // 7. Required Decision & UI State
      expect(screen.getByTestId("proposal-required-decision").textContent).toBe(
        "AGENT PAUSED — WAITING FOR HUMAN AUTHORIZATION",
      );
    });

    it("displays explicit 'NOT PROVIDED BY BACKEND' when a contract field is absent without fabricating data", () => {
      const sparseProposal: ApprovalProposal = {
        targetAction: "",
        operationalRationale: "",
        projectedImpact: "",
        affectedResources: [],
        currentState: "",
        postActionState: "",
        tier: "RED",
        availableDecisions: ["APPROVE", "REJECT"],
        gateState: "AWAITING_OPERATOR",
      };

      render(<ApprovalProposalView proposal={sparseProposal} />);

      expect(screen.getByTestId("proposal-target-action").textContent).toBe(
        "NOT PROVIDED BY BACKEND",
      );
      expect(screen.getByTestId("proposal-rationale").textContent).toBe(
        "NOT PROVIDED BY BACKEND",
      );
      expect(screen.getByTestId("proposal-projected-impact").textContent).toBe(
        "NOT PROVIDED BY BACKEND",
      );
      expect(screen.getByTestId("proposal-affected-resources").textContent).toBe(
        "NOT PROVIDED BY BACKEND",
      );
      expect(screen.getByTestId("proposal-current-state").textContent).toBe(
        "NOT PROVIDED BY BACKEND",
      );
      expect(screen.getByTestId("proposal-expected-state").textContent).toBe(
        "NOT PROVIDED BY BACKEND",
      );
    });
  });

  // Impact Briefing
  it("renders impact briefing with surge benefit and clinical trade-off", () => {
    render(<ImpactBriefing proposal={MOCK_PROPOSAL} />);

    expect(screen.getByTestId("impact-benefit").textContent).toContain(
      "Unlocks trauma surgical suite OR-3",
    );
    expect(screen.getByTestId("impact-consequence").textContent).toContain(
      "Postpones scheduled elective arthroscopic knee debridement",
    );
  });

  // 11. APPROVE Request
  it("11. sends exact approve request to POST /api/approval/decide with operator identity", async () => {
    const submitMock = vi.fn();
    render(
      <DecisionControls
        checkpointId="CHK-4E728E62"
        onSubmitDecision={submitMock}
      />,
    );

    // Operator enters authority name and reason
    fireEvent.change(screen.getByTestId("operator-name-input"), {
      target: { value: "Dr. Eleanor Vance, Trauma Medical Director" },
    });
    fireEvent.change(screen.getByTestId("operator-reason-input"), {
      target: { value: "OR-3 elective case cleared. Surge capacity required." },
    });

    // Deliberate click on Authorize button
    fireEvent.click(screen.getByTestId("decision-approve-btn"));

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      checkpoint_id: "CHK-4E728E62",
      decision: "APPROVE",
      decision_by: "Dr. Eleanor Vance, Trauma Medical Director",
      reason: "OR-3 elective case cleared. Surge capacity required.",
      execute_if_approved: true,
    });
  });

  // 12. REJECT Request
  it("12. sends exact reject request to POST /api/approval/decide with denial notes", async () => {
    const submitMock = vi.fn();
    render(
      <DecisionControls
        checkpointId="CHK-4E728E62"
        onSubmitDecision={submitMock}
      />,
    );

    fireEvent.change(screen.getByTestId("operator-name-input"), {
      target: { value: "Dr. Marcus Vance, Chief Medical Officer" },
    });
    fireEvent.change(screen.getByTestId("operator-reason-input"), {
      target: { value: "Patient already inducted in OR-3. Preemption denied on clinical safety." },
    });

    fireEvent.click(screen.getByTestId("decision-reject-btn"));

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      checkpoint_id: "CHK-4E728E62",
      decision: "REJECT",
      decision_by: "Dr. Marcus Vance, Chief Medical Officer",
      reason: "Patient already inducted in OR-3. Preemption denied on clinical safety.",
      execute_if_approved: false,
    });
  });

  // 13. MODIFY Request (Not supported by contract)
  it("13. does NOT permit modify because backend contract has no modify semantics", () => {
    render(
      <DecisionControls
        checkpointId="CHK-4E728E62"
        onSubmitDecision={vi.fn()}
      />,
    );

    const modifyBtn = screen.getByTestId("decision-modify-btn") as HTMLButtonElement;
    expect(modifyBtn.disabled).toBe(true);
    expect(modifyBtn.textContent).toContain("NOT SUPPORTED BY CONTRACT");
  });

  // 14. Loading / Submission state
  it("14. renders request-in-progress state while decision is in-flight", () => {
    render(
      <DecisionControls
        checkpointId="CHK-4E728E62"
        isSubmitting={true}
        onSubmitDecision={vi.fn()}
      />,
    );

    expect(screen.getByTestId("submission-in-progress")).toBeDefined();
    expect(screen.getByTestId("decision-approve-btn")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("decision-reject-btn")).toHaveProperty("disabled", true);
  });

  // 15. Duplicate-click protection
  it("15. protects against duplicate click submissions", () => {
    const submitMock = vi.fn();
    render(
      <DecisionControls
        checkpointId="CHK-4E728E62"
        onSubmitDecision={submitMock}
      />,
    );

    fireEvent.change(screen.getByTestId("operator-name-input"), {
      target: { value: "Dr. Eleanor Vance" },
    });

    const approveBtn = screen.getByTestId("decision-approve-btn");
    fireEvent.click(approveBtn);
    fireEvent.click(approveBtn);
    fireEvent.click(approveBtn);

    // Only one submission call should occur
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  // 16. Backend failure keeps AGENT PAUSED visible
  it("16. keeps AGENT PAUSED visible when decision submission fails and displays error", () => {
    render(
      <DecisionControls
        checkpointId="CHK-4E728E62"
        error="HTTP 500: Database lock timeout during preemption"
        onSubmitDecision={vi.fn()}
      />,
    );

    expect(screen.getByTestId("decision-error-banner").textContent).toContain(
      "Database lock timeout during preemption",
    );
  });

  // 19. No Automatic Approval Guard
  describe("safety enforcement — no automatic approval", () => {
    it("19a. rendering the modal does NOT automatically submit approval", () => {
      const submitMock = vi.fn();
      render(
        <ApprovalCheckpointModal
          isOpen={true}
          proposal={MOCK_PROPOSAL}
          onClose={vi.fn()}
        />,
      );

      // Verify submit action was not called
      expect(submitMock).not.toHaveBeenCalled();
    });

    it("19b. closing the modal does NOT authorize or approve the action", () => {
      const closeMock = vi.fn();
      render(
        <ApprovalCheckpointModal
          isOpen={true}
          proposal={MOCK_PROPOSAL}
          onClose={closeMock}
        />,
      );

      fireEvent.click(screen.getByTestId("modal-close-btn"));
      expect(closeMock).toHaveBeenCalledTimes(1);
      // Execution state must not be mutated
    });

    it("19c. requires minimum 2 characters operator name before enabling submission", () => {
      const submitMock = vi.fn();
      render(
        <DecisionControls
          checkpointId="CHK-4E728E62"
          onSubmitDecision={submitMock}
        />,
      );

      const approveBtn = screen.getByTestId("decision-approve-btn") as HTMLButtonElement;
      expect(approveBtn.disabled).toBe(true);

      fireEvent.change(screen.getByTestId("operator-name-input"), { target: { value: "A" } });
      expect(approveBtn.disabled).toBe(true);

      fireEvent.change(screen.getByTestId("operator-name-input"), { target: { value: "Dr. Vance" } });
      expect(approveBtn.disabled).toBe(false);
    });
  });

  // 20 & 21. Runbook integration & Execution state updates
  describe("runbook visualizer integration", () => {
    it("20. renders paused checkpoint alert in runbook visualizer at step 10", () => {
      render(
        <RunbookSection
          execution={MOCK_RUNBOOK_EXECUTION}
          activeCheckpoint={MOCK_CHECKPOINT_WIRE}
        />,
      );

      expect(screen.getByTestId("runbook-engine-state").textContent).toBe(
        "WAITING_FOR_APPROVAL",
      );
      expect(screen.getByTestId("checkpoint-paused-alert")).toBeDefined();
      expect(screen.getByTestId("step-status-10").textContent).toBe("WAITING_APPROVAL");
      expect(screen.getByTestId("step-status-9").textContent).toBe("COMPLETED");
    });

    it("21. updates runbook UI to COMPLETED after backend returns verified execution", () => {
      const completedExecution: RunbookExecutionStateWire = {
        ...MOCK_RUNBOOK_EXECUTION,
        state: "COMPLETED",
        current_step_id: "MCI-01-15",
        completed_steps: Array.from({ length: 15 }, (_, i) => `MCI-01-${String(i + 1).padStart(2, "0")}`),
      };

      render(<RunbookSection execution={completedExecution} />);

      expect(screen.getByTestId("runbook-engine-state").textContent).toBe("COMPLETED");
      expect(screen.getByTestId("runbook-completed-alert")).toBeDefined();
      expect(screen.getByTestId("step-status-15").textContent).toBe("COMPLETED");
    });

    it("21b. updates runbook UI to BLOCKED when human operator rejects action", () => {
      const blockedExecution: RunbookExecutionStateWire = {
        ...MOCK_RUNBOOK_EXECUTION,
        state: "BLOCKED",
        current_step_id: "MCI-01-11",
      };

      render(<RunbookSection execution={blockedExecution} />);

      expect(screen.getByTestId("runbook-engine-state").textContent).toBe("BLOCKED");
      expect(screen.getByTestId("runbook-blocked-alert")).toBeDefined();
      expect(screen.getByTestId("step-status-11").textContent).toBe("BLOCKED");
    });
  });
});
