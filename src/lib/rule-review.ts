import { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError, YouTubeApiError } from "@/lib/errors";
import { toManagedPlaylistDto, toRuleDto } from "@/lib/serializers";
import { insertionPositionForMode } from "@/lib/sync/ordering";
import type { RuleReviewItemDto, RuleReviewPageDto, RuleReviewState } from "@/lib/types";
import { getValidAccessToken } from "@/lib/token-store";
import { YouTubeClient } from "@/lib/youtube/client";

type ReviewVideoRecord = {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: Date;
  thumbnailUrl: string | null;
};

type MembershipRecord = {
  videoId: string;
  status: MembershipStatus;
  youtubePlaylistItemId: string | null;
  removedAt: Date | null;
};

type MutationFailure = {
  videoId: string;
  reason: string;
};

type MutationResult = {
  corrected?: string[];
  alreadyExcluded?: string[];
  restored?: string[];
  failed: MutationFailure[];
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push([...items.slice(index, index + size)]);
  }
  return chunks;
}

function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function createYouTubeClient(): Promise<YouTubeClient> {
  return new YouTubeClient(await getValidAccessToken());
}

async function ensureRuleForReview(ruleId: string) {
  const rule = await prisma.topicRule.findUnique({
    where: { id: ruleId },
    include: {
      managedPlaylist: true,
      ruleCreators: {
        select: { creatorId: true },
      },
    },
  });

  if (!rule) {
    throw new HttpError(404, "RULE_NOT_FOUND", "Rule not found");
  }

  return rule;
}

async function loadMatchedAtMap(ruleId: string, videoIds: string[]): Promise<Map<string, Date>> {
  if (videoIds.length === 0) {
    return new Map();
  }

  const matches = await prisma.videoMatch.findMany({
    where: {
      ruleId,
      videoId: {
        in: videoIds,
      },
    },
    select: {
      videoId: true,
      matchedAt: true,
    },
  });

  return new Map(matches.map((match) => [match.videoId, match.matchedAt]));
}

async function backfillVideoThumbnails(videos: ReviewVideoRecord[]): Promise<Map<string, string | null>> {
  const missingIds = videos.filter((video) => !video.thumbnailUrl).map((video) => video.id);
  if (missingIds.length === 0) {
    return new Map();
  }

  const client = await createYouTubeClient();
  const fetched = new Map<string, string | null>();

  for (const ids of chunk(missingIds, 50)) {
    const results = await client.listVideos(ids);
    for (const result of results) {
      fetched.set(result.id, result.thumbnailUrl);
    }
  }

  const updates = [...fetched.entries()]
    .filter(([, thumbnailUrl]) => thumbnailUrl)
    .map(([id, thumbnailUrl]) =>
      prisma.video.update({
        where: { id },
        data: { thumbnailUrl },
      }),
    );

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return fetched;
}

function toReviewItem(
  video: ReviewVideoRecord,
  matchedAt: Date | null,
  membership: MembershipRecord | null,
  excluded: boolean,
  thumbnailOverrides: Map<string, string | null>,
): RuleReviewItemDto {
  return {
    videoId: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt.toISOString(),
    thumbnailUrl: thumbnailOverrides.get(video.id) ?? video.thumbnailUrl,
    matchedAt: matchedAt?.toISOString() ?? null,
    membershipStatus: membership?.status ?? null,
    youtubePlaylistItemId: membership?.youtubePlaylistItemId ?? null,
    removedAt: membership?.removedAt?.toISOString() ?? null,
    excluded,
    videoUrl: buildVideoUrl(video.id),
  };
}

function isNotFoundRemoval(error: unknown): boolean {
  return (
    error instanceof YouTubeApiError &&
    (error.status === 404 ||
      error.reason === "playlistItemNotFound" ||
      error.reason === "videoNotFound")
  );
}

async function resolvePlaylistItemId(
  client: YouTubeClient,
  playlistId: string,
  videoId: string,
  storedItemId: string | null,
): Promise<string | null> {
  if (storedItemId) {
    return storedItemId;
  }
  return client.findPlaylistItemIdByVideoId(playlistId, videoId);
}

