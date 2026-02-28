import { MatchFields } from "@prisma/client";

export type MatchableVideo = {
  id: string;
  title: string;
  description: string;
  creatorId: string;
};

export type RuleForMatching = {
  id: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  matchFields: MatchFields;
  caseSensitive: boolean;
  active: boolean;
  creatorScopeIds: string[];
};

function includesKeyword(haystack: string, keyword: string, caseSensitive: boolean): boolean {
  if (caseSensitive) {
    return haystack.includes(keyword);
  }
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

function ruleText(rule: RuleForMatching, video: MatchableVideo): string {
  switch (rule.matchFields) {
    case MatchFields.TITLE:
      return video.title;
    case MatchFields.DESCRIPTION:
      return video.description;
    case MatchFields.BOTH:
    default:
      return `${video.title}\n${video.description}`;
  }
}

export function getMatchedRuleIds(video: MatchableVideo, rules: RuleForMatching[]): string[] {
  const matchedRuleIds: string[] = [];

  for (const rule of rules) {
    if (!rule.active) {
      continue;
    }
    if (rule.creatorScopeIds.length > 0 && !rule.creatorScopeIds.includes(video.creatorId)) {
      continue;
    }
    const text = ruleText(rule, video);

    const hasInclude = rule.includeKeywords.some((keyword) =>
      includesKeyword(text, keyword, rule.caseSensitive),
    );
    if (!hasInclude) {
      continue;
    }

    const hasExclude = rule.excludeKeywords.some((keyword) =>
      includesKeyword(text, keyword, rule.caseSensitive),
    );
    if (hasExclude) {
      continue;
    }

    matchedRuleIds.push(rule.id);
  }

  return matchedRuleIds;
}
