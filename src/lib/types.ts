import type { MatchFields, OrderMode, PrivacyStatus, SyncRunStatus, SyncTrigger } from "@prisma/client";

export type CreatorDto = {
  id: string;
  channelId: string;
  displayName: string;
  uploadsPlaylistId: string | null;
  active: boolean;
  lastCheckedAt: string | null;
  lastSeenPublishedAt: string | null;
};

export type TopicRuleDto = {
  id: string;
  name: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  matchFields: MatchFields;
  caseSensitive: boolean;
  orderMode: OrderMode;
  privacyStatus: PrivacyStatus;
  active: boolean;
  creatorScopeIds: string[];
};

export type SyncRunDto = {
  id: string;
  trigger: SyncTrigger;
  status: SyncRunStatus;
  startedAt: string;
  endedAt: string | null;
  stats: unknown;
  errorSummary: string | null;
  quotaEstimated: number;
  quotaConsumed: number;
};

export type MatchResult = {
  videoId: string;
  matchedRuleIds: string[];
};
