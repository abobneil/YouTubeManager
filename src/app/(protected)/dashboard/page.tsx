"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardPayload = {
  creatorCount: number;
  ruleCount: number;
  latestRun: {
    id: string;
    status: string;
    trigger: string;
    startedAt: string;
    endedAt: string | null;
    quotaConsumed: number;
  } | null;
  nextScheduledRunAt: string;
  recentEvents: Array<{
    id: string;
    level: string;
    code: string;
    message: string;
    createdAt: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load dashboard.");
    }
    const payload = (await response.json()) as DashboardPayload;
    setData(payload);
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Load failed"));
    const interval = setInterval(() => {
      load().catch(() => {
        // best-effort polling
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function queueManualSync() {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/sync/manual", { method: "POST" });
      const payload = (await response.json()) as { requestId?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to queue sync");
      }
      setSyncMessage(`Manual sync queued. Request ID: ${payload.requestId}`);
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Manual sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const latestRunBadge = useMemo(() => {
    if (!data?.latestRun) {
      return { text: "No runs yet", className: "pill pill-warn" };
    }
    if (data.latestRun.status === "SUCCEEDED") {
      return { text: "Succeeded", className: "pill pill-ok" };
    }
    if (data.latestRun.status === "PARTIAL") {
      return { text: "Partial", className: "pill pill-warn" };
    }
    if (data.latestRun.status === "RUNNING") {
      return { text: "Running", className: "pill pill-warn" };
    }
    return { text: data.latestRun.status, className: "pill pill-error" };
  }, [data?.latestRun]);

  return (
    <section className="panel page-card stack">
      <h2 className="page-title">Dashboard</h2>
      <p className="page-desc">
        View sync health, queue manual runs, and monitor recent system events.
      </p>
      <div className="row">
        <button type="button" className="button button-primary" onClick={queueManualSync} disabled={syncing}>
          {syncing ? "Queuing..." : "Sync Now"}
        </button>
        {syncMessage ? <span className="success-text mono">{syncMessage}</span> : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Active Creators</div>
          <div className="stat-value">{data?.creatorCount ?? "-"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active Rules</div>
          <div className="stat-value">{data?.ruleCount ?? "-"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Latest Run</div>
          <div className="row">
            <span className={latestRunBadge.className}>{latestRunBadge.text}</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Next Scheduled Sync (UTC)</div>
          <div className="stat-value mono" style={{ fontSize: "0.95rem" }}>
            {data ? new Date(data.nextScheduledRunAt).toLocaleString() : "-"}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Level</th>
              <th>Code</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {data?.recentEvents.length ? (
              data.recentEvents.map((event) => (
                <tr key={event.id}>
                  <td className="mono">{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.level}</td>
                  <td className="mono">{event.code}</td>
                  <td>{event.message}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="helper">
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
