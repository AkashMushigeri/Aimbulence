import { NextResponse } from "next/server";

import { relayError, requireService } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * Proxies `GET /api/incidents` (read-only listing).
 *
 * `POST /api/incidents` is deliberately NOT proxied. Incident reporting is a
 * state mutation and Phase 2 is scoped to read-only integration; the mutation
 * control belongs to the later operator-console phase.
 */
export async function GET(): Promise<NextResponse> {
  const service = requireService();
  if (!service) {
    return NextResponse.json(
      { error: { kind: "CONFIGURATION", message: "Backend base URL is not configured.", details: null } },
      { status: 503 },
    );
  }
  try {
    return NextResponse.json({ incidents: await service.getIncidents() });
  } catch (error) {
    return relayError(error);
  }
}
