import { MatchFields, OrderMode, PrivacyStatus } from "@prisma/client";
import { z } from "zod";

export const creatorCreateSchema = z.object({
  input: z.string().min(1),
  displayName: z.string().min(1).optional(),
  active: z.boolean().optional().default(true),
});

export const creatorUpdateSchema = z.object({
  displayName: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const creatorImportSubscriptionsSchema = z.object({
  channelIds: z
    .array(z.string().regex(/^UC[a-zA-Z0-9_-]{22}$/))
    .min(1)
    .max(200)
    .transform((items) => [...new Set(items)]),
  active: z.boolean().optional().default(true),
});

const keywordSchema = z
  .array(z.string().min(1))
  .min(1)
  .transform((items) => items.map((item) => item.trim()).filter(Boolean));

const optionalKeywordSchema = z
  .array(z.string().min(1))
  .optional()
  .default([])
  .transform((items) => items.map((item) => item.trim()).filter(Boolean));

export const topicRuleCreateSchema = z.object({
  name: z.string().min(1),
  includeKeywords: keywordSchema,
  excludeKeywords: optionalKeywordSchema,
  matchFields: z.nativeEnum(MatchFields).default(MatchFields.BOTH),
  caseSensitive: z.boolean().optional().default(false),
  orderMode: z.nativeEnum(OrderMode).default(OrderMode.NEWEST),
  privacyStatus: z.nativeEnum(PrivacyStatus).default(PrivacyStatus.PRIVATE),
  active: z.boolean().optional().default(true),
  creatorScopeIds: z.array(z.string().min(1)).optional().default([]),
});

export const topicRuleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  includeKeywords: keywordSchema.optional(),
  excludeKeywords: optionalKeywordSchema.optional(),
  matchFields: z.nativeEnum(MatchFields).optional(),
  caseSensitive: z.boolean().optional(),
  orderMode: z.nativeEnum(OrderMode).optional(),
  privacyStatus: z.nativeEnum(PrivacyStatus).optional(),
  active: z.boolean().optional(),
  creatorScopeIds: z.array(z.string().min(1)).optional(),
});

export const syncManualSchema = z.object({
  trigger: z.literal("MANUAL").optional(),
});
