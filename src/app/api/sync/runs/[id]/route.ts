import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { toSyncRunDto } from "@/lib/serializers";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  const { id } = await params;
  try {
    const run = await prisma.syncRun.findUniqueOrThrow({
      where: { id },
      include: {
        events: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      run: toSyncRunDto(run),
      events: run.events.map((event) => ({
        id: event.id,
        level: event.level,
        code: event.code,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
        context: event.context,
      })),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return errorResponse(error);
  }
}
