import { NextResponse } from "next/server";

import { toStaffAvailability } from "@/lib/mappers";
import { relayError, requireService } from "../_shared";

export const dynamic = "force-dynamic";

/** Proxies `GET /api/resources` and derives the staff availability aggregate. */
export async function GET(): Promise<NextResponse> {
  const service = requireService();
  if (!service) {
    return NextResponse.json(
      { error: { kind: "CONFIGURATION", message: "Backend base URL is not configured.", details: null } },
      { status: 503 },
    );
  }
  try {
    const resources = await service.getResources();
    return NextResponse.json({
      resources,
      staffAvailability: toStaffAvailability(resources.staff),
    });
  } catch (error) {
    return relayError(error);
  }
}
