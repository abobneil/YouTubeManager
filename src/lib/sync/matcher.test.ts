import { MatchFields } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getMatchedRuleIds } from "@/lib/sync/matcher";

const baseVideo = {
  id: "video-1",
  creatorId: "creator-1",
  title: "Day9 StarCraft Challenge",
  description: "A fun StarCraft episode",
};

describe("getMatchedRuleIds", () => {
  it("matches include keywords and skips excludes", () => {
    const ids = getMatchedRuleIds(baseVideo, [
      {
        id: "rule-1",
        includeKeywords: ["StarCraft"],
        excludeKeywords: ["Hearthstone"],
        matchFields: MatchFields.BOTH,
        caseSensitive: false,
        active: true,
        creatorScopeIds: [],
      },
      {
        id: "rule-2",
        includeKeywords: ["StarCraft"],
        excludeKeywords: ["Challenge"],
        matchFields: MatchFields.TITLE,
        caseSensitive: false,
        active: true,
        creatorScopeIds: [],
      },
    ]);
    expect(ids).toEqual(["rule-1"]);
  });

  it("supports case-sensitive matching", () => {
    const ids = getMatchedRuleIds(baseVideo, [
      {
        id: "rule-1",
        includeKeywords: ["starcraft"],
        excludeKeywords: [],
        matchFields: MatchFields.BOTH,
        caseSensitive: true,
        active: true,
        creatorScopeIds: [],
      },
    ]);
    expect(ids).toEqual([]);
  });

  it("supports multi-match and creator scoping", () => {
    const ids = getMatchedRuleIds(baseVideo, [
      {
        id: "rule-1",
        includeKeywords: ["StarCraft"],
        excludeKeywords: [],
        matchFields: MatchFields.TITLE,
        caseSensitive: false,
        active: true,
        creatorScopeIds: ["creator-1"],
      },
      {
        id: "rule-2",
        includeKeywords: ["episode"],
        excludeKeywords: [],
        matchFields: MatchFields.DESCRIPTION,
        caseSensitive: false,
        active: true,
        creatorScopeIds: ["creator-1"],
      },
    ]);
    expect(ids).toEqual(["rule-1", "rule-2"]);
  });
});
