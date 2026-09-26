import { Panel } from "@/components/common";

/**
 * RUNBOOK STATUS AREA (Phase 3 Placeholder).
 *
 * GOVERNANCE (Phase 3 Specification §7 & instruction.md §19):
 * - Communicates Runbook: MCI-01 and Status: NOT CONNECTED / WAITING FOR EXECUTION ENGINE.
 * - Strictly NO fabricated current step, completed steps, execution percentage, or tool calls.
 * - Strictly NO fake progress bars.
 * - Strictly NO simulation of the 15-step runbook until backend execution contract is served.
 */
export function RunbookSection() {
  return (
    <Panel
      title="RUNBOOK EXECUTION"
      description="Autonomous operational procedure orchestration."
      action={
        <span
          data-testid="runbook-status-badge"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-amber-300"
        >
          NOT CONNECTED / WAITING FOR EXECUTION ENGINE
        </span>
      }
    >
      <div className="space-y-4 rounded-lg border border-dashed border-surface-border bg-surface/30 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-border/50 pb-2">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">Target Runbook</span>
            <p data-testid="runbook-id" className="font-mono text-base font-bold text-slate-100">
              MCI-01 — Mass-Casualty Response Runbook
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-400">Engine State</span>
            <p data-testid="runbook-engine-state" className="font-mono text-xs font-semibold text-amber-300">
              NOT CONNECTED / WAITING FOR EXECUTION ENGINE
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-400">
          <p>
            The TrueForge agent loop and runbook execution engine interface is planned for subsequent integration. In accordance with system safety governance:
          </p>
          <ul className="list-disc space-y-1 pl-4 text-slate-400">
            <li>No fake execution steps or simulated tool progress are fabricated.</li>
            <li>No artificial completion percentages or progress bars are displayed.</li>
            <li>The full runbook visualizer remains gated until the backend execution state contract is served.</li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}
