import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, parseJson } from "@/lib/http";
import { requireAllowedMutationOrigin } from "@/lib/security";
import { toRuleDto } from "@/lib/serializers";
import { topicRuleUpdateSchema } from "@/lib/validators";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const originResponse = requireAllowedMutationOrigin(request);
  if (originResponse) {
    return originResponse;
  }
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  const { id } = await params;
  try {
    const payload = await parseJson(request, topicRuleUpdateSchema);

    const {
      creatorScopeIds,
      ...rulePayload
    } = payload;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.topicRule.update({
        where: { id },
        data: rulePayload,
        include: {
          ruleCreators: {
            select: { creatorId: true },
          },
        },
      });

      if (creatorScopeIds) {
        await tx.ruleCreator.deleteMany({ where: { ruleId: id } });
        if (creatorScopeIds.length > 0) {
          await tx.ruleCreator.createMany({
            data: creatorScopeIds.map((creatorId) => ({ ruleId: id, creatorId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.topicRule.findUniqueOrThrow({
        where: { id },
        include: {
          ruleCreators: {
            select: { creatorId: true },
          },
        },
      });
    });

    return NextResponse.json({ rule: toRuleDto(updated) });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return errorResponse(error);
  }
}

export async function DELETE(_: NextRequest, { params }: Params): Promise<NextResponse> {
  const originResponse = requireAllowedMutationOrigin(_);
  if (originResponse) {
    return originResponse;
  }
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  const { id } = await params;
  try {
    await prisma.topicRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return errorResponse(error);
  }
}
