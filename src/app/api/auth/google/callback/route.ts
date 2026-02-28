import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";
import { exchangeOAuthCode, getGoogleProfile } from "@/lib/google-oauth";
import { saveOAuthToken } from "@/lib/token-store";
import { consumeOauthStateCookie, setSessionOwnerId } from "@/lib/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const storedState = await consumeOauthStateCookie();

    if (!code || !state || !storedState || state !== storedState) {
      throw new HttpError(400, "OAUTH_INVALID_STATE", "Invalid OAuth state.");
    }

    const tokenResponse = await exchangeOAuthCode(code);
    const profile = await getGoogleProfile(tokenResponse.access_token);

    await prisma.ownerAccount.upsert({
      where: { id: "owner" },
      update: {
        googleSub: profile.sub,
        email: profile.email,
        displayName: profile.name,
        pictureUrl: profile.picture,
      },
      create: {
        id: "owner",
        googleSub: profile.sub,
        email: profile.email,
        displayName: profile.name,
        pictureUrl: profile.picture,
      },
    });

    const existing = await prisma.oAuthToken.findUnique({ where: { ownerId: "owner" } });
    const refreshToken =
      tokenResponse.refresh_token ??
      (existing ? decrypt(existing.encryptedRefreshToken) : undefined);

    if (!refreshToken) {
      throw new HttpError(400, "OAUTH_REFRESH_TOKEN_MISSING", "No refresh token received.");
    }

    await saveOAuthToken("owner", {
      accessToken: tokenResponse.access_token,
      refreshToken,
      expiresIn: tokenResponse.expires_in,
      scopes: tokenResponse.scope.split(" "),
      tokenType: tokenResponse.token_type,
    });

    await setSessionOwnerId("owner");
    return NextResponse.redirect(new URL("/dashboard", env.NEXT_PUBLIC_APP_URL));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth flow failed";
    const url = new URL("/setup", env.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  }
}
