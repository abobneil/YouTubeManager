import {
  MembershipStatus,
  OrderMode,
  Prisma,
  SyncEventLevel,
  SyncRequestStatus,
  SyncRunStatus,
  SyncTrigger,
} from "@prisma/client";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";
import { YouTubeApiError, isQuotaError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getValidAccessToken } from "@/lib/token-store";
import { getMatchedRuleIds, RuleForMatching } from "@/lib/sync/matcher";
import { acquireSyncLock, releaseSyncLock } from "@/lib/sync/advisory-lock";
import { insertionPositionForMode, sortForInsertion } from "@/lib/sync/ordering";
import { QUOTA_COST } from "@/lib/sync/quota";
import { YouTubeClient } from "@/lib/youtube/client";

type SyncStats = {
  creatorsProcessed: number;
  videosScanned: number;
  videosMatched: number;
  playlistItemsInserted: number;
  playlistItemsDuplicate: number;
  playlistItemsErrored: number;
};

type RunState = {
  stats: SyncStats;
  quotaEstimated: number;
  quotaConsumed: number;
  partial: boolean;
  partialReason?: string;
};

function emptyStats(): SyncStats {
  return {
    creatorsProcessed: 0,
    videosScanned: 0,
    videosMatched: 0,
    playlistItemsInserted: 0,
    playlistItemsDuplicate: 0,
    playlistItemsErrored: 0,
  };
}

function chunk<T>(items: T[], size: number): T[][];
function chunk<T>(items: readonly T[], size: number): T[][];
function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push([...items.slice(index, index + size)]);
  }
  return chunks;
}

async function addRunEvent(
  runId: string,
  level: SyncEventLevel,
  code: string,
  message: string,
  context?: Prisma.JsonValue,
): Promise<void> {
  const normalizedContext =
    context === undefined
      ? undefined
      : context === null
        ? Prisma.JsonNull
        : (context as Prisma.InputJsonValue);

  await prisma.syncRunEvent.create({
    data: {
      runId,
      level,
      code,
      message,
      context: normalizedContext,
    },
  });
}

async function getSyncSettings(): Promise<{
  softQuotaLimit: number;
  pageLimit: number;
}> {
  const [softQuotaRaw, pageLimitRaw] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "sync_soft_quota_limit" } }),
    prisma.appSetting.findUnique({ where: { key: "sync_page_limit" } }),
  ]);
  const softQuotaLimit = Number(softQuotaRaw?.value ?? env.SYNC_SOFT_QUOTA_LIMIT);
  const pageLimit = Number(pageLimitRaw?.value ?? env.SYNC_PAGE_LIMIT);
  return {
    softQuotaLimit: Number.isFinite(softQuotaLimit) ? softQuotaLimit : env.SYNC_SOFT_QUOTA_LIMIT,
    pageLimit: Number.isFinite(pageLimit) ? pageLimit : env.SYNC_PAGE_LIMIT,
  };
}

async function getRuleModels(): Promise<RuleForMatching[]> {
  const rules = await prisma.topicRule.findMany({
    where: { active: true },
    include: {
      ruleCreators: {
        select: { creatorId: true },
      },
    },
  });
  return rules.map((rule) => ({
    id: rule.id,
    includeKeywords: rule.includeKeywords,
    excludeKeywords: rule.excludeKeywords,
    matchFields: rule.matchFields,
    caseSensitive: rule.caseSensitive,
    active: rule.active,
    creatorScopeIds: rule.ruleCreators.map((item) => item.creatorId),
  }));
}

