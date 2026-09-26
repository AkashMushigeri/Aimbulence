import { NextRequest, NextResponse } from "next/server";
import { relayError, requireService } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const service = requireService();
  if (!service) {
    return NextResponse.json({ error: "Backend unconfigured" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state") || undefined;
  try {
    const checkpoints = await service.listCheckpoints(state);
    return NextResponse.json(checkpoints);
  } catch (error) {
    return relayError(error);
  }
}
