"use client";

import { useState, useTransition } from "react";
import type { PreArrivalAction, PreArrivalCase } from "@/types/domain/prearrival";
import { decidePreArrivalActionAction } from "@/app/actions";

interface PreArrivalPlanViewProps {
  activeCase: PreArrivalCase | null;
  onActionUpdated?: (action: PreArrivalAction) => void;
}

export function PreArrivalPlanView({ activeCase, onActionUpdated }: PreArrivalPlanViewProps) {
  const [clinicianName, setClinicianName] = useState("Dr. Sarah Vance, Trauma Lead");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingActionId, setRejectingActionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completedActions, setCompletedActions] = useState<Record<number, boolean>>({});

  if (!activeCase) {
    return (
      <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-6 text-center shadow-sm">
        <p className="font-mono text-sm font-semibold text-stone-700">No Pre-Arrival Plan Active</p>
        <p className="text-xs text-stone-400">Preparation recommendations and resource alerts will appear here once an ambulance transmits patient information.</p>
      </div>
    );
  }

  const handleDecision = (
    actionId: string,
    decision: "APPROVE" | "REJECT" | "ACKNOWLEDGE",
    customReason?: string,
  ) => {
    startTransition(async () => {
      const res = await decidePreArrivalActionAction(
        activeCase.id,
        actionId,
        decision,
        clinicianName,
        customReason || (decision === "APPROVE" ? "Clinically authorized for incoming emergency." : "Acknowledged by trauma staff."),
      );
      if (res.ok && res.action) {
        onActionUpdated?.(res.action);
        setRejectingActionId(null);
        setRejectReason("");
      }
    });
  };

  const toggleActionItem = (idx: number) => {
    setCompletedActions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-[#fffdfa] shadow-sm overflow-hidden">
      {/* Plan Header */}
      <div className="border-b border-stone-200 bg-[#f9f5ee] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-red-600 animate-pulse" />
              <h2 className="font-mono text-base font-bold tracking-tight text-stone-900">
                AIMBULENCE PRE-ARRIVAL PREPARATION PLAN
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600 font-mono">
              Patient: {activeCase.patient_name || "Emergency Patient"} • Unit: {activeCase.ambulance_id} • ETA: {activeCase.eta_minutes} min • Priority: {activeCase.priority}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-stone-600">Authorized Clinician:</label>
            <input
              type="text"
              value={clinicianName}
              onChange={(e) => setClinicianName(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-stone-800 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Recommended Preparation Table */}
      <div className="p-5 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-stone-700">
              1. Recommended Resource Preparations &amp; Human-in-the-Loop Gate
            </h3>
            <span className="text-[11px] font-mono text-stone-500">
              AI Recommendations must be approved by authorized personnel before execution
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b border-stone-200 bg-stone-50 font-mono text-[11px] font-bold text-stone-700 uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Category &amp; Resource</th>
                  <th className="px-3.5 py-2.5">AI Clinical Reason</th>
                  <th className="px-3.5 py-2.5 text-center">Hospital Availability</th>
                  <th className="px-3.5 py-2.5 text-right">Human Authorization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {activeCase.actions.map((act) => {
                  const isRejecting = rejectingActionId === act.id;

                  return (
                    <tr key={act.id} className="hover:bg-stone-50/70 transition-colors">
                      {/* Resource Name */}
                      <td className="px-3.5 py-3 align-top font-mono">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                          {act.resource_category}
                        </span>
                        <span className="font-bold text-stone-900 text-xs">
                          {act.resource_name}
                        </span>
                        <span className="block text-[10px] text-stone-500">
                          Status: {act.recommended_status}
                        </span>
                      </td>

                      {/* Clinical Reason */}
                      <td className="px-3.5 py-3 align-top text-stone-700 max-w-xs leading-relaxed">
                        {act.reason}
                      </td>

                      {/* Hospital Availability */}
                      <td className="px-3.5 py-3 align-top text-center">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                            act.hospital_availability === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : act.hospital_availability === "LIMITED"
                              ? "bg-amber-100 text-amber-800"
                              : act.hospital_availability === "RESERVED"
                              ? "bg-purple-100 text-purple-800"
                              : act.hospital_availability === "PREPARING"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {act.hospital_availability}
                        </span>
                        <span className="block text-[9px] text-stone-400 mt-0.5">Demo Data</span>
                      </td>

                      {/* Human-in-the-Loop Decision Buttons */}
                      <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                        {act.decision_type === "APPROVED" ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
                              ✓ APPROVED
                            </span>
                            <span className="block text-[10px] text-stone-500 mt-0.5">
                              by {act.decision_by || "Clinician"}
                            </span>
                          </div>
                        ) : act.decision_type === "REJECTED" ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-mono text-[11px] font-bold text-red-800">
                              ✕ REJECTED
                            </span>
                            <span className="block text-[10px] text-stone-500 mt-0.5">
                              by {act.decision_by || "Clinician"}
                            </span>
                          </div>
                        ) : act.decision_type === "ACKNOWLEDGED" ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-800">
                              ✓ ACKNOWLEDGED
                            </span>
                          </div>
                        ) : isRejecting ? (
                          <div className="space-y-1 text-left bg-stone-50 p-2 rounded border border-stone-200">
                            <input
                              type="text"
                              placeholder="Clinical reason for rejection..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="w-full text-[11px] border border-stone-300 rounded p-1 font-sans text-stone-900"
                            />
                            <div className="flex justify-end gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => setRejectingActionId(null)}
                                className="px-2 py-0.5 text-[10px] text-stone-600 hover:bg-stone-200 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDecision(act.id, "REJECT", rejectReason)}
                                disabled={isPending}
                                className="px-2 py-0.5 text-[10px] bg-red-600 text-white font-bold rounded hover:bg-red-700"
                              >
                                Confirm Reject
                              </button>
                            </div>
                          </div>
                        ) : act.requires_approval ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              data-testid={`approve-btn-${act.id}`}
                              onClick={() => handleDecision(act.id, "APPROVE")}
                              disabled={isPending}
                              className="rounded border border-emerald-600 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                            >
                              APPROVE
                            </button>
                            <button
                              type="button"
                              data-testid={`reject-btn-${act.id}`}
                              onClick={() => setRejectingActionId(act.id)}
                              disabled={isPending}
                              className="rounded border border-stone-300 bg-white px-2 py-1 font-mono text-[11px] font-medium text-stone-700 transition hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                            >
                              REJECT
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            data-testid={`acknowledge-btn-${act.id}`}
                            onClick={() => handleDecision(act.id, "ACKNOWLEDGE")}
                            disabled={isPending}
                            className="rounded border border-sky-400 bg-sky-50 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-800 shadow-sm transition hover:bg-sky-600 hover:text-white disabled:opacity-50"
                          >
                            ACKNOWLEDGE
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Immediate Actions Checklist */}
        <div>
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
            2. Immediate Clinical Preparation Checklist (Before Arrival)
          </h3>
          <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-4 space-y-2">
            {(activeCase.immediate_actions || []).map((act, idx) => (
              <label
                key={idx}
                className="flex items-start gap-3 cursor-pointer text-xs text-stone-800 select-none hover:text-stone-900"
              >
                <input
                  type="checkbox"
                  checked={!!completedActions[idx]}
                  onChange={() => toggleActionItem(idx)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                />
                <span className={completedActions[idx] ? "line-through text-stone-400" : "font-medium"}>
                  {idx + 1}. {act}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
