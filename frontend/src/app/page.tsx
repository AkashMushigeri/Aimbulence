import { AuditPanel, HealthPanel, HospitalPanel, IncidentsPanel, ResourcesPanel } from "@/components/console";
import { ConnectionBadge, Panel, RefreshButton } from "@/components/common";
import { loadPublicConfig } from "@/lib/config";
import { describeError } from "@/lib/loadState";
import { loadConsoleData, type SectionKey } from "@/lib/serverLoad";
import { toStaffAvailability } from "@/lib/mappers";

/**
 * Operator console — Phase 2 read-only backend integration.
 *
 * Every figure below originates from a documented `[IMPLEMENTED]` endpoint on
 * Member 1's backend. Nothing is fabricated: when an endpoint fails, that
 * section renders an explicit error and shows no figures at all.
 *
 * There are no mutation controls here. Approval, runbook execution, and live
 * streaming are later phases and have no served contract.
 */
export const dynamic = "force-dynamic";

export default async function OperatorConsolePage() {
  const { appName, appTagline } = loadPublicConfig();
  const data = await loadConsoleData();

  const section = (key: SectionKey) => data.sections[key]?.state ?? { status: "loading" as const };
  const staffAvailability = data.resources ? toStaffAvailability(data.resources.staff) : undefined;

  const failureCount = Object.values(data.sections).filter(
    (entry) => entry.state.status === "failed",
  ).length;
  const availableCount = Object.values(data.sections).filter(
    (entry) => entry.state.status === "available",
  ).length;
  const totalSections = availableCount + failureCount;
  const partialFailure = failureCount > 0 && availableCount > 0;
  const allFailed = data.configured && totalSections > 0 && availableCount === 0;

  const backendConnection = !data.configured
    ? "DISCONNECTED"
    : allFailed
      ? "DISCONNECTED"
      : partialFailure
        ? "FAILED"
        : "CONNECTED";

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">{appName}</h1>
          <p className="mt-1 text-sm text-slate-400">{appTagline}</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge state={backendConnection} label="Backend" />
          <RefreshButton />
        </div>
      </header>

      {partialFailure ? (
        <p
          data-testid="partial-failure"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
          role="alert"
        >
          Partial failure: {availableCount} of {totalSections} endpoints responded. Affected sections
          show their own error and display no figures.
        </p>
      ) : null}

      {allFailed ? (
        <div data-testid="backend-unreachable">
          <Panel title="Backend unreachable" description="No documented endpoint could be reached.">
            <p className="text-sm text-slate-300">
              The console is running, but the AIMBULENCE operational backend did not respond. No
              hospital, incident, or audit figures are shown, because unverified operational state
              must never be presented as fact.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-400">
              {Object.entries(data.sections).map(([key, entry]) => (
                <li key={key}>
                  <span className="font-mono text-xs uppercase text-slate-500">{key}</span> —{" "}
                  {describeError(entry.state.status === "failed" ? entry.state.error : null)}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <RefreshButton />
            </div>
          </Panel>
        </div>
      ) : null}

      <HealthPanel state={section("health")} />
      <HospitalPanel state={section("hospital")} />
      <ResourcesPanel state={section("resources")} staffAvailability={staffAvailability} />
      <IncidentsPanel state={section("incidents")} />
      <AuditPanel state={section("audit")} />

      <Panel
        title="Deferred capability"
        description="Not available in Phase 2 because no backend contract is served."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>Runbook execution and the MCI-01 visualiser — Phase 3 contract not served.</li>
          <li>
            Consequential-action approval checkpoint — Phase 4 contract not served. No approval
            control is rendered, and none may be until the approval engine enforces it.
          </li>
          <li>Live streaming — no WebSocket or event contract has been published.</li>
          <li>State mutation controls — this phase is read-only.</li>
        </ul>
      </Panel>

      <footer className="mt-auto border-t border-surface-border pt-4 text-xs text-slate-500">
        <p>
          Operational coordination only. AIMBULENCE does not diagnose, triage, or prescribe, and
          handles synthetic data exclusively. Consequential actions require explicit human
          authorisation.
        </p>
      </footer>
    </main>
  );
}
