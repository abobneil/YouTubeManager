import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { enqueueManualSync } from "@/lib/sync/engine";

export async function POST(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  try {
    const result = await enqueueManualSync();
    return NextResponse.json(
      {
        ok: true,
        requestId: result.requestId,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
