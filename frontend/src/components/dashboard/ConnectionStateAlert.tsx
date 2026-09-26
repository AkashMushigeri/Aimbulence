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
      <div data-testid="backend-unconfigured" className="rounded-2xl border border-amber-300 bg-amber-50/80 p-6 shadow-xs">
        <h2 className="font-mono text-base sm:text-lg font-bold text-stone-900">Backend Not Configured</h2>
        <p className="mt-2 text-sm text-stone-700">
          The AIMBULENCE control center requires a live operational backend. Set <code className="font-mono text-xs text-amber-900 font-bold bg-[#ede7dc] px-2 py-0.5 rounded border border-[#d8d0c0]">BACKEND_BASE_URL</code> (or <code className="font-mono text-xs text-amber-900 font-bold bg-[#ede7dc] px-2 py-0.5 rounded border border-[#d8d0c0]">BACKEND_HOST</code> + <code className="font-mono text-xs text-amber-900 font-bold bg-[#ede7dc] px-2 py-0.5 rounded border border-[#d8d0c0]">BACKEND_PORT</code>) to connect.
        </p>
        <p className="mt-2 text-xs sm:text-[13px] text-stone-600 font-medium">
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
          <p className="text-sm text-stone-700 font-medium">
            The control center is active, but the AIMBULENCE operational backend failed to respond. All capacity, inventory, and incident figures are withheld to prevent misinforming emergency operators.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
            {Object.entries(sections).map(([key, entry]) => (
              <li key={key}>
                <span className="font-mono text-xs uppercase text-stone-500 font-bold">{entry.label}</span> —{" "}
                <span className="text-stone-800 font-medium">{describeError(entry.state.status === "failed" ? entry.state.error : null)}</span>
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
        className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-sm text-stone-800 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-bold uppercase tracking-wider text-amber-900">DEGRADED OPERATIONAL STATE: </span>
            <span className="text-stone-700 font-medium">
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
