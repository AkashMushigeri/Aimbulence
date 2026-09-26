import { NextRequest, NextResponse } from "next/server";
import { relayError, requireService } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const service = requireService();
  if (!service) {
    return NextResponse.json({ error: "Backend unconfigured" }, { status: 503 });
  }
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const result = await service.resumeRunbook(id, body?.reason);
    return NextResponse.json(result);
  } catch (error) {
    return relayError(error);
  }
}
