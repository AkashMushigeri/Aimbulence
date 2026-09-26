import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RunbookVisualizer } from "@/components/runbook/RunbookVisualizer";
import { ExecutionStatus } from "@/components/runbook/ExecutionStatus";
import { RunbookProgress } from "@/components/runbook/RunbookProgress";
import { RunbookStep } from "@/components/runbook/RunbookStep";
import { RunbookSection } from "@/components/dashboard/RunbookSection";
import { MCI_01_STEP_DEFINITIONS } from "@/types/domain/runbook";
import type { AgentExecutionState, RunbookStepDetail } from "@/types/domain";
import { createRunbookService } from "@/services/runbookService";
import type { ApiClient } from "@/services/apiClient";
import type { RunbookExecutionStateWire } from "@/types/api/contracts";

const MOCK_RUNNING_EXECUTION: AgentExecutionState = {
  executionId: "RUN-MCI-01-TEST",
  incidentId: "INC-MCI-42",
  runbookId: "MCI-01",
  status: "RUNNING",
  currentStep: 4,
  totalSteps: 15,
  activeCheckpoint: null,
  gateState: "NOT_BLOCKED",
  startedAt: "2026-09-26T12:00:00Z",
  completedSteps: ["MCI-01-01", "MCI-01-02", "MCI-01-03"],
};

