"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RuleReviewPageDto, RuleReviewState, TopicRuleDto } from "@/lib/types";

type RulesPayload = {
  rules: TopicRuleDto[];
};

type MutationPayload = {
  corrected?: string[];
  alreadyExcluded?: string[];
  restored?: string[];
  failed?: Array<{
    videoId: string;
    reason: string;
  }>;
  error?: string;
};

const PAGE_SIZE = 50;

function tabClassName(active: boolean): string {
  return active ? "button button-primary" : "button button-ghost";
}

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rules, setRules] = useState<TopicRuleDto[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [state, setState] = useState<RuleReviewState>(
    searchParams.get("state") === "excluded" ? "excluded" : "active",
  );
  const [page, setPage] = useState<number>(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [review, setReview] = useState<RuleReviewPageDto | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationSummary, setMutationSummary] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rules", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as RulesPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load rules.");
        }
        setRules(payload.rules);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load rules.");
      });
  }, []);

  useEffect(() => {
    if (rules.length === 0) {
      return;
    }

    const deepLinkedRuleId = searchParams.get("ruleId") ?? "";
    const nextRuleId =
      rules.some((rule) => rule.id === deepLinkedRuleId)
        ? deepLinkedRuleId
        : rules.some((rule) => rule.id === selectedRuleId)
          ? selectedRuleId
          : rules[0].id;

    if (nextRuleId !== selectedRuleId) {
      setSelectedRuleId(nextRuleId);
    }
  }, [rules, searchParams, selectedRuleId]);

  useEffect(() => {
    if (!selectedRuleId) {
      return;
    }

    const params = new URLSearchParams({
      ruleId: selectedRuleId,
      state,
      page: String(page),
    });
    router.replace(`/review?${params.toString()}`, { scroll: false });
  }, [page, router, selectedRuleId, state]);

  useEffect(() => {
    if (!selectedRuleId) {
      setReview(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/rules/${selectedRuleId}/review?state=${state}&page=${page}&pageSize=${PAGE_SIZE}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as RuleReviewPageDto & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load review items.");
        }
        setReview(payload);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load review items.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, selectedRuleId, state]);

  const selectedCount = selectedVideoIds.length;
  const totalPages = useMemo(() => {
    if (!review) {
      return 1;
    }
    return Math.max(1, Math.ceil(review.total / review.pageSize));
  }, [review]);

  function toggleVideo(videoId: string) {
    setSelectedVideoIds((current) =>
      current.includes(videoId) ? current.filter((item) => item !== videoId) : [...current, videoId],
    );
  }

  function toggleSelectAll() {
    if (!review) {
      return;
    }
    const pageIds = review.items.map((item) => item.videoId);
    const allSelected = pageIds.every((videoId) => selectedVideoIds.includes(videoId));
    setSelectedVideoIds(allSelected ? selectedVideoIds.filter((id) => !pageIds.includes(id)) : pageIds);
  }

  function changeRule(ruleId: string) {
    setSelectedRuleId(ruleId);
    setPage(1);
    setSelectedVideoIds([]);
    setMutationSummary(null);
  }

  function changeState(nextState: RuleReviewState) {
    setState(nextState);
    setPage(1);
    setSelectedVideoIds([]);
    setMutationSummary(null);
  }

  async function submitBulkAction() {
    if (!selectedRuleId || selectedVideoIds.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMutationSummary(null);

    try {
      const endpoint =
        state === "active"
          ? `/api/rules/${selectedRuleId}/review/correct`
          : `/api/rules/${selectedRuleId}/review/restore`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: selectedVideoIds }),
      });
      const payload = (await response.json()) as MutationPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Bulk action failed.");
      }

      const successfulIds =
        state === "active"
          ? [...(payload.corrected ?? []), ...(payload.alreadyExcluded ?? [])]
          : [...(payload.restored ?? [])];
      const failedIds = new Set((payload.failed ?? []).map((item) => item.videoId));
      setSelectedVideoIds((current) =>
        current.filter((videoId) => !successfulIds.includes(videoId) || failedIds.has(videoId)),
      );

      const summaryParts: string[] = [];
      if (payload.corrected?.length) {
        summaryParts.push(`Removed and excluded ${payload.corrected.length}.`);
      }
      if (payload.alreadyExcluded?.length) {
        summaryParts.push(`${payload.alreadyExcluded.length} already excluded.`);
      }
      if (payload.restored?.length) {
        summaryParts.push(`Restored ${payload.restored.length}.`);
      }
      if (payload.failed?.length) {
        summaryParts.push(`Failed ${payload.failed.length}: ${payload.failed.map((item) => `${item.videoId} (${item.reason})`).join(", ")}`);
      }
      setMutationSummary(summaryParts.join(" "));

      const refresh = await fetch(
        `/api/rules/${selectedRuleId}/review?state=${state}&page=${page}&pageSize=${PAGE_SIZE}`,
        { cache: "no-store" },
      );
      const refreshedPayload = (await refresh.json()) as RuleReviewPageDto & { error?: string };
      if (!refresh.ok) {
        throw new Error(refreshedPayload.error ?? "Failed to refresh review items.");
      }
      setReview(refreshedPayload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Bulk action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel page-card stack">
      <div className="row review-header">
        <div>
          <h2 className="page-title">Rule Review</h2>
          <p className="page-desc">
            Inspect managed playlist entries, remove mistaken matches, and restore manual exclusions.
          </p>
        </div>
        {review?.managedPlaylist ? (
          <a
            className="button button-ghost"
            href={`https://www.youtube.com/playlist?list=${review.managedPlaylist.youtubePlaylistId}`}
            target="_blank"
            rel="noreferrer"
          >
            Open Playlist
          </a>
        ) : null}
      </div>

      <div className="row">
        <div className="form-row" style={{ minWidth: 280, flex: "1 1 280px" }}>
          <label htmlFor="review-rule">Rule</label>
          <select
            id="review-rule"
            className="select"
            value={selectedRuleId}
            onChange={(event) => changeRule(event.target.value)}
            disabled={rules.length === 0}
          >
            {rules.length === 0 ? <option value="">No rules available</option> : null}
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <button type="button" className={tabClassName(state === "active")} onClick={() => changeState("active")}>
            Active
          </button>
          <button
            type="button"
            className={tabClassName(state === "excluded")}
            onClick={() => changeState("excluded")}
          >
            Excluded
          </button>
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          className="button button-ghost"
          onClick={toggleSelectAll}
          disabled={!review?.items.length}
        >
          {review?.items.length && review.items.every((item) => selectedVideoIds.includes(item.videoId))
            ? "Clear Page"
            : "Select Page"}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={submitBulkAction}
          disabled={submitting || selectedCount === 0}
        >
          {submitting
            ? "Working..."
            : state === "active"
              ? `Exclude + Remove (${selectedCount})`
              : `Allow Again (${selectedCount})`}
        </button>
        {review ? <span className="helper">Showing {review.total} total items.</span> : null}
      </div>

      {mutationSummary ? <p className="success-text">{mutationSummary}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="helper">Loading review items...</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={Boolean(review?.items.length) && Boolean(review?.items.every((item) => selectedVideoIds.includes(item.videoId)))}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Video</th>
              <th>Published</th>
              <th>Matched</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {review?.items.length ? (
              review.items.map((item) => (
                <tr key={item.videoId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.includes(item.videoId)}
                      onChange={() => toggleVideo(item.videoId)}
                    />
                  </td>
                  <td>
                    <div className="review-video">
                      <div className="review-thumb-wrap">
                        {item.thumbnailUrl ? (
                          <div
                            className="review-thumb"
                            style={{ backgroundImage: `url(${item.thumbnailUrl})` }}
                            aria-hidden="true"
                          />
                        ) : (
                          <div className="review-thumb review-thumb-fallback">No Image</div>
                        )}
                      </div>
                      <div className="stack" style={{ gap: 4 }}>
                        <a href={item.videoUrl} target="_blank" rel="noreferrer">
                          {item.title}
                        </a>
                        <span className="helper">{item.channelTitle}</span>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{new Date(item.publishedAt).toLocaleString()}</td>
                  <td className="mono">{item.matchedAt ? new Date(item.matchedAt).toLocaleString() : "-"}</td>
                  <td>
                    <div className="stack" style={{ gap: 6 }}>
                      <span className={item.excluded ? "pill pill-warn" : "pill pill-ok"}>
                        {item.excluded ? "Excluded" : item.membershipStatus ?? "Tracked"}
                      </span>
                      {item.removedAt ? (
                        <span className="helper">Removed {new Date(item.removedAt).toLocaleString()}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <a className="button button-ghost" href={item.videoUrl} target="_blank" rel="noreferrer">
                      Open Video
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="helper">
                  {selectedRuleId ? "No review items for this filter." : "Select a rule to review."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row">
        <button
          type="button"
          className="button button-ghost"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="helper">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </section>
  );
}
