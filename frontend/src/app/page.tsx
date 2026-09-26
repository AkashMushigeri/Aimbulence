import { OperationsDashboard } from "@/components/dashboard";
import { loadPublicConfig } from "@/lib/config";
import { loadConsoleData } from "@/lib/serverLoad";

/**
 * AIMBULENCE: LIVE OPERATIONS CONTROL CENTER — Phase 3
 *
 * Presents real-time operational data returned by the backend across:
 * - Top System Status Bar
 * - Incident Overview
 * - Hospital Capacity
 * - Resource Status
 * - Operational Deficits / Bottlenecks (Deterministic)
 * - Runbook Status Placeholder (Gated)
 * - Audit / Activity Panel
 * - Connection / Error State
 *
 * Consequential actions (RED) and runbook execution engine calls remain
 * deferred until corresponding backend contracts are served.
 */
export const dynamic = "force-dynamic";

export default async function OperatorConsolePage() {
  const { appName, appTagline } = loadPublicConfig();
  const data = await loadConsoleData();

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <OperationsDashboard
        configured={data.configured}
        sections={data.sections}
        health={data.health}
        hospital={data.hospital}
        resources={data.resources}
        incidents={data.incidents}
        audit={data.audit}
        execution={data.execution}
        activeCheckpoint={data.activeCheckpoint}
        appName={appName}
        appTagline={appTagline}
        lastRefreshed={data.health ? new Date().toISOString() : undefined}
      />
    </main>
  );
}
