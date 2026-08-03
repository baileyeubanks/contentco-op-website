"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OsStatusPill } from "@/app/os/components/os-status-pill";
import type { RootAgentRecord, RootGoalWorkspace, RootSwarmScope } from "@/lib/os-goals";
import styles from "./page.module.css";

type GoalSummary = Pick<RootGoalWorkspace["summary"], "goals" | "active_goals" | "blocked_goals" | "runtime_sensitive_goals">;

type Props = {
  initialAgents: {
    agents: RootAgentRecord[];
    source: { mode: "table" | "projection"; table: string | null; reason: string | null };
    summary: {
      agents: number;
      active_agents: number;
    };
  };
  goalSummary: GoalSummary;
};

const SCOPE_FILTERS: Array<{ label: string; value: "ALL" | RootSwarmScope }> = [
  { label: "All", value: "ALL" },
  { label: "ACS", value: "ACS" },
  { label: "CCO", value: "CCO" },
  { label: "Shared", value: "SHARED" },
];

const STATUS_FILTERS: Array<{ label: string; value: RootAgentRecord["status"] | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Blocked", value: "blocked" },
  { label: "Idle", value: "idle" },
  { label: "Offline", value: "offline" },
];

function formatDate(value: string | null) {
  if (!value) return "not set";
  return new Date(value).toLocaleString();
}

function scopeLabel(scope: RootSwarmScope) {
  return scope === "SHARED" ? "Shared" : scope;
}

