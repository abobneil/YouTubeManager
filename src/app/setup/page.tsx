import { redirect } from "next/navigation";
import { getOwnerAuthState } from "@/lib/owner-auth";
import { getSessionOwnerId } from "@/lib/session";

type SetupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  OAUTH_INVALID_STATE: "The Google sign-in attempt could not be verified. Start the sign-in flow again.",
  OWNER_EMAIL_NOT_VERIFIED: "The Google account email must be verified before it can access this app.",
  OWNER_EMAIL_NOT_ALLOWED:
    "That Google account is not approved to initialize this app. Use an allowlisted owner account.",
  OWNER_SUB_MISMATCH:
    "This app is already bound to a different Google account and will not allow takeover.",
  OAUTH_TOKEN_EXCHANGE_FAILED: "Google sign-in failed while exchanging the authorization code.",
  GOOGLE_PROFILE_FAILED: "Google sign-in failed while loading the account profile.",
  GOOGLE_PROFILE_INVALID: "Google returned an incomplete account profile.",
  OAUTH_REFRESH_TOKEN_MISSING:
    "Google did not provide a usable refresh token. Try signing in again with the approved account.",
  OAUTH_FLOW_FAILED: "The Google sign-in flow failed. Review the server logs for details.",
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const ownerId = await getSessionOwnerId();
  if (ownerId) {
    redirect("/dashboard");
  }
  const [params, ownerState] = await Promise.all([searchParams, getOwnerAuthState()]);
  const errorMessage = params.error ? errorMessages[params.error] ?? errorMessages.OAUTH_FLOW_FAILED : null;

  return (
    <div className="app-shell">
      <div className="container">
        <div className="panel page-card stack">
          <h1 className="page-title">
            {ownerState.status === "uninitialized" ? "Initialize Owner Access" : "Sign In to Owner Account"}
          </h1>
          <p className="page-desc">
            {ownerState.status === "uninitialized"
              ? "Sign in with an approved Google account to bind the single owner for this app."
              : "Sign in with the Google account already bound as the owner for this app."}
          </p>
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          <div className="row">
            <a className="button button-primary" href="/api/auth/google/start">
              {ownerState.status === "uninitialized" ? "Initialize With Google" : "Sign In With Google"}
            </a>
          </div>
          <p className="helper">
            Required scope: <span className="mono">https://www.googleapis.com/auth/youtube</span>
          </p>
        </div>
      </div>
    </div>
  );
}
