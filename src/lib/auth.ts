import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOwnerId } from "@/lib/session";

export async function requireOwnerSession(): Promise<string | NextResponse> {
  const ownerId = await getSessionOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owner = await prisma.ownerAccount.findUnique({ where: { id: ownerId } });
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return ownerId;
}
