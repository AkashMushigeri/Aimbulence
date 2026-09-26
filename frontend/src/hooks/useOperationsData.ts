"use client";

/**
 * Read-only data hooks.
 *
 * Each hook reads one documented `[IMPLEMENTED]` endpoint through its
 * same-origin proxy route, never directly from the backend. The backend origin
 * and any credential stay on the server.
 *
 * There is deliberately NO polling, SSE, or WebSocket subscription: Member 1
 * has published no event contract, so inventing one would misrepresent the
 * system as live. Data is fetched on mount and on explicit operator retry.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type ApiErrorKind } from "@/lib/errors";
import type { Loadable } from "@/lib/loadState";
import type { AuditEvent, HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";
import type { StaffAvailability } from "@/types/domain/capacity";
import type { BackendHealth } from "@/services/operations";

interface ProxyErrorBody {
  error?: { kind?: string; message?: string; details?: unknown };
}

/** Rebuild a typed error from the proxy's structured failure envelope. */
function toApiError(status: number, body: unknown): ApiError {
  const envelope = (body ?? {}) as ProxyErrorBody;
  const kind = (envelope.error?.kind ?? "NETWORK") as ApiErrorKind;
  const message = envelope.error?.message ?? `Proxy request failed with HTTP ${status}.`;
  return new ApiError(kind, message, { status, details: envelope.error?.details ?? null });
}

export interface EndpointHook<T> {
  readonly state: Loadable<T>;
  readonly refetch: () => void;
  readonly isLoading: boolean;
}

/**
 * Generic loader for a same-origin proxy endpoint.
 *
 * On refetch the previous value is intentionally discarded rather than shown
 * as current, because `instruction.md` section 6 of the Phase 2 brief forbids
 * presenting stale values as live without an explicit stale marker.
 */
function useEndpoint<T>(url: string | null): EndpointHook<T> {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (url === null) {
      return;
    }
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const body: unknown = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setState({ status: "failed", error: toApiError(response.status, body) });
          return;
        }
        setState({
          status: "available",
          data: body as T,
          loadedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setState({
          status: "failed",
          error: new ApiError(
            "NETWORK",
            error instanceof Error ? error.message : "Request failed.",
            { cause: error },
          ),
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, nonce]);

  const refetch = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return { state, refetch, isLoading: state.status === "loading" };
}

export function useHealth(): EndpointHook<BackendHealth> {
  return useEndpoint<BackendHealth>("/api/health");
}

export function useHospitalStatus(): EndpointHook<HospitalCapacity> {
  return useEndpoint<HospitalCapacity>("/api/hospital-status");
}

export interface ResourcesPayload {
  readonly resources: ResourceStatus;
  readonly staffAvailability: StaffAvailability;
}

export function useResources(): EndpointHook<ResourcesPayload> {
  return useEndpoint<ResourcesPayload>("/api/resources");
}

export interface IncidentsPayload {
  readonly incidents: Incident[];
}

export function useIncidents(): EndpointHook<IncidentsPayload> {
  return useEndpoint<IncidentsPayload>("/api/incidents");
}

export interface AuditLogPayload {
  readonly events: AuditEvent[];
}

export function useAuditLog(limit = 50): EndpointHook<AuditLogPayload> {
  const bounded = Math.min(200, Math.max(1, Math.trunc(limit)));
  return useEndpoint<AuditLogPayload>(`/api/audit-log?limit=${bounded}`);
}