async function ensureManagedPlaylist(
  runId: string,
  client: YouTubeClient,
  ruleId: string,
  state: RunState,
  softQuotaLimit: number,
): Promise<{ playlistId: string; orderMode: OrderMode }> {
  const rule = await prisma.topicRule.findUnique({
    where: { id: ruleId },
    include: { managedPlaylist: true },
  });
  if (!rule) {
    throw new Error(`Rule ${ruleId} not found`);
  }

  if (rule.managedPlaylist) {
    return {
      playlistId: rule.managedPlaylist.youtubePlaylistId,
      orderMode: rule.orderMode,
    };
  }

  state.quotaEstimated += QUOTA_COST.playlistsInsert;
  if (state.quotaEstimated > softQuotaLimit) {
    state.partial = true;
    state.partialReason = "Soft quota limit reached before creating playlist";
    await addRunEvent(
      runId,
      SyncEventLevel.WARNING,
      "SOFT_QUOTA_LIMIT",
      state.partialReason,
      { ruleId },
    );
    throw new Error(state.partialReason);
  }

  const playlistId = await client.createPlaylist(rule.name, rule.privacyStatus);
  state.quotaConsumed += QUOTA_COST.playlistsInsert;
  await prisma.managedPlaylist.create({
    data: {
      ruleId: rule.id,
      youtubePlaylistId: playlistId,
      title: rule.name,
      privacyStatus: rule.privacyStatus,
    },
  });
  await addRunEvent(runId, SyncEventLevel.INFO, "PLAYLIST_CREATED", "Managed playlist created", {
    ruleId,
    playlistId,
  });

  return {
    playlistId,
    orderMode: rule.orderMode,
  };
}

async function resolveCreatorUploadsPlaylist(
  runId: string,
  client: YouTubeClient,
  creator: {
    id: string;
    channelId: string;
    uploadsPlaylistId: string | null;
  },
  state: RunState,
): Promise<string> {
  if (creator.uploadsPlaylistId) {
    return creator.uploadsPlaylistId;
  }
  state.quotaEstimated += QUOTA_COST.channelsList;
  const channel = await client.getChannelById(creator.channelId);
  await prisma.creator.update({
    where: { id: creator.id },
    data: { uploadsPlaylistId: channel.uploadsPlaylistId },
  });
  await addRunEvent(runId, SyncEventLevel.INFO, "CREATOR_UPLOADS_RESOLVED", "Uploads playlist resolved", {
    creatorId: creator.id,
    uploadsPlaylistId: channel.uploadsPlaylistId,
  });
  return channel.uploadsPlaylistId;
}

async function listNewUploadsForCreator(
  runId: string,
  client: YouTubeClient,
  creator: {
    id: string;
    uploadsPlaylistId: string;
    lastSeenPublishedAt: Date | null;
  },
  pageLimit: number,
  state: RunState,
): Promise<{
  newestPublishedAt: Date | null;
  videoIds: string[];
}> {
  const videoIds: string[] = [];
  let nextPageToken: string | undefined = undefined;
  let pages = 0;
  let stop = false;
  let newestPublishedAt: Date | null = creator.lastSeenPublishedAt ?? null;

  while (!stop && pages < pageLimit) {
    pages += 1;
    state.quotaEstimated += QUOTA_COST.playlistItemsList;
    const page = await client.listUploads(creator.uploadsPlaylistId, nextPageToken);
    for (const item of page.items) {
      const publishedAt = new Date(item.publishedAt);
      if (creator.lastSeenPublishedAt && publishedAt <= creator.lastSeenPublishedAt) {
        stop = true;
        break;
      }
      if (!newestPublishedAt || publishedAt > newestPublishedAt) {
        newestPublishedAt = publishedAt;
      }
      videoIds.push(item.videoId);
    }
    if (!page.nextPageToken || stop) {
      break;
    }
    nextPageToken = page.nextPageToken;
  }

  await addRunEvent(
    runId,
    SyncEventLevel.INFO,
    "UPLOADS_SCANNED",
    "Scanned uploads playlist for creator",
    {
      creatorId: creator.id,
      pagesScanned: pages,
      newVideoCount: videoIds.length,
    },
  );

  return {
    newestPublishedAt,
    videoIds,
  };
}

