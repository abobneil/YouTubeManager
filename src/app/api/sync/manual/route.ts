import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { requireAllowedMutationOrigin } from "@/lib/security";
import { enqueueManualSync } from "@/lib/sync/engine";

export async function POST(request: Request): Promise<NextResponse> {
  const originResponse = requireAllowedMutationOrigin(request);
  if (originResponse) {
    return originResponse;
  }
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
