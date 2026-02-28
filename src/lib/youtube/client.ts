import { setTimeout as sleep } from "node:timers/promises";
import { PrivacyStatus } from "@prisma/client";
import { YouTubeApiError } from "@/lib/errors";

const API_BASE = "https://www.googleapis.com/youtube/v3";

type YouTubeErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
};

type ChannelsListResponse = {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
    };
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }>;
};

type PlaylistItemsListResponse = {
  nextPageToken?: string;
  items?: Array<{
    contentDetails?: {
      videoId?: string;
      videoPublishedAt?: string;
    };
  }>;
};

type VideosListResponse = {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
    };
  }>;
};

type PlaylistInsertResponse = {
  id: string;
};

type PlaylistItemInsertResponse = {
  id: string;
};

type SubscriptionsListResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      resourceId?: {
        channelId?: string;
      };
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
  }>;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & YouTubeErrorPayload;
  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason;
    throw new YouTubeApiError(
      payload.error?.message ?? "YouTube API request failed",
      response.status,
      reason,
      payload,
    );
  }
  return payload;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class YouTubeClient {
  constructor(private readonly accessToken: string) {}

  private async request<T>(
    path: string,
    init: RequestInit & { query?: Record<string, string | number | undefined> },
  ): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    if (init.query) {
      for (const [key, value] of Object.entries(init.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let attempts = 0;
    // bounded retry for transient 429/5xx errors
    while (true) {
      attempts += 1;
      try {
        const response = await fetch(url, {
          method: init.method,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
          body: init.body,
        });
        return await parseResponse<T>(response);
      } catch (error) {
        if (
          error instanceof YouTubeApiError &&
          attempts < 4 &&
          isRetryableStatus(error.status)
        ) {
          await sleep(250 * attempts);
          continue;
        }
        throw error;
      }
    }
  }

  async getChannelById(channelId: string): Promise<{
    channelId: string;
    title: string;
    uploadsPlaylistId: string;
  }> {
    const response = await this.request<ChannelsListResponse>("/channels", {
      method: "GET",
      query: {
        part: "snippet,contentDetails",
        id: channelId,
        maxResults: 1,
      },
    });

    const first = response.items?.[0];
    if (!first?.contentDetails.relatedPlaylists.uploads) {
      throw new YouTubeApiError("Channel not found", 404, "channelNotFound");
    }

    return {
      channelId: first.id,
      title: first.snippet.title,
      uploadsPlaylistId: first.contentDetails.relatedPlaylists.uploads,
    };
  }

  async getChannelByHandle(handle: string): Promise<{
    channelId: string;
    title: string;
    uploadsPlaylistId: string;
  }> {
    const response = await this.request<ChannelsListResponse>("/channels", {
      method: "GET",
      query: {
        part: "snippet,contentDetails",
        forHandle: handle,
        maxResults: 1,
      },
    });

    const first = response.items?.[0];
    if (!first?.contentDetails.relatedPlaylists.uploads) {
      throw new YouTubeApiError("Channel handle not found", 404, "channelNotFound");
    }

    return {
      channelId: first.id,
      title: first.snippet.title,
      uploadsPlaylistId: first.contentDetails.relatedPlaylists.uploads,
    };
  }

  async listUploads(playlistId: string, pageToken?: string): Promise<{
    nextPageToken?: string;
    items: Array<{
      videoId: string;
      publishedAt: string;
    }>;
  }> {
    const response = await this.request<PlaylistItemsListResponse>("/playlistItems", {
      method: "GET",
      query: {
        part: "contentDetails",
        playlistId,
        maxResults: 50,
        pageToken,
      },
    });

    const items =
      response.items
        ?.map((item) => ({
          videoId: item.contentDetails?.videoId ?? "",
          publishedAt: item.contentDetails?.videoPublishedAt ?? "",
        }))
        .filter((item) => item.videoId && item.publishedAt) ?? [];

    return {
      nextPageToken: response.nextPageToken,
      items,
    };
  }

  async listVideos(videoIds: string[]): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
    }>
  > {
    if (videoIds.length === 0) {
      return [];
    }
    const response = await this.request<VideosListResponse>("/videos", {
      method: "GET",
      query: {
        part: "snippet",
        id: videoIds.join(","),
        maxResults: 50,
      },
    });

    return (
      response.items?.map((item) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description ?? "",
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
      })) ?? []
    );
  }

  async createPlaylist(
    title: string,
    privacyStatus: PrivacyStatus,
    description?: string,
  ): Promise<string> {
    const response = await this.request<PlaylistInsertResponse>("/playlists?part=snippet,status", {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          title,
          description: description ?? "Managed by YouTube Smart Playlist Manager",
        },
        status: {
          privacyStatus: privacyStatus.toLowerCase(),
        },
      }),
    });
    return response.id;
  }

  async addPlaylistItem(
    playlistId: string,
    videoId: string,
    position?: number,
  ): Promise<{ itemId: string }> {
    const snippet: Record<string, unknown> = {
      playlistId,
      resourceId: {
        kind: "youtube#video",
        videoId,
      },
    };
    if (typeof position === "number") {
      snippet.position = position;
    }

    const response = await this.request<PlaylistItemInsertResponse>(
      "/playlistItems?part=snippet",
      {
        method: "POST",
        body: JSON.stringify({ snippet }),
      },
    );
    return { itemId: response.id };
  }

  async listSubscriptions(pageToken?: string): Promise<{
    nextPageToken?: string;
    items: Array<{
      channelId: string;
      title: string;
      thumbnailUrl: string | null;
    }>;
  }> {
    const response = await this.request<SubscriptionsListResponse>("/subscriptions", {
      method: "GET",
      query: {
        part: "snippet",
        mine: "true",
        maxResults: 50,
        pageToken,
      },
    });

    const items =
      response.items
        ?.map((item) => {
          const snippet = item.snippet;
          return {
            channelId: snippet?.resourceId?.channelId ?? "",
            title: snippet?.title ?? "",
            thumbnailUrl:
              snippet?.thumbnails?.high?.url ??
              snippet?.thumbnails?.medium?.url ??
              snippet?.thumbnails?.default?.url ??
              null,
          };
        })
        .filter((item) => item.channelId && item.title) ?? [];

    return {
      nextPageToken: response.nextPageToken,
      items,
    };
  }
}
