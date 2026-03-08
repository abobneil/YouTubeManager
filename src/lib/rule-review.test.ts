import { MembershipStatus, OrderMode, PrivacyStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  topicRule: {
    findUnique: vi.fn(),
  },
  playlistMembership: {
    count: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  videoMatch: {
    findMany: vi.fn(),
  },
  ruleVideoExclusion: {
    count: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  video: {
    update: vi.fn(),
  },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
};

const clientMock = {
  listVideos: vi.fn(),
  findPlaylistItemIdByVideoId: vi.fn(),
  deletePlaylistItem: vi.fn(),
  addPlaylistItem: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/token-store", () => ({
  getValidAccessToken: vi.fn(async () => "token"),
}));

vi.mock("@/lib/youtube/client", () => ({
  YouTubeClient: vi.fn().mockImplementation(function MockYouTubeClient() {
    return clientMock;
  }),
}));

describe("rule review workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
  });

  it("backfills thumbnails when review items are missing them", async () => {
    prismaMock.topicRule.findUnique.mockResolvedValue({
      id: "rule-1",
      name: "Rule",
      includeKeywords: ["StarCraft"],
      excludeKeywords: [],
      matchFields: "BOTH",
      caseSensitive: false,
      orderMode: OrderMode.NEWEST,
      privacyStatus: PrivacyStatus.PRIVATE,
      active: true,
      ruleCreators: [],
      managedPlaylist: {
        id: "playlist-1",
        youtubePlaylistId: "youtube-playlist-1",
        title: "Rule",
        privacyStatus: PrivacyStatus.PRIVATE,
      },
    });
    prismaMock.playlistMembership.count.mockResolvedValue(1);
    prismaMock.playlistMembership.findMany.mockResolvedValue([
      {
        videoId: "video-1",
        status: MembershipStatus.INSERTED,
        youtubePlaylistItemId: "item-1",
        removedAt: null,
        video: {
          id: "video-1",
          title: "Episode 1",
          channelTitle: "Creator",
          publishedAt: new Date("2025-01-01T00:00:00Z"),
          thumbnailUrl: null,
        },
      },
    ]);
    prismaMock.videoMatch.findMany.mockResolvedValue([
      {
        videoId: "video-1",
        matchedAt: new Date("2025-01-02T00:00:00Z"),
      },
    ]);
    clientMock.listVideos.mockResolvedValue([
      {
        id: "video-1",
        title: "Episode 1",
        description: "",
        channelId: "channel-1",
        channelTitle: "Creator",
        publishedAt: "2025-01-01T00:00:00Z",
        thumbnailUrl: "https://thumb.example/video-1.jpg",
      },
    ]);
    prismaMock.video.update.mockResolvedValue({});

    const { getRuleReviewPage } = await import("@/lib/rule-review");
    const page = await getRuleReviewPage("rule-1", {
      state: "active",
      page: 1,
      pageSize: 50,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].thumbnailUrl).toBe("https://thumb.example/video-1.jpg");
    expect(prismaMock.video.update).toHaveBeenCalledWith({
      where: { id: "video-1" },
      data: { thumbnailUrl: "https://thumb.example/video-1.jpg" },
    });
  });

  it("corrects a matched video by resolving and deleting the playlist item", async () => {
    prismaMock.topicRule.findUnique.mockResolvedValue({
      id: "rule-1",
      name: "Rule",
      includeKeywords: ["StarCraft"],
      excludeKeywords: [],
      matchFields: "BOTH",
      caseSensitive: false,
      orderMode: OrderMode.NEWEST,
      privacyStatus: PrivacyStatus.PRIVATE,
      active: true,
      ruleCreators: [],
      managedPlaylist: {
        id: "playlist-1",
        youtubePlaylistId: "youtube-playlist-1",
        title: "Rule",
        privacyStatus: PrivacyStatus.PRIVATE,
      },
    });
    prismaMock.videoMatch.findMany.mockResolvedValue([{ videoId: "video-1" }]);
    prismaMock.playlistMembership.findMany.mockResolvedValue([
      {
        videoId: "video-1",
        status: MembershipStatus.DUPLICATE,
        youtubePlaylistItemId: null,
        removedAt: null,
      },
    ]);
    prismaMock.ruleVideoExclusion.findMany.mockResolvedValue([]);
    prismaMock.ruleVideoExclusion.upsert.mockResolvedValue({});
    prismaMock.playlistMembership.upsert.mockResolvedValue({});
    clientMock.findPlaylistItemIdByVideoId.mockResolvedValue("item-9");
    clientMock.deletePlaylistItem.mockResolvedValue(undefined);

    const { correctRuleVideos } = await import("@/lib/rule-review");
    const result = await correctRuleVideos("rule-1", ["video-1"]);

    expect(result).toEqual({
      corrected: ["video-1"],
      alreadyExcluded: [],
      failed: [],
    });
    expect(clientMock.findPlaylistItemIdByVideoId).toHaveBeenCalledWith("youtube-playlist-1", "video-1");
    expect(clientMock.deletePlaylistItem).toHaveBeenCalledWith("item-9");
    expect(prismaMock.ruleVideoExclusion.upsert).toHaveBeenCalled();
    expect(prismaMock.playlistMembership.upsert).toHaveBeenCalled();
  });

  it("restores an excluded video back into the managed playlist", async () => {
    prismaMock.topicRule.findUnique.mockResolvedValue({
      id: "rule-1",
      name: "Rule",
      includeKeywords: ["StarCraft"],
      excludeKeywords: [],
      matchFields: "BOTH",
      caseSensitive: false,
      orderMode: OrderMode.NEWEST,
      privacyStatus: PrivacyStatus.PRIVATE,
      active: true,
      ruleCreators: [],
      managedPlaylist: {
        id: "playlist-1",
        youtubePlaylistId: "youtube-playlist-1",
        title: "Rule",
        privacyStatus: PrivacyStatus.PRIVATE,
      },
    });
    prismaMock.videoMatch.findMany.mockResolvedValue([]);
    prismaMock.playlistMembership.findMany.mockResolvedValue([
      {
        videoId: "video-1",
        status: MembershipStatus.INSERTED,
        youtubePlaylistItemId: "old-item",
        removedAt: new Date("2025-01-03T00:00:00Z"),
      },
    ]);
    prismaMock.ruleVideoExclusion.findMany.mockResolvedValue([{ videoId: "video-1" }]);
    prismaMock.ruleVideoExclusion.delete.mockResolvedValue({});
    prismaMock.playlistMembership.upsert.mockResolvedValue({});
    clientMock.addPlaylistItem.mockResolvedValue({ itemId: "new-item" });

    const { restoreRuleVideos } = await import("@/lib/rule-review");
    const result = await restoreRuleVideos("rule-1", ["video-1"]);

    expect(result).toEqual({
      restored: ["video-1"],
      failed: [],
    });
    expect(clientMock.addPlaylistItem).toHaveBeenCalledWith("youtube-playlist-1", "video-1", 0);
    expect(prismaMock.ruleVideoExclusion.delete).toHaveBeenCalledWith({
      where: {
        ruleId_videoId: {
          ruleId: "rule-1",
          videoId: "video-1",
        },
      },
    });
    expect(prismaMock.playlistMembership.upsert).toHaveBeenCalled();
  });
});
