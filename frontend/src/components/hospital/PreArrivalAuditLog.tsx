"use client";

import { useEffect, useState } from "react";
import type { AuditEvent } from "@/types/domain";

interface PreArrivalAuditLogProps {
  initialEvents?: AuditEvent[];
}

export function PreArrivalAuditLog({ initialEvents = [] }: PreArrivalAuditLogProps) {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, [initialEvents]);

  return (
    <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📜</span>
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-stone-900">
            Pre-Arrival Audit Trail &amp; Human Authorization Log
          </h3>
        </div>
        <span className="font-mono text-[10px] text-stone-400">Microsecond Timestamped • Append-Only</span>
      </div>

      {events.length === 0 ? (
        <p className="font-mono text-xs text-stone-400 py-3 text-center">
          No audit records logged yet. Action approvals and transmissions will appear here.
        </p>
      ) : (
        <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto font-mono text-xs">
          {events.slice(0, 10).map((ev) => {
            const isExpanded = expandedId === ev.id;
            const isRed = ev.tier === "RED";

            return (
              <div key={ev.id} className="py-2.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        isRed ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {ev.tier || "INFO"}
                    </span>
                    <span className="font-bold text-stone-900">{ev.eventType}</span>
                  </div>

                  <span className="text-[10px] text-stone-400">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-600">
                  <span>Action: {ev.actionName || "—"}</span>
                  <span className="text-stone-500">By: {ev.performedBy}</span>
                </div>

                {ev.details && Object.keys(ev.details).length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      className="text-[10px] text-stone-400 hover:text-stone-700 underline"
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>
                    {isExpanded && (
                      <pre className="mt-1 p-2 bg-stone-50 rounded border border-stone-200 text-[10px] overflow-x-auto text-stone-800">
                        {JSON.stringify(ev.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
