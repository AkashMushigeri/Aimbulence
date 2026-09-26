/**
 * Shared plumbing for the same-origin proxy routes.
 *
 * The browser must never learn the backend origin, so all backend traffic is
 * relayed through these Next.js route handlers, which execute server-side.
 * Each handler maps exactly one documented `[IMPLEMENTED]` endpoint.
 */
import { NextResponse } from "next/server";

import { isApiError } from "@/lib/errors";
import { getOperationsService } from "@/services/operations";

/**
 * Relay a backend failure to the browser as a structured JSON body, preserving
 * the status and the typed error kind so the UI can distinguish a
 * configuration problem from an unreachable backend.
 */
export function relayError(error: unknown): NextResponse {
  if (isApiError(error)) {
    const status = error.status && error.status >= 400 ? error.status : 502;
    return NextResponse.json(
      { error: { kind: error.kind, message: error.message, details: error.details ?? null } },
      { status },
    );
  }
  return NextResponse.json(
    {
      error: {
        kind: "NETWORK",
        message: error instanceof Error ? error.message : "Unknown proxy failure.",
        details: null,
      },
    },
    { status: 502 },
  );
}

export type ServiceOrNull = ReturnType<typeof getOperationsService>;

export function requireService(): ServiceOrNull {
  return getOperationsService();
}
