import { NextRequest, NextResponse } from "next/server";
import { relayError, requireService } from "../../_shared";
import type { DecideRequestWire } from "@/types/api/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const service = requireService();
  if (!service) {
    return NextResponse.json({ error: "Backend unconfigured" }, { status: 503 });
  }
  try {
    const body = (await request.json()) as DecideRequestWire;
    const result = await service.decideApproval(body);
    return NextResponse.json(result);
  } catch (error) {
    return relayError(error);
  }
}
