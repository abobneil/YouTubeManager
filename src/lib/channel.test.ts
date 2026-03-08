import { describe, expect, it } from "vitest";
import { parseChannelInput } from "@/lib/channel";

describe("parseChannelInput", () => {
  it("accepts channel id", () => {
    const parsed = parseChannelInput("UC1234567890abcdefABCDEF");
    expect(parsed).toEqual({ type: "channelId", value: "UC1234567890abcdefABCDEF" });
  });

  it("accepts handle", () => {
    const parsed = parseChannelInput("@Day9TV");
    expect(parsed).toEqual({ type: "handle", value: "Day9TV" });
  });

  it("accepts channel url", () => {
    const parsed = parseChannelInput("https://www.youtube.com/channel/UC1234567890abcdefABCDEF");
    expect(parsed).toEqual({ type: "channelId", value: "UC1234567890abcdefABCDEF" });
  });

  it("throws for unsupported inputs", () => {
    expect(() => parseChannelInput("https://example.com/foo")).toThrow();
  });

  it("rejects lookalike YouTube hosts", () => {
    expect(() =>
      parseChannelInput("https://notyoutube.com/channel/UC1234567890abcdefABCDEF"),
    ).toThrow();
    expect(() =>
      parseChannelInput("https://youtube.com.evil.example/channel/UC1234567890abcdefABCDEF"),
    ).toThrow();
  });
});