async function ensureMembershipContext(ruleId: string, videoIds: string[]) {
  const [matches, memberships, exclusions] = await Promise.all([
    prisma.videoMatch.findMany({
      where: {
        ruleId,
        videoId: {
          in: videoIds,
        },
      },
      select: {
        videoId: true,
      },
    }),
    prisma.playlistMembership.findMany({
      where: {
        ruleId,
        videoId: {
          in: videoIds,
        },
      },
      select: {
        videoId: true,
        status: true,
        youtubePlaylistItemId: true,
        removedAt: true,
      },
    }),
    prisma.ruleVideoExclusion.findMany({
      where: {
        ruleId,
        videoId: {
          in: videoIds,
        },
      },
      select: {
        videoId: true,
      },
    }),
  ]);

  return {
    matchedVideoIds: new Set(matches.map((item) => item.videoId)),
    memberships: new Map(
      memberships.map((membership) => [
        membership.videoId,
        {
          videoId: membership.videoId,
          status: membership.status,
          youtubePlaylistItemId: membership.youtubePlaylistItemId,
          removedAt: membership.removedAt,
        } satisfies MembershipRecord,
      ]),
    ),
    excludedVideoIds: new Set(exclusions.map((item) => item.videoId)),
  };
}

export async function getRuleReviewPage(
  ruleId: string,
  input: {
    state: RuleReviewState;
    page: number;
    pageSize: number;
  },
): Promise<RuleReviewPageDto> {
  const rule = await ensureRuleForReview(ruleId);
  const skip = (input.page - 1) * input.pageSize;

  if (input.state === "active") {
    const [total, memberships] = await Promise.all([
      prisma.playlistMembership.count({
        where: {
          ruleId,
          removedAt: null,
        },
      }),
      prisma.playlistMembership.findMany({
        where: {
          ruleId,
          removedAt: null,
        },
        orderBy: [
          {
            video: {
              publishedAt: "desc",
            },
          },
          {
            attemptedAt: "desc",
          },
        ],
        skip,
        take: input.pageSize,
        include: {
          video: {
            select: {
              id: true,
              title: true,
              channelTitle: true,
              publishedAt: true,
              thumbnailUrl: true,
            },
          },
        },
      }),
    ]);

    const matchedAtMap = await loadMatchedAtMap(ruleId, memberships.map((membership) => membership.videoId));
    const thumbnailMap = await backfillVideoThumbnails(
      memberships.map((membership) => membership.video),
    );

    return {
      rule: toRuleDto(rule),
      managedPlaylist: rule.managedPlaylist ? toManagedPlaylistDto(rule.managedPlaylist) : null,
      state: input.state,
      page: input.page,
      pageSize: input.pageSize,
      total,
      items: memberships.map((membership) =>
        toReviewItem(
          membership.video,
          matchedAtMap.get(membership.videoId) ?? null,
          {
            videoId: membership.videoId,
            status: membership.status,
            youtubePlaylistItemId: membership.youtubePlaylistItemId,
            removedAt: membership.removedAt,
          },
          false,
          thumbnailMap,
        ),
      ),
    };
  }

  const [total, exclusions] = await Promise.all([
    prisma.ruleVideoExclusion.count({
      where: { ruleId },
    }),
    prisma.ruleVideoExclusion.findMany({
      where: { ruleId },
      orderBy: { createdAt: "desc" },
      skip,
      take: input.pageSize,
      include: {
        video: {
          select: {
            id: true,
            title: true,
            channelTitle: true,
            publishedAt: true,
            thumbnailUrl: true,
          },
        },
      },
    }),
  ]);

  const videoIds = exclusions.map((exclusion) => exclusion.videoId);
  const [matchedAtMap, memberships, thumbnailMap] = await Promise.all([
    loadMatchedAtMap(ruleId, videoIds),
    prisma.playlistMembership.findMany({
      where: {
        ruleId,
        videoId: {
          in: videoIds,
        },
      },
      select: {
        videoId: true,
        status: true,
        youtubePlaylistItemId: true,
        removedAt: true,
      },
    }),
    backfillVideoThumbnails(exclusions.map((exclusion) => exclusion.video)),
  ]);

  const membershipMap = new Map(
    memberships.map((membership) => [
      membership.videoId,
      {
        videoId: membership.videoId,
        status: membership.status,
        youtubePlaylistItemId: membership.youtubePlaylistItemId,
        removedAt: membership.removedAt,
      } satisfies MembershipRecord,
    ]),
  );

  return {
    rule: toRuleDto(rule),
    managedPlaylist: rule.managedPlaylist ? toManagedPlaylistDto(rule.managedPlaylist) : null,
    state: input.state,
    page: input.page,
    pageSize: input.pageSize,
    total,
    items: exclusions.map((exclusion) =>
      toReviewItem(
        exclusion.video,
        matchedAtMap.get(exclusion.videoId) ?? null,
        membershipMap.get(exclusion.videoId) ?? null,
        true,
        thumbnailMap,
      ),
    ),
  };
}

