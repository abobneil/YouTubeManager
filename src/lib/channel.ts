const CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;
const HANDLE_PATTERN = /^@[a-zA-Z0-9._-]{3,30}$/;

export type ChannelLookup =
  | { type: "channelId"; value: string }
  | { type: "handle"; value: string };

export function parseChannelInput(input: string): ChannelLookup {
  const trimmed = input.trim();

  if (CHANNEL_ID_PATTERN.test(trimmed)) {
    return { type: "channelId", value: trimmed };
  }
  if (HANDLE_PATTERN.test(trimmed)) {
    return { type: "handle", value: trimmed.slice(1) };
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("youtube.com") && !url.hostname.includes("youtu.be")) {
      throw new Error("Not a YouTube URL");
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "channel" && CHANNEL_ID_PATTERN.test(parts[1])) {
      return { type: "channelId", value: parts[1] };
    }
    if (parts.length >= 1 && parts[0].startsWith("@")) {
      return { type: "handle", value: parts[0].slice(1) };
    }
    throw new Error("Unsupported YouTube channel URL format");
  } catch {
    throw new Error("Provide a valid YouTube channel ID, handle, or URL.");
  }
}
