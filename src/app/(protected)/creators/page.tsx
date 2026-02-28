"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CreatorDto, SubscriptionChannelDto } from "@/lib/types";

type CreatorsPayload = {
  creators: CreatorDto[];
};

type SubscriptionsPayload = {
  subscriptions: SubscriptionChannelDto[];
  truncated: boolean;
};

type ImportPayload = {
  imported: CreatorDto[];
  skipped: Array<{ channelId: string; reason: string }>;
  failed: Array<{ channelId: string; reason: string }>;
};

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorDto[]>([]);
  const [input, setInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [subscriptions, setSubscriptions] = useState<SubscriptionChannelDto[]>([]);
  const [subscriptionsBusy, setSubscriptionsBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importActive, setImportActive] = useState(true);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionsTruncated, setSubscriptionsTruncated] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  async function loadCreators() {
    const response = await fetch("/api/creators", { cache: "no-store" });
    const payload = (await response.json()) as CreatorsPayload & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load creators.");
    }
    setCreators(payload.creators);
  }

  async function loadSubscriptions() {
    setSubscriptionsBusy(true);
    setImportSummary(null);
    try {
      const response = await fetch("/api/creators/subscriptions", { cache: "no-store" });
      const payload = (await response.json()) as SubscriptionsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load subscriptions.");
      }
      setSubscriptions(payload.subscriptions);
      setSubscriptionsTruncated(payload.truncated);
      setSelectedChannelIds((current) =>
        current.filter((channelId) =>
          payload.subscriptions.some(
            (subscription) =>
              subscription.channelId === channelId && !subscription.alreadyAdded,
          ),
        ),
      );
    } finally {
      setSubscriptionsBusy(false);
    }
  }

  useEffect(() => {
    loadCreators().catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Load failed"),
    );
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setImportSummary(null);
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
      await loadCreators();
      if (subscriptions.length > 0) {
        await loadSubscriptions();
      }
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
    await loadCreators();
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
    await loadCreators();
    if (subscriptions.length > 0) {
      await loadSubscriptions();
    }
  }

  function toggleSubscriptionSelection(channelId: string) {
    setSelectedChannelIds((current) =>
      current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId],
    );
  }

  const filteredSubscriptions = useMemo(() => {
    const query = subscriptionSearch.trim().toLowerCase();
    if (!query) {
      return subscriptions;
    }
    return subscriptions.filter(
      (subscription) =>
        subscription.title.toLowerCase().includes(query) ||
        subscription.channelId.toLowerCase().includes(query),
    );
  }, [subscriptions, subscriptionSearch]);

  function selectVisibleSubscriptions() {
    setSelectedChannelIds((current) => {
      const currentSet = new Set(current);
      for (const subscription of filteredSubscriptions) {
        if (!subscription.alreadyAdded) {
          currentSet.add(subscription.channelId);
        }
      }
      return [...currentSet];
    });
  }

  function clearSelectedSubscriptions() {
    setSelectedChannelIds([]);
  }

  async function importSelectedSubscriptions() {
    if (selectedChannelIds.length === 0) {
      return;
    }
    setImportBusy(true);
    setError(null);
    setImportSummary(null);
    try {
      const response = await fetch("/api/creators/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelIds: selectedChannelIds,
          active: importActive,
        }),
      });
      const payload = (await response.json()) as ImportPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to import selected subscriptions.");
      }
      setImportSummary(
        `Imported ${payload.imported.length}, skipped ${payload.skipped.length}, failed ${payload.failed.length}.`,
      );
      await loadCreators();
      await loadSubscriptions();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <section className="panel page-card stack">
      <h2 className="page-title">Creators</h2>
      <p className="page-desc">
        Add channels manually or import selected channels from your existing YouTube subscriptions.
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      {importSummary ? <p className="success-text">{importSummary}</p> : null}

      <div className="panel page-card stack">
        <h3>Import From My Subscriptions</h3>
        <div className="row">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setError(null);
              loadSubscriptions().catch((loadError) =>
                setError(loadError instanceof Error ? loadError.message : "Subscription load failed"),
              );
            }}
            disabled={subscriptionsBusy}
          >
            {subscriptionsBusy ? "Loading..." : subscriptions.length ? "Refresh Subscriptions" : "Load Subscriptions"}
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={selectVisibleSubscriptions}
            disabled={subscriptionsBusy || filteredSubscriptions.length === 0}
          >
            Select Visible
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={clearSelectedSubscriptions}
            disabled={selectedChannelIds.length === 0}
          >
            Clear Selection
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={importSelectedSubscriptions}
            disabled={importBusy || selectedChannelIds.length === 0}
          >
            {importBusy ? "Importing..." : `Import Selected (${selectedChannelIds.length})`}
          </button>
        </div>
        <div className="row">
          <label className="helper">
            <input
              type="checkbox"
              checked={importActive}
              onChange={(event) => setImportActive(event.target.checked)}
            />{" "}
            Mark imported creators as active
          </label>
        </div>
        {subscriptionsTruncated ? (
          <p className="helper">
            Subscription list was truncated after 1,000 channels. Refine manually for channels not shown.
          </p>
        ) : null}
        {subscriptions.length ? (
          <>
            <div className="form-row">
              <label htmlFor="subscription-search">Filter Subscriptions</label>
              <input
                id="subscription-search"
                className="input"
                value={subscriptionSearch}
                onChange={(event) => setSubscriptionSearch(event.target.value)}
                placeholder="Search title or channel ID"
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Title</th>
                    <th>Channel ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.length ? (
                    filteredSubscriptions.map((subscription) => (
                      <tr key={subscription.channelId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedChannelIds.includes(subscription.channelId)}
                            disabled={subscription.alreadyAdded}
                            onChange={() => toggleSubscriptionSelection(subscription.channelId)}
                          />
                        </td>
                        <td>{subscription.title}</td>
                        <td className="mono">{subscription.channelId}</td>
                        <td>
                          <span
                            className={
                              subscription.alreadyAdded ? "pill pill-ok" : "pill pill-warn"
                            }
                          >
                            {subscription.alreadyAdded ? "Already Added" : "Not Added"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="helper">
                        No subscriptions match your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="helper">Load your subscriptions to select channels for import.</p>
        )}
      </div>

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
            {busy ? "Adding..." : "Add Creator Manually"}
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
