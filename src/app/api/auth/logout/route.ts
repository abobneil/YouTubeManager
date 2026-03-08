import { NextResponse } from "next/server";
import { requireAllowedMutationOrigin, withNoStore } from "@/lib/security";
import { clearSession } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
  const originResponse = requireAllowedMutationOrigin(request);
  if (originResponse) {
    return originResponse;
  }
  await clearSession();
  return withNoStore(NextResponse.json({ ok: true }));
}
