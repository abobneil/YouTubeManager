import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { errorResponse, parseJson } from "@/lib/http";
import { correctRuleVideos } from "@/lib/rule-review";
import { requireAllowedMutationOrigin } from "@/lib/security";
import { ruleReviewMutationSchema } from "@/lib/validators";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const originResponse = requireAllowedMutationOrigin(request);
  if (originResponse) {
    return originResponse;
  }

  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }

  try {
    const { id } = await params;
    const payload = await parseJson(request, ruleReviewMutationSchema);
    const result = await correctRuleVideos(id, payload.videoIds);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
