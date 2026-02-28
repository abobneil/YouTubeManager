import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, parseJson } from "@/lib/http";
import { toCreatorDto } from "@/lib/serializers";
import { getValidAccessToken } from "@/lib/token-store";
import { creatorImportSubscriptionsSchema } from "@/lib/validators";
import { YouTubeClient } from "@/lib/youtube/client";

export async function POST(request: Request): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }

  try {
    const payload = await parseJson(request, creatorImportSubscriptionsSchema);
    const existingCreators = await prisma.creator.findMany({
      where: {
        channelId: {
          in: payload.channelIds,
        },
      },
      select: {
        channelId: true,
      },
    });

    const existingSet = new Set(existingCreators.map((item) => item.channelId));
    const accessToken = await getValidAccessToken();
    const client = new YouTubeClient(accessToken);

    const imported = [];
    const skipped: Array<{ channelId: string; reason: string }> = [];
    const failed: Array<{ channelId: string; reason: string }> = [];

    for (const channelId of payload.channelIds) {
      if (existingSet.has(channelId)) {
        skipped.push({ channelId, reason: "Already added" });
        continue;
      }

      try {
        const channel = await client.getChannelById(channelId);
        const created = await prisma.creator.create({
          data: {
            channelId: channel.channelId,
            displayName: channel.title,
            uploadsPlaylistId: channel.uploadsPlaylistId,
            active: payload.active,
          },
        });
        imported.push(toCreatorDto(created));
        existingSet.add(channel.channelId);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          skipped.push({ channelId, reason: "Already added" });
          continue;
        }
        failed.push({
          channelId,
          reason: error instanceof Error ? error.message : "Unknown import error",
        });
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      failed,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
