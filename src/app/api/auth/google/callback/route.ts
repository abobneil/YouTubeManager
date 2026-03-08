import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";
import { exchangeOAuthCode, getGoogleProfile } from "@/lib/google-oauth";
import { logger } from "@/lib/logger";
import { authorizeOwnerProfile, getOwnerAuthState } from "@/lib/owner-auth";
import { getSourceIp, withNoStore } from "@/lib/security";
import { saveOAuthToken } from "@/lib/token-store";
import { consumeOauthStateCookie, setSessionOwnerId } from "@/lib/session";

function redirectToSetup(errorCode: string): NextResponse {
  const url = new URL("/setup", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("error", errorCode);
  return withNoStore(NextResponse.redirect(url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sourceIp = getSourceIp(request);

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const storedState = await consumeOauthStateCookie();

    if (!code || !state || !storedState || state !== storedState) {
      throw new HttpError(400, "OAUTH_INVALID_STATE", "Invalid OAuth state.");
    }

    const tokenResponse = await exchangeOAuthCode(code);
    const profile = await getGoogleProfile(tokenResponse.access_token);
    const ownerState = await getOwnerAuthState();
    const decision = authorizeOwnerProfile(ownerState, profile, env.OWNER_GOOGLE_EMAIL_ALLOWLIST);

    if (!decision.ok) {
      logger.warn(
        {
          reason: decision.code,
          sourceIp,
          email: profile.email,
          sub: profile.sub,
        },
        "Rejected owner auth attempt",
      );
      return redirectToSetup(decision.code);
    }

    if (decision.action === "enroll") {
      try {
        await prisma.ownerAccount.create({
          data: {
            id: "owner",
            googleSub: profile.sub,
            email: profile.email,
            displayName: profile.name,
            pictureUrl: profile.picture,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          logger.warn(
            {
              reason: "OWNER_ALREADY_INITIALIZED",
              sourceIp,
              email: profile.email,
              sub: profile.sub,
            },
            "Rejected owner enrollment after concurrent initialization",
          );
          return redirectToSetup("OWNER_SUB_MISMATCH");
        }
        throw error;
      }
    } else {
      await prisma.ownerAccount.update({
        where: { id: "owner" },
        data: {
          email: profile.email,
          displayName: profile.name,
          pictureUrl: profile.picture,
        },
      });
    }

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
    return withNoStore(NextResponse.redirect(new URL("/dashboard", env.NEXT_PUBLIC_APP_URL)));
  } catch (error) {
    const errorCode = error instanceof HttpError ? error.code : "OAUTH_FLOW_FAILED";
    logger.warn(
      {
        reason: errorCode,
        sourceIp,
        error: error instanceof Error ? error.message : "Unknown OAuth callback error",
      },
      "OAuth callback failed",
    );
    return redirectToSetup(errorCode);
  }
}
