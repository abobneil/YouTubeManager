import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { getRuleReviewPage } from "@/lib/rule-review";
import { errorResponse } from "@/lib/http";
import { ruleReviewQuerySchema } from "@/lib/validators";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = ruleReviewQuerySchema.parse({
      state: searchParams.get("state") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    const review = await getRuleReviewPage(id, query);
    return NextResponse.json(review);
  } catch (error) {
    return errorResponse(error);
  }
}
