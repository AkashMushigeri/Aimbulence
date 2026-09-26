"use client";

import { useState, useTransition } from "react";
import { formatRelativeAge } from "@/lib/format";
import type { Loadable } from "@/lib/loadState";
import type { Incident, IncidentSeverity, IncidentStatus } from "@/types/domain";
import { triggerDocumentedMciAction } from "@/app/actions";
import { ConnectionBadge, connectionStateOf, EmptyState, ErrorNotice, LoadingState, Panel, RefreshButton } from "@/components/common";

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  MEDIUM: "border-yellow-200 bg-yellow-50 text-yellow-800",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  REPORTED: "border-sky-200 bg-sky-50 text-sky-700",
  TRIAGING: "border-amber-200 bg-amber-50 text-amber-700",
  MOBILIZING: "border-purple-200 bg-purple-50 text-purple-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
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
          <p className="text-xs text-slate-500">
            Backend incident records cannot be loaded. No incidents are fabricated or defaulted.
          </p>
        </div>
      ) : null}

      {state.status === "available" && incidents.length === 0 ? (
        <div className="space-y-4">
          <EmptyState title="No Active Emergency Incidents">
            <p className="text-slate-500">
              The connected operational backend reports zero active mass-casualty incidents.
            </p>
          </EmptyState>

          <div className="flex flex-col items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="font-mono text-xs uppercase font-bold tracking-wider text-slate-600">
              Operator Dispatch Intake (MCI-01 Contract):
            </p>
            <p className="text-xs text-slate-600">
              Trigger the documented Mass-Casualty Collision incident to initiate emergency surge assessment.
            </p>
            <button
              type="button"
              data-testid="trigger-mci-btn"
              disabled={actionPending}
              onClick={handleDispatchMci}
              className="focus-ring mt-1 rounded-lg border border-red-300 bg-red-500 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-red-600 hover:shadow disabled:opacity-50"
            >
              {actionPending ? "Ingesting Dispatch Alert…" : "Report Documented MCI-01 Alert"}
            </button>
            {feedback ? (
              <p data-testid="dispatch-feedback" className="mt-1 text-xs text-slate-700 font-medium">
                {feedback}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.status === "available" && incidents.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs sm:text-sm uppercase text-stone-600 font-bold">
              Tracked Incidents: <strong className="text-stone-900">{incidents.length}</strong>
            </span>
            <button
              type="button"
              data-testid="trigger-mci-btn-secondary"
              disabled={actionPending}
              onClick={handleDispatchMci}
              className="focus-ring rounded-lg border border-[#d8d0c0] bg-white px-3.5 py-1.5 font-mono text-xs font-bold text-stone-800 shadow-xs hover:border-red-400 hover:text-red-700 transition-all disabled:opacity-50"
            >
              {actionPending ? "Ingesting…" : "+ Ingest MCI-01 Dispatch"}
            </button>
          </div>

          {feedback ? (
            <p data-testid="dispatch-feedback" className="text-xs sm:text-sm text-stone-700 font-medium">
              {feedback}
            </p>
          ) : null}

          <ul className="space-y-3.5" data-testid="incident-list">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                data-testid={`incident-card-${incident.id}`}
                className="rounded-2xl border border-[#e5dfd2] bg-[#fffdf9] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-[#d8d0c0]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#ece5d8] pb-3">
                  <div>
                    <span className="font-mono text-xs sm:text-sm font-bold text-sky-700">{incident.id}</span>
                    <h3 className="mt-0.5 text-base sm:text-lg font-bold text-stone-900">{incident.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`incident-severity-${incident.id}`}
                      className={`rounded-md border px-2.5 py-0.5 font-mono text-xs uppercase font-extrabold tracking-wider shadow-xs ${
                        SEVERITY_STYLES[incident.severity] ?? "border-stone-200 text-stone-700"
                      }`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`rounded-md border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider font-bold ${
                        STATUS_STYLES[incident.status] ?? "border-stone-200 text-stone-700"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-3.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Incident Type</span>
                    <p className="mt-1 font-mono font-bold text-stone-900 sm:text-sm">{incident.incidentType}</p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-700">Casualties Expected</span>
                    <p
                      data-testid={`incident-casualties-${incident.id}`}
                      className="mt-1 font-mono text-base sm:text-lg font-black text-red-800"
                    >
                      {incident.casualtyCount} casualties
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] p-3.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">Location</span>
                    <p className="mt-1 font-mono font-bold text-stone-800 sm:text-sm">{incident.location}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800">First Arrival ETA</span>
                    <p className="mt-1 font-mono font-bold text-amber-900 sm:text-sm">{incident.etaMinutes} minutes</p>
                  </div>
                </div>

                {incident.description ? (
                  <p className="mt-3 rounded-xl border border-[#e5dfd2] bg-[#fbf9f4] px-4 py-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
                    <span className="font-mono text-xs font-bold uppercase text-stone-600">Dispatch Notes: </span>
                    {incident.description}
                  </p>
                ) : null}

                <div className="mt-2.5 text-right font-mono text-xs text-stone-600 font-medium">
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