export async function correctRuleVideos(ruleId: string, videoIds: string[]): Promise<MutationResult> {
  const rule = await ensureRuleForReview(ruleId);
  if (!rule.managedPlaylist) {
    throw new HttpError(400, "RULE_HAS_NO_PLAYLIST", "Rule does not have a managed playlist yet");
  }

  const context = await ensureMembershipContext(ruleId, videoIds);
  const client = await createYouTubeClient();
  const corrected: string[] = [];
  const alreadyExcluded: string[] = [];
  const failed: MutationFailure[] = [];

  for (const videoId of videoIds) {
    if (!context.matchedVideoIds.has(videoId) && !context.memberships.has(videoId)) {
      failed.push({ videoId, reason: "Video does not belong to this rule" });
      continue;
    }

    const membership = context.memberships.get(videoId) ?? null;
    const exclusionExists = context.excludedVideoIds.has(videoId);

    try {
      const playlistItemId = await resolvePlaylistItemId(
        client,
        rule.managedPlaylist.youtubePlaylistId,
        videoId,
        membership?.youtubePlaylistItemId ?? null,
      );

      if (!playlistItemId && exclusionExists && membership?.removedAt) {
        alreadyExcluded.push(videoId);
        continue;
      }

      if (playlistItemId) {
        try {
          await client.deletePlaylistItem(playlistItemId);
        } catch (error) {
          if (!isNotFoundRemoval(error)) {
            throw error;
          }
        }
      }

      await prisma.$transaction([
        prisma.ruleVideoExclusion.upsert({
          where: {
            ruleId_videoId: {
              ruleId,
              videoId,
            },
          },
          update: {},
          create: {
            ruleId,
            videoId,
          },
        }),
        prisma.playlistMembership.upsert({
          where: {
            ruleId_videoId: {
              ruleId,
              videoId,
            },
          },
          update: {
            youtubePlaylistItemId: playlistItemId ?? membership?.youtubePlaylistItemId ?? null,
            removedAt: new Date(),
            removalReason: "MANUAL_EXCLUSION",
            attemptedAt: new Date(),
          },
          create: {
            ruleId,
            videoId,
            youtubePlaylistItemId: playlistItemId,
            removedAt: new Date(),
            removalReason: "MANUAL_EXCLUSION",
          },
        }),
      ]);

      corrected.push(videoId);
    } catch (error) {
      failed.push({
        videoId,
        reason: error instanceof Error ? error.message : "Failed to remove playlist item",
      });
    }
  }

  return { corrected, alreadyExcluded, failed };
}

export async function restoreRuleVideos(ruleId: string, videoIds: string[]): Promise<MutationResult> {
  const rule = await ensureRuleForReview(ruleId);
  if (!rule.managedPlaylist) {
    throw new HttpError(400, "RULE_HAS_NO_PLAYLIST", "Rule does not have a managed playlist yet");
  }

  const context = await ensureMembershipContext(ruleId, videoIds);
  const client = await createYouTubeClient();
  const restored: string[] = [];
  const failed: MutationFailure[] = [];

  for (const videoId of videoIds) {
    if (!context.excludedVideoIds.has(videoId)) {
      failed.push({ videoId, reason: "Video is not manually excluded for this rule" });
      continue;
    }

    try {
      let playlistItemId: string | null = null;

      try {
        const inserted = await client.addPlaylistItem(
          rule.managedPlaylist.youtubePlaylistId,
          videoId,
          insertionPositionForMode(rule.orderMode),
        );
        playlistItemId = inserted.itemId;
      } catch (error) {
        if (error instanceof YouTubeApiError && error.reason === "manualSortRequired") {
          const inserted = await client.addPlaylistItem(rule.managedPlaylist.youtubePlaylistId, videoId);
          playlistItemId = inserted.itemId;
        } else if (error instanceof YouTubeApiError && error.reason === "videoAlreadyInPlaylist") {
          playlistItemId = await client.findPlaylistItemIdByVideoId(rule.managedPlaylist.youtubePlaylistId, videoId);
        } else {
          throw error;
        }
      }

      await prisma.$transaction([
        prisma.ruleVideoExclusion.delete({
          where: {
            ruleId_videoId: {
              ruleId,
              videoId,
            },
          },
        }),
        prisma.playlistMembership.upsert({
          where: {
            ruleId_videoId: {
              ruleId,
              videoId,
            },
          },
          update: {
            status: MembershipStatus.INSERTED,
            youtubePlaylistItemId: playlistItemId,
            errorCode: null,
            removedAt: null,
            removalReason: null,
            attemptedAt: new Date(),
          },
          create: {
            ruleId,
            videoId,
            status: MembershipStatus.INSERTED,
            youtubePlaylistItemId: playlistItemId,
          },
        }),
      ]);

      restored.push(videoId);
    } catch (error) {
      failed.push({
        videoId,
        reason: error instanceof Error ? error.message : "Failed to restore playlist item",
      });
    }
  }

  return { restored, failed };
}
