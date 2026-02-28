import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/config";
import { secureEquals, signValue } from "@/lib/crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  ownerId: string;
  exp: number;
};

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signValue(body);
  return `${body}.${sig}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    return null;
  }
  const expected = signValue(body);
  if (!secureEquals(sig, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.exp || parsed.exp * 1000 < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionOwnerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  const payload = decodeSession(raw);
  return payload?.ownerId ?? null;
}

export async function setSessionOwnerId(ownerId: string): Promise<void> {
  const cookieStore = await cookies();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  cookieStore.set(env.SESSION_COOKIE_NAME, encodeSession({ ownerId, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export async function setOauthStateCookie(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(env.OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
}

export async function consumeOauthStateCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(env.OAUTH_STATE_COOKIE_NAME)?.value ?? null;
  cookieStore.set(env.OAUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return value;
}

export function createOauthState(): string {
  return randomBytes(16).toString("hex");
}
