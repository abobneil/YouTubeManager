import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { getValidAccessToken } from "@/lib/token-store";
import { YouTubeClient } from "@/lib/youtube/client";

const MAX_SUBSCRIPTION_PAGES = 20;

export async function GET(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }

  try {
    const accessToken = await getValidAccessToken();
    const client = new YouTubeClient(accessToken);

    const collected = new Map<
      string,
      { channelId: string; title: string; thumbnailUrl: string | null }
    >();

    let pageToken: string | undefined = undefined;
    let pages = 0;

    while (pages < MAX_SUBSCRIPTION_PAGES) {
      pages += 1;
      const page = await client.listSubscriptions(pageToken);
      for (const item of page.items) {
        if (!collected.has(item.channelId)) {
          collected.set(item.channelId, item);
        }
      }
      if (!page.nextPageToken) {
        pageToken = undefined;
        break;
      }
      pageToken = page.nextPageToken;
    }

    const channelIds = [...collected.keys()];
    const existing = channelIds.length
      ? await prisma.creator.findMany({
          where: {
            channelId: {
              in: channelIds,
            },
          },
          select: {
            channelId: true,
          },
        })
      : [];

    const existingSet = new Set(existing.map((item) => item.channelId));
    const subscriptions = [...collected.values()]
      .map((item) => ({
        ...item,
        alreadyAdded: existingSet.has(item.channelId),
      }))
      .sort((left, right) => left.title.localeCompare(right.title));

    return NextResponse.json({
      subscriptions,
      truncated: Boolean(pageToken),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
