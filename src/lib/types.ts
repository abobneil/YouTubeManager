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

export type ManagedPlaylistDto = {
  id: string;
  youtubePlaylistId: string;
  title: string;
  privacyStatus: PrivacyStatus;
};

export type RuleReviewState = "active" | "excluded";

export type RuleReviewItemDto = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  matchedAt: string | null;
  membershipStatus: string | null;
  youtubePlaylistItemId: string | null;
  removedAt: string | null;
  excluded: boolean;
  videoUrl: string;
};

export type RuleReviewPageDto = {
  rule: TopicRuleDto;
  managedPlaylist: ManagedPlaylistDto | null;
  state: RuleReviewState;
  page: number;
  pageSize: number;
  total: number;
  items: RuleReviewItemDto[];
};

export type SubscriptionChannelDto = {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  alreadyAdded: boolean;
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
