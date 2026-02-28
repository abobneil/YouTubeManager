"use client";

import { useEffect, useState } from "react";
import type { SyncRunDto } from "@/lib/types";

type RunsPayload = {
  runs: SyncRunDto[];
};

type RunDetailPayload = {
  run: SyncRunDto;
  events: Array<{
    id: string;
    level: string;
    code: string;
    message: string;
    createdAt: string;
    context: unknown;
  }>;
};

function runBadge(status: string): string {
  if (status === "SUCCEEDED") {
    return "pill pill-ok";
  }
  if (status === "PARTIAL" || status === "RUNNING" || status === "SKIPPED_CONCURRENT") {
    return "pill pill-warn";
  }
  return "pill pill-error";
}

export default function SyncRunsPage() {
  const [runs, setRuns] = useState<SyncRunDto[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRunDetail(runId: string) {
    const response = await fetch(`/api/sync/runs/${runId}`, { cache: "no-store" });
    const payload = (await response.json()) as RunDetailPayload & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load run details.");
    }
    setSelectedRun(payload);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sync/runs", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as RunsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load runs.");
        }
        if (!cancelled) {
          setRuns(payload.runs);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel page-card stack">
      <h2 className="page-title">Sync Runs</h2>
      <p className="page-desc">
        Inspect historical sync executions and event logs for errors or quota throttling.
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Started</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Quota Used</th>
              <th>Stats</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {runs.length ? (
              runs.map((run) => (
                <tr key={run.id}>
                  <td className="mono">{new Date(run.startedAt).toLocaleString()}</td>
                  <td>{run.trigger}</td>
                  <td>
                    <span className={runBadge(run.status)}>{run.status}</span>
                  </td>
                  <td>{run.quotaConsumed}</td>
                  <td className="mono">{JSON.stringify(run.stats)}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => loadRunDetail(run.id).catch((detailError) => {
                        setError(detailError instanceof Error ? detailError.message : "Detail failed");
                      })}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="helper">
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRun ? (
        <div className="stack">
          <h3>Run {selectedRun.run.id}</h3>
          <p className="helper">
            Status: <span className="mono">{selectedRun.run.status}</span>
          </p>
          {selectedRun.run.errorSummary ? (
            <p className="error-text">{selectedRun.run.errorSummary}</p>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th>Code</th>
                  <th>Message</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                {selectedRun.events.length ? (
                  selectedRun.events.map((event) => (
                    <tr key={event.id}>
                      <td className="mono">{new Date(event.createdAt).toLocaleString()}</td>
                      <td>{event.level}</td>
                      <td className="mono">{event.code}</td>
                      <td>{event.message}</td>
                      <td className="mono">{JSON.stringify(event.context)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="helper">
                      No events for this run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
