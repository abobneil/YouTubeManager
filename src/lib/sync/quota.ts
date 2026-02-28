export const QUOTA_COST = {
  channelsList: 1,
  playlistItemsList: 1,
  videosList: 1,
  playlistsInsert: 50,
  playlistItemsInsert: 50,
} as const;

export function estimateQuotaForVideos(videoCount: number): number {
  return videoCount * QUOTA_COST.playlistItemsInsert;
}
