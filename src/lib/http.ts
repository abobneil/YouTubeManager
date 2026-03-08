import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { HttpError, YouTubeApiError } from "@/lib/errors";
import { withNoStore } from "@/lib/security";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return withNoStore(NextResponse.json(
      { error: "Validation failed", issues: error.issues.map((issue) => issue.message) },
      { status: 400 },
    ));
  }
  if (error instanceof HttpError) {
    return withNoStore(
      NextResponse.json({ error: error.message, code: error.code }, { status: error.status }),
    );
  }
  if (error instanceof YouTubeApiError) {
    return withNoStore(NextResponse.json(
      {
        error: error.message,
        code: "YOUTUBE_API_ERROR",
        reason: error.reason,
      },
      { status: error.status },
    ));
  }
  if (error instanceof Error) {
    return withNoStore(NextResponse.json({ error: error.message }, { status: 500 }));
  }
  return withNoStore(NextResponse.json({ error: "Unexpected error" }, { status: 500 }));
}
