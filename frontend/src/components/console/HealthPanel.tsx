import type { Loadable } from "@/lib/loadState";
import type { BackendHealth } from "@/services/operations";

import { ConnectionBadge, connectionStateOf, ErrorNotice, Panel, RefreshButton } from "../common";

/** SYSTEM STATUS — real `GET /api/health` result. */
export function HealthPanel({ state }: { state: Loadable<unknown> }) {
  const connection = connectionStateOf(state);

  return (
    <Panel
      title="System status"
      description="Live backend health reported by GET /api/health."
      action={<ConnectionBadge state={connection} />}
    >
      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Backend health check failed" />
          <RefreshButton target="health" />
        </div>
      ) : null}

      {state.status === "available" ? <HealthDetail health={state.data as BackendHealth} /> : null}
    </Panel>
  );
}

function HealthDetail({ health }: { health: BackendHealth }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-4" data-testid="health-detail">
      <Field label="Service status" value={health.status} testId="health-status" />
      <Field label="Service" value={health.service} />
      <Field label="Database" value={health.database} />
      <Field label="Environment" value={health.environment} />
    </dl>
  );
}

export function Field({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-mono text-slate-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
