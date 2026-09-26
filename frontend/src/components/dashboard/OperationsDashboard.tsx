import type { BackendHealth } from "@/services/operations";
import type {
  AgentExecutionState,
  AuditEvent,
  HospitalCapacity,
  Incident,
  ResourceStatus,
} from "@/types/domain";
import type { SectionKey } from "@/lib/serverLoad";
import type { SectionStates } from "@/lib/loadState";
import type { ConnectionState } from "@/components/common";

import { SystemStatus } from "./SystemStatus";
import { ConnectionStateAlert } from "./ConnectionStateAlert";
import { IncidentOverview } from "./IncidentOverview";
import { CapacityOverview } from "./CapacityOverview";
import { ResourceOverview } from "./ResourceOverview";
import { DeficitPanel } from "./DeficitPanel";
import { RunbookSection } from "./RunbookSection";
import { AuditActivityPanel } from "./AuditActivityPanel";

export interface OperationsDashboardProps {
  readonly configured: boolean;
  readonly sections: SectionStates;
  readonly health?: BackendHealth;
  readonly hospital?: HospitalCapacity;
  readonly resources?: ResourceStatus;
  readonly incidents?: readonly Incident[];
  readonly audit?: readonly AuditEvent[];
  readonly execution?: AgentExecutionState | null;
  readonly appName?: string;
  readonly appTagline?: string;
  readonly lastRefreshed?: string;
}

export function OperationsDashboard({
  configured,
  sections,
  health,
  execution,
  appName = "AIMBULENCE",
  appTagline = "AI Emergency Hospital Operations Runbook Executor",
  lastRefreshed,
}: OperationsDashboardProps) {

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

      {/* OPERATIONAL GRID LAYOUT */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column (Incident, Deficits, Runbook Placeholder) - 7 cols on lg */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* 2. INCIDENT OVERVIEW */}
          <IncidentOverview state={section("incidents")} />

          {/* 5. OPERATIONAL DEFICITS / BOTTLENECKS */}
          <DeficitPanel
            hospitalState={section("hospital")}
            resourcesState={section("resources")}
            incidentsState={section("incidents")}
          />

          {/* 6. RUNBOOK STATUS & VISUALIZER */}
          <RunbookSection execution={execution} isConnected={isHealthAvailable} />

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

      <footer className="mt-auto border-t border-surface-border/60 pt-4 text-xs text-slate-500">
        <p>
          Operational coordination only. AIMBULENCE does not diagnose, triage, or prescribe, and
          processes synthetic data exclusively. Consequential actions require explicit human authorization.
        </p>
      </footer>
    </div>
  );
}