const MOCK_PAUSED_EXECUTION: AgentExecutionState = {
  executionId: "RUN-MCI-01-CHECKPOINT",
  incidentId: "INC-MCI-42",
  runbookId: "MCI-01",
  status: "PAUSED",
  currentStep: 10,
  totalSteps: 15,
  activeCheckpoint: "CHK-OR3-PREEMPTION",
  gateState: "AWAITING_OPERATOR",
  startedAt: "2026-09-26T12:00:00Z",
  completedSteps: [
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
};

const MOCK_FAILED_EXECUTION: AgentExecutionState = {
  executionId: "RUN-MCI-01-FAIL",
  incidentId: "INC-MCI-42",
  runbookId: "MCI-01",
  status: "FAILED",
  currentStep: 7,
  totalSteps: 15,
  activeCheckpoint: null,
  gateState: "NOT_BLOCKED",
  startedAt: "2026-09-26T12:00:00Z",
  errorMessage: "Resource reservation conflict: ED-01 unavailable",
  stepResults: {
    "MCI-01-07": {
      status: "FAILED",
      error: "Resource reservation conflict: ED-01 unavailable",
    },
  },
};

const MOCK_COMPLETED_EXECUTION: AgentExecutionState = {
  executionId: "RUN-MCI-01-DONE",
  incidentId: "INC-MCI-42",
  runbookId: "MCI-01",
  status: "COMPLETED",
  currentStep: 15,
  totalSteps: 15,
  activeCheckpoint: null,
  gateState: "NOT_BLOCKED",
  startedAt: "2026-09-26T12:00:00Z",
  completedAt: "2026-09-26T12:05:00Z",
  completedSteps: MCI_01_STEP_DEFINITIONS.map((s) => s.stepId),
  stepResults: {
    "MCI-01-14": {
      status: "COMPLETED",
      verification: true,
    },
  },
};

describe("MCI-01 Runbook Visualizer & Execution Governance", () => {
  // 1. All 15 declarative steps rendered
  it("1. renders all 15 documented MCI-01 steps with identifiers, names, and action tools", () => {
    render(<RunbookVisualizer />);

    expect(screen.getByTestId("runbook-id").textContent).toContain("MCI-01");
    expect(screen.getByTestId("runbook-step-list")).toBeDefined();

    for (let stepNum = 1; stepNum <= 15; stepNum++) {
      const stepEl = screen.getByTestId(`runbook-step-${stepNum}`);
      expect(stepEl).toBeDefined();
      expect(screen.getByTestId(`step-number-${stepNum}`).textContent).toBe(String(stepNum));
    }

    // Step 1 check
    expect(screen.getByText("Receive Emergency Incident Alert")).toBeDefined();
    expect(screen.getByText("detect_incident")).toBeDefined();

    // Step 10 check (Checkpoint)
    expect(screen.getByText("Halt at Consequential Action Checkpoint [RED]")).toBeDefined();
    expect(screen.getByText("propose_and_pause_red_action")).toBeDefined();

    // Step 15 check
    expect(screen.getByText("Log Immutable Audit Record & Escalate if Necessary")).toBeDefined();
    expect(screen.getByText("generate_execution_summary")).toBeDefined();
  });

  // 2. Unexecuted / standby state
  it("2. shows unexecuted state with disabled trigger button and NO fabricated progress bar", () => {
    render(<RunbookSection />);

    expect(screen.getByTestId("runbook-status-badge").textContent).toBe(
      "NOT CONNECTED / WAITING FOR EXECUTION ENGINE",
    );
    expect(screen.getByTestId("runbook-engine-state").textContent).toBe(
      "NOT CONNECTED / WAITING FOR EXECUTION ENGINE",
    );

    // No progressbar in standby/unconnected mode (governance requirement)
    expect(screen.queryByRole("progressbar")).toBeNull();

    // Trigger button is disabled
    const triggerBtn = screen.getByTestId("runbook-execute-btn");
    expect(triggerBtn).toBeDefined();
    expect(triggerBtn.hasAttribute("disabled")).toBe(true);
    expect(triggerBtn.getAttribute("aria-disabled")).toBe("true");
  });

  // 3. Running execution state
  it("3. displays RUNNING execution state with active step and dynamic progress bar", () => {
    render(<RunbookVisualizer execution={MOCK_RUNNING_EXECUTION} />);

    expect(screen.getByTestId("runbook-status-badge").textContent).toContain("RUNNING");
    expect(screen.getByTestId("runbook-engine-state").textContent).toBe("RUNNING");

    // Progress bar rendered when running
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    // Step 4 of 15 => 27%
    expect(progressbar.getAttribute("aria-valuenow")).toBe("27");

    // Active step dot is highlighted
    const activeDot = screen.getByTestId("step-dot-4");
    expect(activeDot.className).toContain("animate-pulse");

    // Prior steps marked completed
    expect(screen.getByTestId("step-dot-1").className).toContain("bg-emerald-500");
  });

  // 4. CRITICAL SAFETY REQUIREMENT: Paused state at Step 10
  it("4. prominently displays AGENT PAUSED and HUMAN AUTHORIZATION REQUIRED when paused at Step 10", () => {
    render(<RunbookVisualizer execution={MOCK_PAUSED_EXECUTION} />);

    // Header badge
    const statusBadge = screen.getByTestId("runbook-status-badge");
    expect(statusBadge.textContent).toContain("AGENT PAUSED · HUMAN AUTHORIZATION REQUIRED");

    // In-step prominent banner
    expect(screen.getByTestId("agent-paused-banner")).toBeDefined();
    expect(screen.getByTestId("human-authorization-required")).toBeDefined();
    expect(screen.getByTestId("human-authorization-required").textContent).toContain(
      "AGENT PAUSED · HUMAN AUTHORIZATION REQUIRED",
    );

    // Active step is Step 10
    const step10 = screen.getByTestId("runbook-step-10");
    expect(step10.getAttribute("data-step-status")).toBe("PAUSED");
  });

  // 5. Safety Governance: No decision buttons in visualizer
  it("5. enforces safety boundary with zero approval decision controls in the visualizer", () => {
    render(<RunbookVisualizer execution={MOCK_PAUSED_EXECUTION} />);

    // Must NOT have approve / reject buttons
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reject/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /modify/i })).toBeNull();

    // Safety governance notice is rendered
    expect(screen.getByTestId("safety-governance-notice")).toBeDefined();
  });

  // 6. Safety categories are assigned accurately across all steps
  it("6. correctly categorizes steps into GREEN, YELLOW, and RED tiers", () => {
    render(<RunbookVisualizer />);

    // Step 7 is YELLOW (resource staging)
    const step7 = screen.getByTestId("runbook-step-7");
    expect(step7.querySelector("[data-testid='safety-tier-YELLOW']")).not.toBeNull();

    // Step 10-13 are RED (consequential actions)
    for (let step = 10; step <= 13; step++) {
      const stepEl = screen.getByTestId(`runbook-step-${step}`);
      expect(stepEl.querySelector("[data-testid='safety-tier-RED']")).not.toBeNull();
    }

    // Step 1 is GREEN
    const step1 = screen.getByTestId("runbook-step-1");
    expect(step1.querySelector("[data-testid='safety-tier-GREEN']")).not.toBeNull();
  });

  // 7. Failed execution state
  it("7. renders FAILED state with error message and highlighted failure step", () => {
    render(<RunbookVisualizer execution={MOCK_FAILED_EXECUTION} />);

    expect(screen.getByTestId("runbook-status-badge").textContent).toContain("FAILED");

    // Failure step shows error details
    const step7 = screen.getByTestId("runbook-step-7");
    expect(step7.getAttribute("data-step-status")).toBe("FAILED");
    expect(screen.getByTestId("step-error-7").textContent).toContain(
      "Resource reservation conflict: ED-01 unavailable",
    );
  });

  // 8. Completed execution state
  it("8. renders COMPLETED state with 100% progress and all steps marked completed", () => {
    render(<RunbookVisualizer execution={MOCK_COMPLETED_EXECUTION} />);

    expect(screen.getByTestId("runbook-status-badge").textContent).toContain("COMPLETED");

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("100");

    // Verification badge displayed for verified step
    expect(screen.getByTestId("step-14-verified")).toBeDefined();
    expect(screen.getByTestId("step-14-verified").textContent).toContain("VERIFIED");
  });

  // 9. Individual ExecutionStatus component
  it("9. renders all execution lifecycle states properly via ExecutionStatus", () => {
    const { rerender } = render(<ExecutionStatus status="PENDING" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain("PENDING");

    rerender(<ExecutionStatus status="RUNNING" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain("RUNNING");

    rerender(<ExecutionStatus status="PAUSED" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain(
      "AGENT PAUSED · HUMAN AUTHORIZATION REQUIRED",
    );

    rerender(<ExecutionStatus status="FAILED" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain("FAILED");

    rerender(<ExecutionStatus status="REJECTED" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain("OPERATOR REJECTED");

    rerender(<ExecutionStatus status="VERIFIED" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain("STATE VERIFIED");

    rerender(<ExecutionStatus status="ESCALATED" />);
    expect(screen.getByTestId("execution-status-badge").textContent).toContain("ESCALATED");
  });

  // 10. Individual RunbookStep component
  it("10. renders single RunbookStep with tool name and verification badge", () => {
    const sampleStep: RunbookStepDetail = {
      stepId: "MCI-01-14",
      stepNumber: 14,
      name: "Verify Operational State on Real Connected System",
      description: "Direct database check on OR-3 preemption.",
      safetyCategory: "GREEN",
      status: "COMPLETED",
      actionTool: "verify_consequential_state",
      isApprovalCheckpoint: false,
      verification: true,
    };

    render(<RunbookStep step={sampleStep} isCurrent={false} isPaused={false} />);

    expect(screen.getByTestId("step-title-14").textContent).toBe(
      "Verify Operational State on Real Connected System",
    );
    expect(screen.getByText("verify_consequential_state")).toBeDefined();
    expect(screen.getByTestId("step-14-verified")).toBeDefined();
    expect(screen.queryByTestId("agent-paused-banner")).toBeNull();
  });

  // 11. RunbookProgress step counter and indicators
  it("11. displays step count and percentage in RunbookProgress", () => {
    render(<RunbookProgress currentStep={6} totalSteps={15} status="RUNNING" />);

    expect(screen.getByText(/Step/i).textContent).toContain("6");
    expect(screen.getByText(/Step/i).textContent).toContain("15");
    expect(screen.getByTestId("step-dot-6").textContent).toBe("6");
    expect(screen.getByText("40%")).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
  });


  // 12. RunbookService unit test
  it("12. queries GET /api/runbooks/{execution_id} via RunbookService and handles errors gracefully", async () => {
    const mockWireState: RunbookExecutionStateWire = {
      execution_id: "RUN-MCI-TEST",
      incident_id: "INC-MCI-42",
      runbook_id: "MCI-01",
      state: "RUNNING",
      current_step_id: "MCI-01-05",
      checkpoint_id: null,
      completed_steps: ["MCI-01-01", "MCI-01-02", "MCI-01-03", "MCI-01-04"],
      started_at: "2026-09-26T12:00:00Z",
    };

    const mockRequest = vi.fn().mockResolvedValue(mockWireState);
    const mockClient: ApiClient = {
      request: mockRequest,
      describe: () => ({ configured: true, backendBaseUrl: "http://127.0.0.1:8000", timeoutMs: 5000 }),
    };


    const service = createRunbookService(mockClient);
    const result = await service.getExecutionStatus("RUN-MCI-TEST");

    expect(result).not.toBeNull();
    expect(result?.executionId).toBe("RUN-MCI-TEST");
    expect(result?.status).toBe("RUNNING");
    expect(result?.currentStep).toBe(5);
    expect(mockRequest).toHaveBeenCalledWith("/api/runbooks/RUN-MCI-TEST", { signal: undefined });

    // Handles network error gracefully (returns null)
    mockRequest.mockRejectedValue(new Error("Network Error"));
    const failedResult = await service.getExecutionStatus("RUN-MCI-TEST");
    expect(failedResult).toBeNull();
  });
});
