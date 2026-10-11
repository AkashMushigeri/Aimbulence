"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackendHealth } from "@/services/operations";
import type { AuditEvent, HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";
import type { PreArrivalCase, PreArrivalResourcesOverview } from "@/types/domain/prearrival";
import type { SectionKey } from "@/lib/serverLoad";
import type { SectionStates } from "@/lib/loadState";
import type { ConnectionState } from "@/components/common";
import {
  startMciRunbookAction,
  resumeRunbookAction,
  fetchCheckpointsAction,
  seedPreArrivalDemoAction,
} from "@/app/actions";

import { SystemStatus } from "./SystemStatus";
import { ConnectionStateAlert } from "./ConnectionStateAlert";
import { IncidentOverview } from "./IncidentOverview";
import { CapacityOverview } from "./CapacityOverview";
import { ResourceOverview } from "./ResourceOverview";
import { DeficitPanel } from "./DeficitPanel";
import { RunbookSection } from "./RunbookSection";
import { AuditActivityPanel } from "./AuditActivityPanel";

import { HospitalCommandCenter } from "@/components/hospital/HospitalCommandCenter";
import { AmbulanceIntake } from "@/components/ambulance/AmbulanceIntake";

import type {
  DecideResponseWire,
  RunbookExecutionStateWire,
  StartRunbookResponseWire,
  TrueForgeApprovalCheckpointWire,
} from "@/types/api/contracts";

export interface OperationsDashboardProps {
  readonly configured: boolean;
  readonly sections: SectionStates;
  readonly health?: BackendHealth;
  readonly hospital?: HospitalCapacity;
  readonly resources?: ResourceStatus;
  readonly incidents?: readonly Incident[];
  readonly audit?: readonly AuditEvent[];
  readonly execution?: RunbookExecutionStateWire | null;
  readonly activeCheckpoint?: TrueForgeApprovalCheckpointWire | null;
  readonly prearrivalCases?: readonly PreArrivalCase[];
  readonly prearrivalResources?: PreArrivalResourcesOverview | null;
  readonly defaultTab?: "HOSPITAL_COMMAND" | "AMBULANCE_DISPATCH" | "MCI_RUNBOOK";
  readonly appName?: string;
  readonly appTagline?: string;
  readonly lastRefreshed?: string;
}

export function OperationsDashboard({
  configured,
  sections,
  health,
  hospital,
  resources,
  incidents,
  audit,
  execution: initialExecution,
  activeCheckpoint: initialCheckpoint,
  prearrivalCases,
  prearrivalResources,
  defaultTab = "HOSPITAL_COMMAND",
  appName = "AIMBULENCE",
  appTagline = "AI Emergency Hospital Operations Runbook Executor",
  lastRefreshed,
}: OperationsDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"HOSPITAL_COMMAND" | "AMBULANCE_DISPATCH" | "MCI_RUNBOOK">(defaultTab);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [execution, setExecution] = useState<RunbookExecutionStateWire | null>(initialExecution ?? null);
  const [activeCheckpoint, setActiveCheckpoint] = useState<TrueForgeApprovalCheckpointWire | null>(initialCheckpoint ?? null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [operationFeedback, setOperationFeedback] = useState<string | null>(null);

  // Synchronize when server props update (e.g. after router.refresh() or initial load)
  useEffect(() => {
    if (initialExecution !== undefined) {
      setExecution(initialExecution);
    }
  }, [initialExecution]);

  useEffect(() => {
    if (initialCheckpoint !== undefined) {
      setActiveCheckpoint(initialCheckpoint);
    }
  }, [initialCheckpoint]);

  const section = (key: SectionKey) => sections[key]?.state ?? { status: "loading" as const };

  const failureCount = Object.values(sections).filter(
    (entry) => entry.state.status === "failed",
  ).length;
  const availableCount = Object.values(sections).filter(
    (entry) => entry.state.status === "available",
  ).length;
  const totalSections = availableCount + failureCount;
  const partialFailure = failureCount > 0 && availableCount > 0;
  const allFailed = configured && totalSections > 0 && availableCount === 0;

  // Connection state strictly derived from backend health response
  const healthState = section("health");
  const isHealthAvailable = healthState.status === "available";

  const connectionState: ConnectionState = !configured
    ? "DISCONNECTED"
    : allFailed || !isHealthAvailable
    ? "DISCONNECTED"
    : partialFailure
    ? "DEGRADED"
    : "CONNECTED";

  /**
   * Quick action to seed the flagship 28yo male RTA scenario and switch to hospital command.
   */
  const handleQuickSeedDemo = async () => {
    setIsSeedingDemo(true);
    try {
      const res = await seedPreArrivalDemoAction();
      if (res.ok) {
        setOperationFeedback(res.message || "Flagship 28yo RTA scenario seeded.");
        setActiveTab("HOSPITAL_COMMAND");
        router.refresh();
      } else {
        setOperationFeedback(res.message || "Failed to seed demo scenario.");
      }
    } catch (err) {
      setOperationFeedback(err instanceof Error ? err.message : "Error seeding demo.");
    } finally {
      setIsSeedingDemo(false);
    }
  };

  /**
   * Controlled operator initiation of the 15-step MCI-01 runbook.
   */
  const handleInitiateRunbook = async () => {
    setIsInitiating(true);
    setOperationFeedback(null);
    try {
      const res = await startMciRunbookAction();
      if (!res.ok || !res.execution) {
        setOperationFeedback(res.message || "Failed to initiate MCI-01 runbook.");
        return;
      }

      const execWire = res.execution as StartRunbookResponseWire | RunbookExecutionStateWire;

      setExecution(res.execution as RunbookExecutionStateWire);

      // Fetch active checkpoint via server action
      const chkId = execWire.checkpoint_id;
      if (chkId) {
        try {
          const chkResult = await fetchCheckpointsAction();
          if (chkResult.ok && chkResult.checkpoints.length > 0) {
            const match = chkResult.checkpoints.find((c) => c.checkpoint_id === chkId);
            setActiveCheckpoint(match ?? chkResult.checkpoints[0] ?? null);
          }
        } catch {
          // Fallback proposal available in RunbookSection
        }
      }

      setOperationFeedback("MCI-01 runbook initiated. Agent executed through Step 9 and paused at Step 10 checkpoint.");
      router.refresh();
    } catch (err) {
      setOperationFeedback(err instanceof Error ? err.message : "Runbook initiation failed.");
    } finally {
      setIsInitiating(false);
    }
  };

  /**
   * Resumes a paused runbook execution after human authorization decision.
   */
  const handleResumeRunbook = async () => {
    if (!execution) return;
    setIsResuming(true);
    setOperationFeedback(null);
    try {
      const res = await resumeRunbookAction(execution.execution_id);
      if (res.ok && res.execution) {
        setExecution(res.execution as RunbookExecutionStateWire);
        setActiveCheckpoint(null);
        setOperationFeedback("Runbook resumed and completed successfully.");
        router.refresh();
      } else {
        setOperationFeedback(res.message || "Failed to resume runbook.");
      }
    } catch (err) {
      setOperationFeedback(err instanceof Error ? err.message : "Runbook resume failed.");
    } finally {
      setIsResuming(false);
    }
  };

  /**
   * Called when a human decision (APPROVE or REJECT) is successfully processed by the modal.
   * Automatically invokes resume so the engine advances to Step 15 or marks BLOCKED.
   */
  const handleDecisionSuccess = async (result: DecideResponseWire) => {
    if (!execution) return;
    try {
      const decisionNote =
        result.checkpoint.state === "REJECTED"
          ? "Preemption denied by human operator"
          : "Preemption authorized by human operator";

      const res = await resumeRunbookAction(execution.execution_id, decisionNote);
      if (res.ok && res.execution) {
        setExecution(res.execution as RunbookExecutionStateWire);
        setActiveCheckpoint(null);
        setOperationFeedback(
          result.checkpoint.state === "REJECTED"
            ? "Runbook safely blocked. Consequential preemption was prevented."
            : "Runbook resumed. Consequential mutation executed and verified on disk.",
        );
      }
      router.refresh();
    } catch {
      router.refresh();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* 1. TOP SYSTEM STATUS BAR */}
      <SystemStatus
        appName={appName}
        appTagline={appTagline}
        connectionState={connectionState}
        health={health}
        lastRefreshed={lastRefreshed}
      />

      {/* 8. CONNECTION / ERROR STATE ALERT */}
      <ConnectionStateAlert
        configured={configured}
        partialFailure={partialFailure}
        allFailed={allFailed}
        availableCount={availableCount}
        totalSections={totalSections}
        sections={sections}
      />

      {/* MODE NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-900/90 p-2 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="System Mode">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "HOSPITAL_COMMAND"}
            data-testid="tab-hospital-command"
            onClick={() => setActiveTab("HOSPITAL_COMMAND")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === "HOSPITAL_COMMAND"
                ? "bg-rose-950/80 text-rose-200 border border-rose-500/40 shadow-sm shadow-rose-950/50"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
            }`}
          >
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            🏥 Pre-Arrival Command Center
            {prearrivalCases && prearrivalCases.length > 0 && (
              <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono text-rose-300">
                {prearrivalCases.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "AMBULANCE_DISPATCH"}
            data-testid="tab-ambulance-dispatch"
            onClick={() => setActiveTab("AMBULANCE_DISPATCH")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === "AMBULANCE_DISPATCH"
                ? "bg-amber-950/80 text-amber-200 border border-amber-500/40 shadow-sm shadow-amber-950/50"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
            }`}
          >
            🚑 Ambulance Cockpit
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "MCI_RUNBOOK"}
            data-testid="tab-mci-runbook"
            onClick={() => setActiveTab("MCI_RUNBOOK")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === "MCI_RUNBOOK"
                ? "bg-sky-950/80 text-sky-200 border border-sky-500/40 shadow-sm shadow-sky-950/50"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
            }`}
          >
            📋 MCI Surge Runbook (MCI-01)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="seed-demo-scenario-btn"
            disabled={isSeedingDemo}
            onClick={handleQuickSeedDemo}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/60 active:scale-95 transition-all disabled:opacity-50"
          >
            <span>⚡</span>
            <span>{isSeedingDemo ? "Seeding Scenario..." : "Seed 28yo RTA Scenario"}</span>
          </button>
        </div>
      </div>

      {operationFeedback ? (
        <div
          data-testid="operation-feedback-banner"
          role="status"
          className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-2 text-xs font-mono text-sky-200"
        >
          {operationFeedback}
        </div>
      ) : null}

      {/* VIEW 1: PRE-ARRIVAL HOSPITAL COMMAND CENTER */}
      <div
        className={activeTab === "HOSPITAL_COMMAND" ? "block" : "hidden"}
        data-testid="prearrival-command-view"
      >
        <HospitalCommandCenter
          initialCases={prearrivalCases ? [...prearrivalCases] : []}
          initialResources={prearrivalResources ?? null}
          initialAuditEvents={audit ? [...audit] : []}
          onSwitchToAmbulanceView={() => setActiveTab("AMBULANCE_DISPATCH")}
        />
      </div>

      {/* VIEW 2: AMBULANCE COCKPIT (EN-ROUTE INTAKE) */}
      <div
        className={activeTab === "AMBULANCE_DISPATCH" ? "block" : "hidden"}
        data-testid="ambulance-intake-view"
      >
        <AmbulanceIntake
          activeCase={prearrivalCases && prearrivalCases.length > 0 ? prearrivalCases[0] : null}
          onCaseCreated={() => {
            setActiveTab("HOSPITAL_COMMAND");
            router.refresh();
          }}
        />
      </div>

      {/* VIEW 3: MCI SURGE RUNBOOK (MCI-01) */}
      <div
        className={activeTab === "MCI_RUNBOOK" ? "grid gap-5 lg:grid-cols-12" : "hidden"}
        data-testid="mci-runbook-container"
      >
        {/* Left Column (Incident, Deficits, Runbook Visualizer) - 7 cols on lg */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* 2. INCIDENT OVERVIEW */}
          <IncidentOverview state={section("incidents")} />

          {/* 5. OPERATIONAL DEFICITS / BOTTLENECKS */}
          <DeficitPanel
            hospitalState={section("hospital")}
            resourcesState={section("resources")}
            incidentsState={section("incidents")}
          />

          {/* 6. RUNBOOK STATUS / VISUALIZER */}
          <RunbookSection
            execution={execution}
            activeCheckpoint={activeCheckpoint}
            onInitiateRunbook={handleInitiateRunbook}
            onResumeRunbook={handleResumeRunbook}
            onDecisionSuccess={handleDecisionSuccess}
          />
        </div>

        {/* Right Column (Hospital Capacity, Resource Status, Audit Trail) - 5 cols on lg */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* 3. HOSPITAL CAPACITY */}
          <CapacityOverview state={section("hospital")} />

          {/* 4. RESOURCE STATUS */}
          <ResourceOverview state={section("resources")} />

          {/* 7. AUDIT / ACTIVITY PANEL */}
          <AuditActivityPanel state={section("audit")} />
        </div>
      </div>

      <footer className="mt-auto border-t border-[#e5dfd2] pt-4 text-xs sm:text-[13px] font-medium text-stone-600">
        <p>
          Operational coordination only. AIMBULENCE does not diagnose, triage, or prescribe, and
          processes synthetic data exclusively. Consequential actions require explicit human authorization.
        </p>
      </footer>
    </div>
  );
}
