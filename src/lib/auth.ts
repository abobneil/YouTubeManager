import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOwnerId } from "@/lib/session";
import { withNoStore } from "@/lib/security";

export async function requireOwnerSession(): Promise<string | NextResponse> {
  const ownerId = await getSessionOwnerId();
  if (!ownerId) {
    return withNoStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const owner = await prisma.ownerAccount.findUnique({ where: { id: ownerId } });
  if (!owner) {
    return withNoStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  return ownerId;
}
