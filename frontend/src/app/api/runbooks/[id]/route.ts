import { NextRequest, NextResponse } from "next/server";
import { relayError, requireService } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const service = requireService();
  if (!service) {
    return NextResponse.json({ error: "Backend unconfigured" }, { status: 503 });
  }
  try {
    const { id } = await params;
    const result = await service.getRunbookExecution(id);
    return NextResponse.json(result);
  } catch (error) {
    return relayError(error);
  }
}
