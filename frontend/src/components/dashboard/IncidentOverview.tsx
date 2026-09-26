"use client";

import { useState, useTransition } from "react";
import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { Incident, IncidentSeverity, IncidentStatus } from "@/types/domain";
import { triggerDocumentedMciAction } from "@/app/actions";
import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  CRITICAL: "border-red-500/60 bg-red-500/20 text-red-200",
  HIGH: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  MEDIUM: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  LOW: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  REPORTED: "border-sky-500/50 bg-sky-500/15 text-sky-200",
  TRIAGING: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  MOBILIZING: "border-purple-500/50 bg-purple-500/15 text-purple-200",
  RESOLVED: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
  CANCELLED: "border-slate-500/50 bg-slate-500/15 text-slate-300",
};

export interface IncidentOverviewProps {
  readonly state: Loadable<unknown>;
}

export function IncidentOverview({ state }: IncidentOverviewProps) {
  const [actionPending, startAction] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleDispatchMci = () => {
    setFeedback(null);
    startAction(async () => {
      const res = await triggerDocumentedMciAction();
      setFeedback(res.message ?? (res.ok ? "Incident dispatched successfully." : "Dispatch failed."));
    });
  };

  const incidents = state.status === "available" ? (state.data as Incident[]) : [];

  return (
    <Panel
      title="Incident Overview"
      description="Active emergency dispatch notifications from GET /api/incidents."
      action={
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionStateOf(state)} />
          <RefreshButton target="incidents" />
        </div>
      }
    >
      {state.status === "loading" ? <LoadingState label="incident feed" /> : null}

      {state.status === "failed" ? (
        <div className="space-y-3">
          <ErrorNotice error={state.error} title="Incident feed unavailable" />
          <p className="text-xs text-slate-400">
            Backend incident records cannot be loaded. No incidents are fabricated or defaulted.
          </p>
        </div>
      ) : null}

      {state.status === "available" && incidents.length === 0 ? (
        <div className="space-y-4">
          <EmptyState title="No Active Emergency Incidents">
            <p className="text-slate-400">
              The connected operational backend reports zero active mass-casualty incidents.
            </p>
          </EmptyState>

          <div className="flex flex-col items-start gap-2 rounded border border-surface-border bg-surface/30 p-3">
            <p className="font-mono text-xs uppercase tracking-wide text-slate-400">
              Operator Dispatch Intake (MCI-01 Contract):
            </p>
            <p className="text-xs text-slate-400">
              Trigger the documented Mass-Casualty Collision incident to initiate emergency surge assessment.
            </p>
            <button
              type="button"
              data-testid="trigger-mci-btn"
              disabled={actionPending}
              onClick={handleDispatchMci}
              className="focus-ring mt-1 rounded border border-red-500/50 bg-red-500/20 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50"
            >
              {actionPending ? "Ingesting Dispatch Alert…" : "Report Documented MCI-01 Alert"}
            </button>
            {feedback ? (
              <p data-testid="dispatch-feedback" className="mt-1 text-xs text-slate-300">
                {feedback}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.status === "available" && incidents.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-slate-400">
              Tracked Incidents: <strong className="text-slate-200">{incidents.length}</strong>
            </span>
            <button
              type="button"
              data-testid="trigger-mci-btn-secondary"
              disabled={actionPending}
              onClick={handleDispatchMci}
              className="focus-ring rounded border border-surface-border bg-surface px-2.5 py-1 font-mono text-xs text-slate-300 hover:border-red-500/50 hover:text-red-200 disabled:opacity-50"
            >
              {actionPending ? "Ingesting…" : "+ Ingest MCI-01 Dispatch"}
            </button>
          </div>

          {feedback ? (
            <p data-testid="dispatch-feedback" className="text-xs text-slate-300">
              {feedback}
            </p>
          ) : null}

          <ul className="space-y-3" data-testid="incident-list">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                data-testid={`incident-card-${incident.id}`}
                className="rounded-lg border border-surface-border bg-surface/60 p-4 transition-colors hover:border-slate-600"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-surface-border/50 pb-2.5">
                  <div>
                    <span className="font-mono text-xs font-bold text-sky-400">{incident.id}</span>
                    <h3 className="mt-0.5 text-base font-semibold text-slate-100">{incident.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`incident-severity-${incident.id}`}
                      className={`rounded border px-2 py-0.5 font-mono text-xs uppercase font-bold tracking-wide ${
                        SEVERITY_STYLES[incident.severity] ?? "border-slate-500 text-slate-300"
                      }`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
                        STATUS_STYLES[incident.status] ?? "border-slate-500 text-slate-300"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded border border-surface-border/40 bg-surface-raised/40 p-2">
                    <span className="uppercase text-slate-500">Incident Type</span>
                    <p className="mt-0.5 font-mono font-medium text-slate-200">{incident.incidentType}</p>
                  </div>
                  <div className="rounded border border-surface-border/40 bg-surface-raised/40 p-2">
                    <span className="uppercase text-slate-500">Casualties Expected</span>
                    <p
                      data-testid={`incident-casualties-${incident.id}`}
                      className="mt-0.5 font-mono text-base font-bold text-red-300"
                    >
                      {incident.casualtyCount} casualties
                    </p>
                  </div>
                  <div className="rounded border border-surface-border/40 bg-surface-raised/40 p-2">
                    <span className="uppercase text-slate-500">Location</span>
                    <p className="mt-0.5 font-mono text-slate-200">{incident.location}</p>
                  </div>
                  <div className="rounded border border-surface-border/40 bg-surface-raised/40 p-2">
                    <span className="uppercase text-slate-500">First Arrival ETA</span>
                    <p className="mt-0.5 font-mono font-bold text-amber-300">{incident.etaMinutes} minutes</p>
                  </div>
                </div>

                {incident.description ? (
                  <p className="mt-3 rounded border border-surface-border/30 bg-surface/30 px-3 py-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Dispatch Notes: </span>
                    {incident.description}
                  </p>
                ) : null}

                <div className="mt-2 text-right font-mono text-[11px] text-slate-500">
                  Reported: {formatRelativeAge(incident.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
