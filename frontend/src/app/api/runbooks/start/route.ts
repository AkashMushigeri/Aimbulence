import { NextRequest, NextResponse } from "next/server";
import { relayError, requireService } from "../../_shared";
import type { StartRunbookRequestWire } from "@/types/api/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const service = requireService();
  if (!service) {
    return NextResponse.json({ error: "Backend unconfigured" }, { status: 503 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as StartRunbookRequestWire;
    const result = await service.startMciRunbook(body);
    return NextResponse.json(result);
  } catch (error) {
    return relayError(error);
  }
}
