import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toSyncRunDto } from "@/lib/serializers";

export async function GET(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ runs: runs.map(toSyncRunDto) });
}
