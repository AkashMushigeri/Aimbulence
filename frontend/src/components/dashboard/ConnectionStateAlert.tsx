import { Panel, RefreshButton } from "@/components/common";
import { describeError } from "@/lib/loadState";
import type { SectionStates } from "@/lib/loadState";

export interface ConnectionStateAlertProps {
  readonly configured: boolean;
  readonly partialFailure: boolean;
  readonly allFailed: boolean;
  readonly availableCount: number;
  readonly totalSections: number;
  readonly sections: SectionStates;
}

export function ConnectionStateAlert({
  configured,
  partialFailure,
  allFailed,
  availableCount,
  totalSections,
  sections,
}: ConnectionStateAlertProps) {
  if (!configured) {
    return (
      <div data-testid="backend-unconfigured" className="rounded-lg border border-slate-700 bg-surface-raised p-5">
        <h2 className="font-mono text-base font-semibold text-slate-200">Backend Not Configured</h2>
        <p className="mt-2 text-sm text-slate-400">
          The AIMBULENCE control center requires a live operational backend. Set <code className="font-mono text-xs text-sky-300">BACKEND_BASE_URL</code> (or <code className="font-mono text-xs text-sky-300">BACKEND_HOST</code> + <code className="font-mono text-xs text-sky-300">BACKEND_PORT</code>) to connect.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          No synthetic fallback data is substituted. Unverified numbers are never presented as operational fact.
        </p>
      </div>
    );
  }

  if (allFailed) {
    return (
      <div data-testid="backend-unreachable">
        <Panel
          title="Backend Disconnected / Unreachable"
          description="None of the documented operational endpoints could be reached."
        >
          <p className="text-sm text-slate-300">
            The control center is active, but the AIMBULENCE operational backend failed to respond. All capacity, inventory, and incident figures are withheld to prevent misinforming emergency operators.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-400">
            {Object.entries(sections).map(([key, entry]) => (
              <li key={key}>
                <span className="font-mono text-xs uppercase text-slate-500">{entry.label}</span> —{" "}
                {describeError(entry.state.status === "failed" ? entry.state.error : null)}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <RefreshButton />
          </div>
        </Panel>
      </div>
    );
  }

  if (partialFailure) {
    return (
      <div
        data-testid="partial-failure-alert"
        role="alert"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-semibold uppercase tracking-wider text-amber-300">DEGRADED OPERATIONAL STATE: </span>
            <span>
              {availableCount} of {totalSections} endpoints responded. Affected sections display individual error boundaries with figures withheld.
            </span>
          </div>
          <RefreshButton />
        </div>
      </div>
    );
  }

  return null;
}
