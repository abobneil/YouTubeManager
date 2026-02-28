import { env } from "@/lib/config";
import { HttpError } from "@/lib/errors";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type?: string;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

async function requestToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = (await response.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new HttpError(
      400,
      "OAUTH_TOKEN_EXCHANGE_FAILED",
      payload.error_description ?? payload.error ?? "Unable to exchange oauth token",
    );
  }
  return payload;
}

export async function exchangeOAuthCode(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  return requestToken(params);
}

export async function refreshGoogleToken(refreshToken: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return requestToken(params);
}

export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new HttpError(400, "GOOGLE_PROFILE_FAILED", "Unable to fetch Google profile");
  }

  const profile = (await response.json()) as GoogleProfile;
  if (!profile.sub || !profile.email) {
    throw new HttpError(400, "GOOGLE_PROFILE_INVALID", "Google profile missing required fields");
  }
  return profile;
}
