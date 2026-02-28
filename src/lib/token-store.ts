import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { refreshGoogleToken } from "@/lib/google-oauth";
import { HttpError } from "@/lib/errors";

type PersistableTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  tokenType?: string;
};

export async function saveOAuthToken(ownerId: string, data: PersistableTokenSet): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(data.expiresIn - 30, 30) * 1000);
  await prisma.oAuthToken.upsert({
    where: { ownerId },
    update: {
      encryptedAccessToken: encrypt(data.accessToken),
      encryptedRefreshToken: encrypt(data.refreshToken),
      expiresAt,
      scopes: data.scopes,
      tokenType: data.tokenType,
    },
    create: {
      ownerId,
      encryptedAccessToken: encrypt(data.accessToken),
      encryptedRefreshToken: encrypt(data.refreshToken),
      expiresAt,
      scopes: data.scopes,
      tokenType: data.tokenType,
    },
  });
}

export async function getValidAccessToken(ownerId = "owner"): Promise<string> {
  const token = await prisma.oAuthToken.findUnique({
    where: { ownerId },
  });

  if (!token) {
    throw new HttpError(401, "MISSING_OAUTH_TOKEN", "Connect your Google account first.");
  }

  if (token.expiresAt.getTime() > Date.now()) {
    return decrypt(token.encryptedAccessToken);
  }

  const refreshToken = decrypt(token.encryptedRefreshToken);
  const refreshed = await refreshGoogleToken(refreshToken);

  await saveOAuthToken(ownerId, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? refreshToken,
    expiresIn: refreshed.expires_in,
    scopes: refreshed.scope.split(" "),
    tokenType: refreshed.token_type,
  });

  return refreshed.access_token;
}
