import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { HttpError, YouTubeApiError } from "@/lib/errors";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof YouTubeApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "YOUTUBE_API_ERROR",
        reason: error.reason,
      },
      { status: error.status },
    );
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
