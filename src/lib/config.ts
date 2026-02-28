import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("ytm_session"),
  SESSION_SECRET: z.string().min(32),
  OAUTH_STATE_COOKIE_NAME: z.string().min(1).default("ytm_oauth_state"),
  ENCRYPTION_KEY_HEX: z
    .string()
    .regex(/^[A-Fa-f0-9]{64}$/, "ENCRYPTION_KEY_HEX must be 64 hex chars"),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  SYNC_SOFT_QUOTA_LIMIT: z.coerce.number().int().positive().default(2000),
  SYNC_PAGE_LIMIT: z.coerce.number().int().positive().max(20).default(3),
  WORKER_POLL_SECONDS: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

export const env = {
  ...parsed.data,
  GOOGLE_REDIRECT_URI:
    parsed.data.GOOGLE_REDIRECT_URI ??
    `${parsed.data.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
  youtubeScopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube",
  ] as const,
};
