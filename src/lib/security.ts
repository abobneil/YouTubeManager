import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { HttpError } from "@/lib/errors";

export const EDGE_AUTH_HEADER = "x-edge-auth";

export function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function requestOriginFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function getSourceIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}

export function isAllowedMutationRequest(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    return allowedOrigins.includes(origin);
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return false;
  }

  const refererOrigin = requestOriginFromReferer(referer);
  return refererOrigin ? allowedOrigins.includes(refererOrigin) : false;
}

export function requireAllowedMutationOrigin(request: Request): NextResponse | null {
  if (isAllowedMutationRequest(request, env.ALLOWED_MUTATION_ORIGINS)) {
    return null;
  }

  return withNoStore(
    NextResponse.json(
      {
        error: "Mutation origin not allowed",
        code: "ORIGIN_NOT_ALLOWED",
      },
      { status: 403 },
    ),
  );
}

export function requireTrustedEdge(request: Request): void {
  if (!env.isProduction) {
    return;
  }

  const header = request.headers.get(EDGE_AUTH_HEADER);
  if (header !== env.EDGE_SHARED_SECRET) {
    throw new HttpError(403, "EDGE_AUTH_REQUIRED", "Trusted proxy authentication required.");
  }
}
