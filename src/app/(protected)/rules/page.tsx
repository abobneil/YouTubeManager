"use client";

import { MatchFields, OrderMode, PrivacyStatus } from "@prisma/client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CreatorDto, TopicRuleDto } from "@/lib/types";

type RulesPayload = {
  rules: TopicRuleDto[];
};

type CreatorsPayload = {
  creators: CreatorDto[];
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function RulesPage() {
  const [rules, setRules] = useState<TopicRuleDto[]>([]);
  const [creators, setCreators] = useState<CreatorDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [matchFields, setMatchFields] = useState<MatchFields>(MatchFields.BOTH);
  const [orderMode, setOrderMode] = useState<OrderMode>(OrderMode.NEWEST);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>(PrivacyStatus.PRIVATE);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [creatorScopeIds, setCreatorScopeIds] = useState<string[]>([]);

  async function load() {
    const [rulesResponse, creatorsResponse] = await Promise.all([
      fetch("/api/rules", { cache: "no-store" }),
      fetch("/api/creators", { cache: "no-store" }),
    ]);
    const rulesPayload = (await rulesResponse.json()) as RulesPayload & { error?: string };
    const creatorsPayload = (await creatorsResponse.json()) as CreatorsPayload & { error?: string };
    if (!rulesResponse.ok) {
      throw new Error(rulesPayload.error ?? "Failed to load rules.");
    }
    if (!creatorsResponse.ok) {
      throw new Error(creatorsPayload.error ?? "Failed to load creators.");
    }
    setRules(rulesPayload.rules);
    setCreators(creatorsPayload.creators);
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Load failed"));
  }, []);

  const creatorMap = useMemo(
    () => new Map(creators.map((creator) => [creator.id, creator.displayName])),
    [creators],
  );

  function toggleCreatorScope(creatorId: string) {
    setCreatorScopeIds((current) =>
      current.includes(creatorId)
        ? current.filter((item) => item !== creatorId)
        : [...current, creatorId],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          includeKeywords: parseKeywords(includeKeywords),
          excludeKeywords: parseKeywords(excludeKeywords),
          matchFields,
          caseSensitive,
          orderMode,
          privacyStatus,
          creatorScopeIds,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create rule.");
      }
      setName("");
      setIncludeKeywords("");
      setExcludeKeywords("");
      setCaseSensitive(false);
      setCreatorScopeIds([]);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(rule: TopicRuleDto) {
    const response = await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to update rule.");
      return;
    }
    await load();
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm("Delete this rule?")) {
      return;
    }
    const response = await fetch(`/api/rules/${ruleId}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to delete rule.");
      return;
    }
    await load();
  }

  return (
    <section className="panel page-card stack">
      <h2 className="page-title">Topic Rules</h2>
      <p className="page-desc">
        Rules use include/exclude keywords and optional creator scope. Matches can flow to multiple playlists.
      </p>
      {error ? <p className="error-text">{error}</p> : null}

      <form className="stack" onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="rule-name">Rule Name</label>
          <input
            id="rule-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="StarCraft"
          />
        </div>
        <div className="form-row">
          <label htmlFor="include-keywords">Include Keywords (comma or newline separated)</label>
          <textarea
            id="include-keywords"
            className="textarea"
            value={includeKeywords}
            onChange={(event) => setIncludeKeywords(event.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="exclude-keywords">Exclude Keywords (optional)</label>
          <textarea
            id="exclude-keywords"
            className="textarea"
            value={excludeKeywords}
            onChange={(event) => setExcludeKeywords(event.target.value)}
          />
        </div>
        <div className="row">
          <div className="form-row" style={{ minWidth: 180 }}>
            <label htmlFor="match-fields">Match Fields</label>
            <select
              id="match-fields"
              className="select"
              value={matchFields}
              onChange={(event) => setMatchFields(event.target.value as MatchFields)}
            >
              <option value={MatchFields.BOTH}>Title + Description</option>
              <option value={MatchFields.TITLE}>Title Only</option>
              <option value={MatchFields.DESCRIPTION}>Description Only</option>
            </select>
          </div>
          <div className="form-row" style={{ minWidth: 180 }}>
            <label htmlFor="order-mode">Order Mode</label>
            <select
              id="order-mode"
              className="select"
              value={orderMode}
              onChange={(event) => setOrderMode(event.target.value as OrderMode)}
            >
              <option value={OrderMode.NEWEST}>Newest First</option>
              <option value={OrderMode.OLDEST}>Oldest First</option>
            </select>
          </div>
          <div className="form-row" style={{ minWidth: 180 }}>
            <label htmlFor="privacy-status">Privacy</label>
            <select
              id="privacy-status"
              className="select"
              value={privacyStatus}
              onChange={(event) => setPrivacyStatus(event.target.value as PrivacyStatus)}
            >
              <option value={PrivacyStatus.PRIVATE}>Private</option>
              <option value={PrivacyStatus.UNLISTED}>Unlisted</option>
            </select>
          </div>
        </div>
        <div className="row">
          <label>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />{" "}
            Case Sensitive Matching
          </label>
        </div>
        <div className="form-row">
          <label>Creator Scope (optional)</label>
          <div className="row">
            {creators.map((creator) => (
              <label key={creator.id} className="helper">
                <input
                  type="checkbox"
                  checked={creatorScopeIds.includes(creator.id)}
                  onChange={() => toggleCreatorScope(creator.id)}
                />{" "}
                {creator.displayName}
              </label>
            ))}
          </div>
        </div>
        <div className="row">
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? "Saving..." : "Create Rule"}
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Include</th>
              <th>Exclude</th>
              <th>Scope</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length ? (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.includeKeywords.join(", ")}</td>
                  <td>{rule.excludeKeywords.join(", ") || "-"}</td>
                  <td>
                    {rule.creatorScopeIds.length
                      ? rule.creatorScopeIds.map((id) => creatorMap.get(id) ?? id).join(", ")
                      : "All creators"}
                  </td>
                  <td>{rule.orderMode}</td>
                  <td>
                    <span className={rule.active ? "pill pill-ok" : "pill pill-warn"}>
                      {rule.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <button type="button" className="button button-ghost" onClick={() => toggleActive(rule)}>
                        {rule.active ? "Pause" : "Activate"}
                      </button>
                      <button type="button" className="button button-danger" onClick={() => deleteRule(rule.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="helper">
                  No rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
