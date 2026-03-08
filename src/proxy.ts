import { NextRequest, NextResponse } from "next/server";
import { EDGE_AUTH_HEADER } from "@/lib/security";

function isHealthPath(pathname: string): boolean {
  return pathname === "/api/health";
}

function forbiddenResponse(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Trusted proxy authentication required",
        code: "EDGE_AUTH_REQUIRED",
      },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export function proxy(request: NextRequest): NextResponse {
  if (process.env.NODE_ENV !== "production" || isHealthPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const header = request.headers.get(EDGE_AUTH_HEADER);
  if (!process.env.EDGE_SHARED_SECRET || header !== process.env.EDGE_SHARED_SECRET) {
    return forbiddenResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
