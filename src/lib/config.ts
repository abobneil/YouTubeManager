import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().min(1).optional(),
  OAUTH_STATE_COOKIE_NAME: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  SYNC_SOFT_QUOTA_LIMIT: z.coerce.number().int().positive().default(2000),
  SYNC_PAGE_LIMIT: z.coerce.number().int().positive().max(20).default(3),
  WORKER_POLL_SECONDS: z.coerce.number().int().positive().default(20),
  OWNER_GOOGLE_EMAIL_ALLOWLIST: z.string().optional(),
  EDGE_SHARED_SECRET: z.string().optional(),
  TRUSTED_CLIENT_CIDRS: z.string().optional(),
  HAPROXY_BASIC_AUTH_USER: z.string().optional(),
  HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT: z.string().optional(),
  ALLOWED_MUTATION_ORIGINS: z.string().optional(),
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

function parseCsvList(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(input: string): string {
  return new URL(input).origin;
}

function defaultCookieName(kind: "session" | "oauth"): string {
  if (kind === "session") {
    return base.NODE_ENV === "production" ? "__Host-ytm_session" : "ytm_session";
  }
  return base.NODE_ENV === "production" ? "__Host-ytm_oauth_state" : "ytm_oauth_state";
}

export function validateRuntimeConfig(): string[] {
  const issues: string[] = [];

  if (base.NODE_ENV !== "production") {
    return issues;
  }

  if (new URL(base.NEXT_PUBLIC_APP_URL).protocol !== "https:") {
    issues.push("NEXT_PUBLIC_APP_URL must use https in production");
  }

  const allowlist = parseCsvList(base.OWNER_GOOGLE_EMAIL_ALLOWLIST);
  if (allowlist.length === 0) {
    issues.push("OWNER_GOOGLE_EMAIL_ALLOWLIST is required in production");
  }

  const edgeSecret = base.EDGE_SHARED_SECRET?.trim() ?? "";
  if (edgeSecret.length < 32) {
    issues.push("EDGE_SHARED_SECRET must be at least 32 characters in production");
  }

  if (parseCsvList(base.TRUSTED_CLIENT_CIDRS).length === 0) {
    issues.push("TRUSTED_CLIENT_CIDRS is required in production");
  }

  if (!(base.HAPROXY_BASIC_AUTH_USER?.trim())) {
    issues.push("HAPROXY_BASIC_AUTH_USER is required in production");
  }

  if (!(base.HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT?.trim())) {
    issues.push("HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT is required in production");
  }

  const allowedOrigins = parseCsvList(base.ALLOWED_MUTATION_ORIGINS || base.NEXT_PUBLIC_APP_URL);
  if (allowedOrigins.length === 0) {
    issues.push("ALLOWED_MUTATION_ORIGINS must contain at least one origin in production");
  } else {
    for (const origin of allowedOrigins) {
      try {
        if (normalizeOrigin(origin) !== origin) {
          issues.push(`ALLOWED_MUTATION_ORIGINS entries must be bare origins: ${origin}`);
        }
      } catch {
        issues.push(`ALLOWED_MUTATION_ORIGINS contains an invalid URL: ${origin}`);
      }
    }
  }

  return issues;
}

export const env = {
  ...base,
  get isProduction() {
    return base.NODE_ENV === "production";
  },
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
  get SESSION_COOKIE_NAME() {
    return base.SESSION_COOKIE_NAME ?? defaultCookieName("session");
  },
  get OAUTH_STATE_COOKIE_NAME() {
    return base.OAUTH_STATE_COOKIE_NAME ?? defaultCookieName("oauth");
  },
  get OWNER_GOOGLE_EMAIL_ALLOWLIST() {
    return parseCsvList(base.OWNER_GOOGLE_EMAIL_ALLOWLIST).map((email) => email.toLowerCase());
  },
  get EDGE_SHARED_SECRET() {
    return requireEnv("EDGE_SHARED_SECRET");
  },
  get TRUSTED_CLIENT_CIDRS() {
    return parseCsvList(base.TRUSTED_CLIENT_CIDRS);
  },
  get HAPROXY_BASIC_AUTH_USER() {
    return requireEnv("HAPROXY_BASIC_AUTH_USER");
  },
  get HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT() {
    return requireEnv("HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT");
  },
  get ALLOWED_MUTATION_ORIGINS() {
    return parseCsvList(base.ALLOWED_MUTATION_ORIGINS || base.NEXT_PUBLIC_APP_URL).map(
      (origin) => normalizeOrigin(origin),
    );
  },
  youtubeScopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube",
  ] as const,
};
