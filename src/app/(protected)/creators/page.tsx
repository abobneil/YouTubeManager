"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CreatorDto } from "@/lib/types";

type CreatorsPayload = {
  creators: CreatorDto[];
};

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorDto[]>([]);
  const [input, setInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/creators", { cache: "no-store" });
    const payload = (await response.json()) as CreatorsPayload & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load creators.");
    }
    setCreators(payload.creators);
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Load failed"));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          displayName: displayName || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to add creator.");
      }
      setInput("");
      setDisplayName("");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCreator(creator: CreatorDto) {
    setError(null);
    const response = await fetch(`/api/creators/${creator.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !creator.active }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to update creator.");
      return;
    }
    await load();
  }

  async function deleteCreator(creatorId: string) {
    if (!window.confirm("Delete this creator?")) {
      return;
    }
    const response = await fetch(`/api/creators/${creatorId}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to delete creator.");
      return;
    }
    await load();
  }

  return (
    <section className="panel page-card stack">
      <h2 className="page-title">Creators</h2>
      <p className="page-desc">
        Add channels by URL, handle, or channel ID. Active creators are scanned during sync.
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      <form className="stack" onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="creator-input">Channel URL, Handle, or Channel ID</label>
          <input
            id="creator-input"
            className="input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            required
            placeholder="https://www.youtube.com/@channel"
          />
        </div>
        <div className="form-row">
          <label htmlFor="creator-display-name">Override Display Name (optional)</label>
          <input
            id="creator-display-name"
            className="input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Day9TV"
          />
        </div>
        <div className="row">
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? "Adding..." : "Add Creator"}
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Channel ID</th>
              <th>Uploads Playlist</th>
              <th>Status</th>
              <th>Last Checked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {creators.length ? (
              creators.map((creator) => (
                <tr key={creator.id}>
                  <td>{creator.displayName}</td>
                  <td className="mono">{creator.channelId}</td>
                  <td className="mono">{creator.uploadsPlaylistId ?? "-"}</td>
                  <td>
                    <span className={creator.active ? "pill pill-ok" : "pill pill-warn"}>
                      {creator.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="mono">
                    {creator.lastCheckedAt ? new Date(creator.lastCheckedAt).toLocaleString() : "-"}
                  </td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => toggleCreator(creator)}
                      >
                        {creator.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => deleteCreator(creator.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="helper">
                  No creators yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
