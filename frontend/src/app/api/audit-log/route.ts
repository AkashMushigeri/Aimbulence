import { NextResponse } from "next/server";

import { relayError, requireService } from "../_shared";

export const dynamic = "force-dynamic";

/** Clamped to the documented default of 50 and maximum of 200. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function readLimit(raw: string | null): number {
  if (raw === null) {
    return DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

/** Proxies `GET /api/audit-log`. */
export async function GET(request: Request): Promise<NextResponse> {
  const service = requireService();
  if (!service) {
    return NextResponse.json(
      { error: { kind: "CONFIGURATION", message: "Backend base URL is not configured.", details: null } },
      { status: 503 },
    );
  }
  try {
    const limit = readLimit(new URL(request.url).searchParams.get("limit"));
    return NextResponse.json({ events: await service.getAuditLog(limit) });
  } catch (error) {
    return relayError(error);
  }
}
