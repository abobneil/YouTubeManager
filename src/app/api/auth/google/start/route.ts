import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { createOauthState, setOauthStateCookie } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  const state = createOauthState();
  await setOauthStateCookie(state);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", env.youtubeScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
