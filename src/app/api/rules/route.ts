import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, parseJson } from "@/lib/http";
import { toRuleDto } from "@/lib/serializers";
import { topicRuleCreateSchema } from "@/lib/validators";

export async function GET(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  const rules = await prisma.topicRule.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      ruleCreators: {
        select: { creatorId: true },
      },
    },
  });
  return NextResponse.json({ rules: rules.map(toRuleDto) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  try {
    const payload = await parseJson(request, topicRuleCreateSchema);
    const rule = await prisma.topicRule.create({
      data: {
        name: payload.name,
        includeKeywords: payload.includeKeywords,
        excludeKeywords: payload.excludeKeywords,
        matchFields: payload.matchFields,
        caseSensitive: payload.caseSensitive,
        orderMode: payload.orderMode,
        privacyStatus: payload.privacyStatus,
        active: payload.active,
        ruleCreators: {
          create: payload.creatorScopeIds.map((creatorId) => ({ creatorId })),
        },
      },
      include: {
        ruleCreators: {
          select: { creatorId: true },
        },
      },
    });

    return NextResponse.json({ rule: toRuleDto(rule) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