export function AgentsClient({
  initialAgents,
  goalSummary,
}: Props) {
  const [workspace, setWorkspace] = useState(initialAgents);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | RootSwarmScope>("ALL");
  const [statusFilter, setStatusFilter] = useState<RootAgentRecord["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialAgents.agents[0]?.id || null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    business_scope: "SHARED",
    owner_type: "agent",
    approval_policy: "review",
    runtime_sensitive: false,
    target_surface: "Root",
    priority: "3",
    status: "idle",
    capabilities: "",
    summary: "",
    notes: "",
  });

  const filteredAgents = useMemo(() => {
    return workspace.agents.filter((agent) => {
      if (scopeFilter !== "ALL" && agent.business_scope !== scopeFilter) return false;
      if (statusFilter !== "all" && agent.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          agent.name,
          agent.summary,
          agent.target_surface,
          agent.capabilities.join(" "),
          agent.notes || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [workspace.agents, scopeFilter, statusFilter, search]);

  const selectedAgent = filteredAgents.find((agent) => agent.id === selectedId) || filteredAgents[0] || null;

  useEffect(() => {
    if (selectedAgent && filteredAgents.some((agent) => agent.id === selectedAgent.id)) return;
    setSelectedId(filteredAgents[0]?.id || null);
  }, [filteredAgents, selectedAgent]);

  async function refreshAgents() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/os/agents?limit=48", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setWorkspace({
          agents: data.agents || [],
          summary: data.summary || initialAgents.summary,
          source: data.source || initialAgents.source,
        });
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function createAgent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/os/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name,
          runtime_sensitive: form.runtime_sensitive,
          priority: Number(form.priority || 3),
          capabilities: form.capabilities,
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.agent?.id) setSelectedId(data.agent.id);
      await refreshAgents();
      setForm((current) => ({
        ...current,
        name: "",
        capabilities: "",
        summary: "",
        notes: "",
      }));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Swarm operators</p>
          <h1 className={styles.title}>Agent registry and bounded execution.</h1>
          <p className={styles.subtitle}>
            Register agents, constrain runtime-sensitive work, and keep ACS / CCO / shared ownership visible
            inside Root.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link href="/os/goals" className={styles.secondaryAction}>
            Goals
          </Link>
          <Link href="/os/work-claims" className={styles.secondaryAction}>
            Work claims
          </Link>
          <button type="button" className={styles.primaryAction} onClick={() => void refreshAgents()}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Agents</span>
          <strong className={styles.metricValue}>{workspace.summary.agents}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Active agents</span>
          <strong className={styles.metricValue}>{workspace.summary.active_agents}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Goals in queue</span>
          <strong className={styles.metricValue}>{goalSummary.goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Active goals</span>
          <strong className={styles.metricValue}>{goalSummary.active_goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Blocked goals</span>
          <strong className={styles.metricValue}>{goalSummary.blocked_goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Runtime-sensitive</span>
          <strong className={styles.metricValue}>{goalSummary.runtime_sensitive_goals}</strong>
        </article>
      </section>

      <section className={styles.rail}>
        <span className={styles.metaPill}>agents · {workspace.source.mode}</span>
        <span className={styles.metaPill}>agent source · {workspace.source.table || "projection"}</span>
        {workspace.source.reason ? <span className={styles.metaPill}>fallback · {workspace.source.reason}</span> : null}
      </section>

      <section className={styles.workspace}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Agent roster</p>
              <h2 className={styles.panelTitle}>Bounded swarm registry</h2>
            </div>
            <div className={styles.filterRow}>
              {SCOPE_FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  className={[styles.filterChip, scopeFilter === filter.value ? styles.filterChipActive : ""].join(" ")}
                  onClick={() => setScopeFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.toolbar}>
            {STATUS_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={[styles.toolbarChip, statusFilter === filter.value ? styles.toolbarChipActive : ""].join(" ")}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
            <input
              className={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agent, surface, capability, notes..."
            />
          </div>

          <div className={styles.list}>
            {filteredAgents.length === 0 ? (
              <div className={styles.empty}>No agents match the current filters.</div>
            ) : (
              filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={[styles.agentCard, selectedAgent?.id === agent.id ? styles.agentCardSelected : ""].join(" ")}
                  onClick={() => setSelectedId(agent.id)}
                >
                  <div className={styles.goalCardTop}>
                    <strong>{agent.name}</strong>
                    <span className={styles.scopeTag}>{scopeLabel(agent.business_scope)}</span>
                  </div>
                  <p>{agent.summary}</p>
                  <div className={styles.chipRow}>
                    <OsStatusPill>{agent.status}</OsStatusPill>
                    <OsStatusPill>{agent.approval_policy}</OsStatusPill>
                    <OsStatusPill>{agent.runtime_sensitive ? "runtime-sensitive" : "static"}</OsStatusPill>
                    <OsStatusPill>{`p${agent.priority}`}</OsStatusPill>
                  </div>
                  <div className={styles.goalMeta}>
                    <span>{agent.target_surface}</span>
                    <span>{agent.active_goal_count} goals</span>
                    <span>{agent.active_claim_count} claims</span>
                    <span>{formatDate(agent.last_seen_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </article>

        <aside className={styles.side}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Create agent</p>
                <h2 className={styles.panelTitle}>Register a bounded operator</h2>
              </div>
            </div>
            <form className={styles.form} onSubmit={createAgent}>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Hermes runtime agent"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Business scope</span>
                <select
                  className={styles.input}
                  value={form.business_scope}
                  onChange={(e) => setForm((current) => ({ ...current, business_scope: e.target.value }))}
                >
                  <option value="ACS">ACS</option>
                  <option value="CCO">CCO</option>
                  <option value="SHARED">Shared</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Target surface</span>
                <input
                  className={styles.input}
                  value={form.target_surface}
                  onChange={(e) => setForm((current) => ({ ...current, target_surface: e.target.value }))}
                  placeholder="/os/goals"
                />
              </label>
              <label className={styles.field}>
                <span>Capabilities</span>
                <input
                  className={styles.input}
                  value={form.capabilities}
                  onChange={(e) => setForm((current) => ({ ...current, capabilities: e.target.value }))}
                  placeholder="dispatch, review, publish"
                />
              </label>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>Owner type</span>
                  <select
                    className={styles.input}
                    value={form.owner_type}
                    onChange={(e) => setForm((current) => ({ ...current, owner_type: e.target.value }))}
                  >
                    <option value="agent">Agent</option>
                    <option value="system">System</option>
                    <option value="human">Human</option>
                    <option value="team">Team</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Priority</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    max={5}
                    value={form.priority}
                    onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))}
                  />
                </label>
              </div>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>Approval policy</span>
                  <select
                    className={styles.input}
                    value={form.approval_policy}
                    onChange={(e) => setForm((current) => ({ ...current, approval_policy: e.target.value }))}
                  >
                    <option value="review">Review</option>
                    <option value="approval_required">Approval required</option>
                    <option value="operator_only">Operator only</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <select
                    className={styles.input}
                    value={form.status}
                    onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
                  >
                    <option value="idle">Idle</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>
              </div>
              <div className={styles.fieldInline}>
                <span>Runtime sensitive</span>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={form.runtime_sensitive}
                  onChange={(e) => setForm((current) => ({ ...current, runtime_sensitive: e.target.checked }))}
                />
              </div>
              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  className={styles.textarea}
                  value={form.summary}
                  onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))}
                  placeholder="What does this agent do?"
                  rows={4}
                />
              </label>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  className={styles.textarea}
                  value={form.notes}
                  onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="Optional guardrails, constraints, or runtime notes."
                  rows={3}
                />
              </label>
              <button type="submit" className={styles.primaryAction} disabled={creating}>
                {creating ? "Creating..." : "Create agent"}
              </button>
            </form>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Agent detail</p>
                <h2 className={styles.panelTitle}>{selectedAgent?.name || "Select an agent"}</h2>
              </div>
            </div>
            {selectedAgent ? (
              <div className={styles.detail}>
                <div className={styles.chipRow}>
                  <OsStatusPill>{selectedAgent.business_scope}</OsStatusPill>
                  <OsStatusPill>{selectedAgent.status}</OsStatusPill>
                  <OsStatusPill>{selectedAgent.approval_policy}</OsStatusPill>
                  <OsStatusPill>{selectedAgent.source}</OsStatusPill>
                </div>
                <div className={styles.detailGrid}>
                  <div>
                    <span className={styles.detailLabel}>Summary</span>
                    <p>{selectedAgent.summary}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Target surface</span>
                    <p>{selectedAgent.target_surface}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Owner type</span>
                    <p>{selectedAgent.owner_type}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Priority</span>
                    <p>{selectedAgent.priority}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Goals / claims</span>
                    <p>
                      {selectedAgent.active_goal_count} goals · {selectedAgent.active_claim_count} claims
                    </p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Last seen</span>
                    <p>{formatDate(selectedAgent.last_seen_at)}</p>
                  </div>
                </div>
                <div className={styles.capabilityRow}>
                  {selectedAgent.capabilities.length > 0 ? (
                    selectedAgent.capabilities.map((capability) => (
                      <span key={capability} className={styles.scopeTag}>
                        {capability}
                      </span>
                    ))
                  ) : (
                    <span className={styles.scopeTag}>No capabilities recorded</span>
                  )}
                </div>
                {selectedAgent.notes ? (
                  <div className={styles.noteBlock}>
                    <span className={styles.detailLabel}>Notes</span>
                    <p>{selectedAgent.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.empty}>No agent selected.</div>
            )}
          </article>
        </aside>
      </section>
    </div>
  );
}