async function markRunComplete(
  runId: string,
  status: SyncRunStatus,
  state: RunState,
  errorSummary?: string,
): Promise<void> {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status,
      endedAt: new Date(),
      stats: state.stats as Prisma.JsonObject,
      quotaEstimated: state.quotaEstimated,
      quotaConsumed: state.quotaConsumed,
      errorSummary: errorSummary ?? null,
    },
  });
}

export async function enqueueManualSync(): Promise<{ requestId: string }> {
  const request = await prisma.syncRequest.create({
    data: {
      trigger: SyncTrigger.MANUAL,
      status: SyncRequestStatus.PENDING,
    },
  });
  return { requestId: request.id };
}

export async function claimNextManualRequest(): Promise<{ id: string } | null> {
  return prisma.$transaction(async (tx) => {
    const next = await tx.syncRequest.findFirst({
      where: { status: SyncRequestStatus.PENDING },
      orderBy: { requestedAt: "asc" },
    });
    if (!next) {
      return null;
    }
    const updated = await tx.syncRequest.update({
      where: { id: next.id },
      data: {
        status: SyncRequestStatus.PROCESSING,
        pickedAt: new Date(),
      },
      select: { id: true },
    });
    return updated;
  });
}

export async function runSync(trigger: SyncTrigger, requestId?: string): Promise<{ runId: string }> {
  const state: RunState = {
    stats: emptyStats(),
    quotaEstimated: 0,
    quotaConsumed: 0,
    partial: false,
  };

  const lock = await acquireSyncLock();
  if (!lock.acquired) {
    const skippedRun = await prisma.syncRun.create({
      data: {
        trigger,
        status: SyncRunStatus.SKIPPED_CONCURRENT,
        requestId,
        startedAt: new Date(),
        endedAt: new Date(),
        stats: state.stats as Prisma.JsonObject,
      },
      select: { id: true },
    });
    if (requestId) {
      await prisma.syncRequest.update({
        where: { id: requestId },
        data: {
          status: SyncRequestStatus.DONE,
          completedAt: new Date(),
        },
      });
    }
    return { runId: skippedRun.id };
  }

  const run = await prisma.syncRun.create({
    data: {
      trigger,
      status: SyncRunStatus.RUNNING,
      requestId,
    },
    select: { id: true },
  });

  try {
    const { softQuotaLimit, pageLimit } = await getSyncSettings();
    const accessToken = await getValidAccessToken();
    const client = new YouTubeClient(accessToken);
    const [creators, rules] = await Promise.all([
      prisma.creator.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          channelId: true,
          uploadsPlaylistId: true,
          lastSeenPublishedAt: true,
        },
      }),
      getRuleModels(),
    ]);

    await addRunEvent(run.id, SyncEventLevel.INFO, "RUN_STARTED", "Sync run started", {
      creatorCount: creators.length,
      ruleCount: rules.length,
      trigger,
    });

    for (const creator of creators) {
      if (state.partial) {
        break;
      }

      let newestPublishedAt = creator.lastSeenPublishedAt;
      try {
        const uploadsPlaylistId = await resolveCreatorUploadsPlaylist(run.id, client, creator, state);
        const scan = await listNewUploadsForCreator(
          run.id,
          client,
          {
            id: creator.id,
            uploadsPlaylistId,
            lastSeenPublishedAt: creator.lastSeenPublishedAt,
          },
          pageLimit,
          state,
        );
        newestPublishedAt = scan.newestPublishedAt;

        if (scan.videoIds.length === 0) {
          state.stats.creatorsProcessed += 1;
          await prisma.creator.update({
            where: { id: creator.id },
            data: { lastCheckedAt: new Date() },
          });
          continue;
        }

        const videos = [];
        for (const ids of chunk(scan.videoIds, 50)) {
          state.quotaEstimated += QUOTA_COST.videosList;
          videos.push(...(await client.listVideos(ids)));
        }

        state.stats.videosScanned += videos.length;

        for (const video of videos) {
          await prisma.video.upsert({
            where: { id: video.id },
            update: {
              title: video.title,
              description: video.description,
              publishedAt: new Date(video.publishedAt),
              channelId: video.channelId,
              channelTitle: video.channelTitle,
              discoveredFromCreatorId: creator.id,
            },
            create: {
              id: video.id,
              title: video.title,
              description: video.description,
              publishedAt: new Date(video.publishedAt),
              channelId: video.channelId,
              channelTitle: video.channelTitle,
              discoveredFromCreatorId: creator.id,
            },
          });
        }

        for (const video of videos) {
          const matchedRuleIds = getMatchedRuleIds(
            {
              id: video.id,
              title: video.title,
              description: video.description,
              creatorId: creator.id,
            },
            rules,
          );

          if (matchedRuleIds.length === 0) {
            continue;
          }
          state.stats.videosMatched += 1;

          for (const ruleId of matchedRuleIds) {
            await prisma.videoMatch.upsert({
              where: {
                ruleId_videoId: {
                  ruleId,
                  videoId: video.id,
                },
              },
              update: {
                matchedAt: new Date(),
              },
              create: {
                ruleId,
                videoId: video.id,
              },
            });
          }
        }

        const videosByRule = new Map<string, Array<{ id: string; publishedAt: Date }>>();
        for (const video of videos) {
          const matchedRuleIds = getMatchedRuleIds(
            {
              id: video.id,
              title: video.title,
              description: video.description,
              creatorId: creator.id,
            },
            rules,
          );
          for (const ruleId of matchedRuleIds) {
            if (!videosByRule.has(ruleId)) {
              videosByRule.set(ruleId, []);
            }
            videosByRule.get(ruleId)?.push({
              id: video.id,
              publishedAt: new Date(video.publishedAt),
            });
          }
        }

        for (const [ruleId, matchedVideos] of videosByRule) {
          if (state.partial) {
            break;
          }
          const existingMemberships = await prisma.playlistMembership.findMany({
            where: {
              ruleId,
              videoId: {
                in: matchedVideos.map((video) => video.id),
              },
            },
            select: { videoId: true },
          });
          const existingVideoIds = new Set(existingMemberships.map((item) => item.videoId));
          const filtered = matchedVideos.filter((video) => !existingVideoIds.has(video.id));
          if (filtered.length === 0) {
            continue;
          }

          const playlist = await ensureManagedPlaylist(run.id, client, ruleId, state, softQuotaLimit);
          const ordered = sortForInsertion(filtered, playlist.orderMode);
          for (const candidate of ordered) {
            if (state.partial) {
              break;
            }

            const projected = state.quotaEstimated + QUOTA_COST.playlistItemsInsert;
            if (projected > softQuotaLimit) {
              state.partial = true;
              state.partialReason = "Soft quota limit reached while inserting playlist items";
              await addRunEvent(
                run.id,
                SyncEventLevel.WARNING,
                "SOFT_QUOTA_LIMIT",
                state.partialReason,
                { ruleId },
              );
              break;
            }
            state.quotaEstimated = projected;

            const position = insertionPositionForMode(playlist.orderMode);
            try {
              const inserted = await client.addPlaylistItem(playlist.playlistId, candidate.id, position);
              state.quotaConsumed += QUOTA_COST.playlistItemsInsert;
              state.stats.playlistItemsInserted += 1;
              await prisma.playlistMembership.create({
                data: {
                  ruleId,
                  videoId: candidate.id,
                  runId: run.id,
                  status: MembershipStatus.INSERTED,
                  youtubePlaylistItemId: inserted.itemId,
                },
              });
            } catch (error) {
              if (error instanceof YouTubeApiError && error.reason === "videoAlreadyInPlaylist") {
                state.stats.playlistItemsDuplicate += 1;
                await prisma.playlistMembership.upsert({
                  where: {
                    ruleId_videoId: { ruleId, videoId: candidate.id },
                  },
                  update: {
                    runId: run.id,
                    status: MembershipStatus.DUPLICATE,
                    errorCode: "videoAlreadyInPlaylist",
                    attemptedAt: new Date(),
                  },
                  create: {
                    ruleId,
                    videoId: candidate.id,
                    runId: run.id,
                    status: MembershipStatus.DUPLICATE,
                    errorCode: "videoAlreadyInPlaylist",
                  },
                });
                continue;
              }

              if (
                error instanceof YouTubeApiError &&
                error.reason === "manualSortRequired" &&
                typeof position === "number"
              ) {
                try {
                  const fallback = await client.addPlaylistItem(playlist.playlistId, candidate.id);
                  state.quotaConsumed += QUOTA_COST.playlistItemsInsert;
                  state.stats.playlistItemsInserted += 1;
                  await prisma.playlistMembership.create({
                    data: {
                      ruleId,
                      videoId: candidate.id,
                      runId: run.id,
                      status: MembershipStatus.INSERTED,
                      youtubePlaylistItemId: fallback.itemId,
                      errorCode: "manualSortRequired",
                    },
                  });
                  await addRunEvent(
                    run.id,
                    SyncEventLevel.WARNING,
                    "MANUAL_SORT_REQUIRED",
                    "Positioned insert failed; retried without position",
                    { ruleId, videoId: candidate.id },
                  );
                  continue;
                } catch (fallbackError) {
                  error = fallbackError;
                }
              }

              if (error instanceof YouTubeApiError && isQuotaError(error.reason)) {
                state.partial = true;
                state.partialReason = error.message;
                await addRunEvent(
                  run.id,
                  SyncEventLevel.WARNING,
                  "YOUTUBE_QUOTA",
                  "YouTube quota/rate limit hit. Marking run partial.",
                  { reason: error.reason, ruleId, videoId: candidate.id },
                );
                break;
              }

              state.stats.playlistItemsErrored += 1;
              await prisma.playlistMembership.upsert({
                where: {
                  ruleId_videoId: { ruleId, videoId: candidate.id },
                },
                update: {
                  runId: run.id,
                  status: MembershipStatus.ERROR,
                  errorCode: error instanceof YouTubeApiError ? error.reason : "unknown",
                  attemptedAt: new Date(),
                },
                create: {
                  ruleId,
                  videoId: candidate.id,
                  runId: run.id,
                  status: MembershipStatus.ERROR,
                  errorCode: error instanceof YouTubeApiError ? error.reason : "unknown",
                },
              });
              await addRunEvent(
                run.id,
                SyncEventLevel.ERROR,
                "PLAYLIST_INSERT_FAILED",
                "Failed to insert playlist item",
                {
                  ruleId,
                  videoId: candidate.id,
                  reason: error instanceof YouTubeApiError ? error.reason : "unknown",
                },
              );
            }
          }
        }

        state.stats.creatorsProcessed += 1;
        await prisma.creator.update({
          where: { id: creator.id },
          data: {
            lastCheckedAt: new Date(),
            lastSeenPublishedAt: newestPublishedAt,
          },
        });
      } catch (error) {
        logger.error({ error, creatorId: creator.id }, "Creator sync failed");
        await addRunEvent(run.id, SyncEventLevel.ERROR, "CREATOR_SYNC_FAILED", "Creator sync failed", {
          creatorId: creator.id,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const finalStatus = state.partial ? SyncRunStatus.PARTIAL : SyncRunStatus.SUCCEEDED;
    await markRunComplete(run.id, finalStatus, state, state.partialReason);

    if (requestId) {
      await prisma.syncRequest.update({
        where: { id: requestId },
        data: {
          status: SyncRequestStatus.DONE,
          completedAt: new Date(),
        },
      });
    }
    return { runId: run.id };
  } catch (error) {
    await markRunComplete(
      run.id,
      SyncRunStatus.FAILED,
      state,
      error instanceof Error ? error.message : "Unexpected error",
    );
    if (requestId) {
      await prisma.syncRequest.update({
        where: { id: requestId },
        data: {
          status: SyncRequestStatus.FAILED,
          completedAt: new Date(),
        },
      });
    }
    throw error;
  } finally {
    await releaseSyncLock(lock);
  }
}
