import { redirect } from "next/navigation";
import { getSessionOwnerId } from "@/lib/session";

type SetupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const ownerId = await getSessionOwnerId();
  if (ownerId) {
    redirect("/dashboard");
  }
  const params = await searchParams;

  return (
    <div className="app-shell">
      <div className="container">
        <div className="panel page-card stack">
          <h1 className="page-title">Connect Your YouTube Account</h1>
          <p className="page-desc">
            This app manages playlists in one Google account using OAuth and the YouTube Data API.
          </p>
          {params.error ? <p className="error-text">{params.error}</p> : null}
          <div className="row">
            <a className="button button-primary" href="/api/auth/google/start">
              Sign In With Google
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
