import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withNoStore } from "@/lib/security";

export async function GET(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }

  const owner = await prisma.ownerAccount.findUnique({
    where: { id: ownerId },
    select: {
      email: true,
      displayName: true,
      pictureUrl: true,
      updatedAt: true,
    },
  });

  return withNoStore(NextResponse.json({ owner }));
}
