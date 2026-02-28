import type { Creator, SyncRun, TopicRule } from "@prisma/client";
import type { CreatorDto, SyncRunDto, TopicRuleDto } from "@/lib/types";

export function toCreatorDto(creator: Creator): CreatorDto {
  return {
    id: creator.id,
    channelId: creator.channelId,
    displayName: creator.displayName,
    uploadsPlaylistId: creator.uploadsPlaylistId,
    active: creator.active,
    lastCheckedAt: creator.lastCheckedAt?.toISOString() ?? null,
    lastSeenPublishedAt: creator.lastSeenPublishedAt?.toISOString() ?? null,
  };
}

export function toRuleDto(
  rule: TopicRule & { ruleCreators: Array<{ creatorId: string }> },
): TopicRuleDto {
  return {
    id: rule.id,
    name: rule.name,
    includeKeywords: rule.includeKeywords,
    excludeKeywords: rule.excludeKeywords,
    matchFields: rule.matchFields,
    caseSensitive: rule.caseSensitive,
    orderMode: rule.orderMode,
    privacyStatus: rule.privacyStatus,
    active: rule.active,
    creatorScopeIds: rule.ruleCreators.map((scope) => scope.creatorId),
  };
}

export function toSyncRunDto(run: SyncRun): SyncRunDto {
  return {
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    stats: run.stats,
    errorSummary: run.errorSummary,
    quotaEstimated: run.quotaEstimated,
    quotaConsumed: run.quotaConsumed,
  };
}
