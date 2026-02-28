import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().min(1).default("ytm_session"),
  OAUTH_STATE_COOKIE_NAME: z.string().min(1).default("ytm_oauth_state"),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  SYNC_SOFT_QUOTA_LIMIT: z.coerce.number().int().positive().default(2000),
  SYNC_PAGE_LIMIT: z.coerce.number().int().positive().max(20).default(3),
  WORKER_POLL_SECONDS: z.coerce.number().int().positive().default(20),
});

const parsedBase = baseEnvSchema.safeParse(process.env);

if (!parsedBase.success) {
  const issues = parsedBase.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid base environment configuration:\n${issues.join("\n")}`);
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireSessionSecret(): string {
  const value = requireEnv("SESSION_SECRET");
  if (value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return value;
}

function requireEncryptionKeyHex(): string {
  const value = requireEnv("ENCRYPTION_KEY_HEX");
  if (!/^[A-Fa-f0-9]{64}$/.test(value)) {
    throw new Error("ENCRYPTION_KEY_HEX must be 64 hex characters");
  }
  return value;
}

const base = parsedBase.data;

export const env = {
  ...base,
  get DATABASE_URL() {
    return requireEnv("DATABASE_URL");
  },
  get GOOGLE_CLIENT_ID() {
    return requireEnv("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET() {
    return requireEnv("GOOGLE_CLIENT_SECRET");
  },
  get SESSION_SECRET() {
    return requireSessionSecret();
  },
  get ENCRYPTION_KEY_HEX() {
    return requireEncryptionKeyHex();
  },
  get GOOGLE_REDIRECT_URI() {
    return base.GOOGLE_REDIRECT_URI ?? `${base.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
  },
  youtubeScopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube",
  ] as const,
};
