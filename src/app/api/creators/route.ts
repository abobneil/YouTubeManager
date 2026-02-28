import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { parseChannelInput } from "@/lib/channel";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { errorResponse, parseJson } from "@/lib/http";
import { toCreatorDto } from "@/lib/serializers";
import { getValidAccessToken } from "@/lib/token-store";
import { creatorCreateSchema } from "@/lib/validators";
import { YouTubeClient } from "@/lib/youtube/client";

export async function GET(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  const creators = await prisma.creator.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ creators: creators.map(toCreatorDto) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }
  try {
    const payload = await parseJson(request, creatorCreateSchema);
    const lookup = parseChannelInput(payload.input);
    const accessToken = await getValidAccessToken();
    const client = new YouTubeClient(accessToken);

    const channel =
      lookup.type === "channelId"
        ? await client.getChannelById(lookup.value)
        : await client.getChannelByHandle(lookup.value);

    const creator = await prisma.creator.create({
      data: {
        channelId: channel.channelId,
        displayName: payload.displayName ?? channel.title,
        uploadsPlaylistId: channel.uploadsPlaylistId,
        active: payload.active,
      },
    });
    return NextResponse.json({ creator: toCreatorDto(creator) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Creator already exists" }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("Provide a valid YouTube")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({ error: "Invalid creator payload" }, { status: 400 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid creator payload" }, { status: 400 });
    }
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return errorResponse(error);
  }
}
