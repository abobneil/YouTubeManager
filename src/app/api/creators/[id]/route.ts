import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, parseJson } from "@/lib/http";
import { requireAllowedMutationOrigin } from "@/lib/security";
import { toCreatorDto } from "@/lib/serializers";
import { creatorUpdateSchema } from "@/lib/validators";

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
    const payload = await parseJson(request, creatorUpdateSchema);
    const creator = await prisma.creator.update({
      where: { id },
      data: payload,
    });
    return NextResponse.json({ creator: toCreatorDto(creator) });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
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
    await prisma.creator.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }
    return errorResponse(error);
  }
}
