"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RootStatusPill } from "@/app/root/components/root-status-pill";
import type { RootAgentRecord, RootGoalRecord, RootGoalSourceReport, RootSwarmScope } from "@/lib/root-goals";
import styles from "./page.module.css";

type Props = {
  initialGoals: {
    goals: RootGoalRecord[];
    source: RootGoalSourceReport;
    summary: {
      goals: number;
      active_goals: number;
      blocked_goals: number;
      runtime_sensitive_goals: number;
    };
  };
  initialAgents: {
    agents: RootAgentRecord[];
    source: RootGoalSourceReport;
    summary: {
      agents: number;
      active_agents: number;
    };
  };
};

type GoalStatusFilter = "all" | RootGoalRecord["status"];

const SCOPE_FILTERS: Array<{ label: string; value: "ALL" | RootSwarmScope }> = [
  { label: "All", value: "ALL" },
  { label: "ACS", value: "ACS" },
  { label: "CCO", value: "CCO" },
  { label: "Shared", value: "SHARED" },
];

const STATUS_FILTERS: Array<{ label: string; value: GoalStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Blocked", value: "blocked" },
  { label: "Planned", value: "planned" },
  { label: "Paused", value: "paused" },
  { label: "Done", value: "done" },
];

function formatDate(value: string | null) {
  if (!value) return "not set";
  return new Date(value).toLocaleString();
}

function scopeLabel(scope: RootSwarmScope) {
  return scope === "SHARED" ? "Shared" : scope;
}

export function GoalsClient({
  initialGoals,
  initialAgents,
}: Props) {
  const [workspace, setWorkspace] = useState(initialGoals);
  const [agentWorkspace, setAgentWorkspace] = useState(initialAgents);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | RootSwarmScope>("ALL");
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialGoals.goals[0]?.id || null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchNote, setDispatchNote] = useState<string | null>(null);
  const [form, setForm] = useState({
    goal: "",
    business_scope: "SHARED",
    success_criteria: "",
    priority: "3",
    target_surface: "Root",
    deadline: "",
    approval_policy: "review",
    runtime_sensitive: false,
    owner_type: "human",
    owner: "",
    status: "planned",
    notes: "",
  });

  const filteredGoals = useMemo(() => {
    return workspace.goals.filter((goal) => {
      if (scopeFilter !== "ALL" && goal.business_scope !== scopeFilter) return false;
      if (statusFilter !== "all" && goal.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          goal.goal,
          goal.success_criteria,
          goal.target_surface,
          goal.owner || "",
          goal.notes || "",
          goal.business_scope,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [workspace.goals, scopeFilter, statusFilter, search]);

  const selectedGoal = filteredGoals.find((goal) => goal.id === selectedId) || filteredGoals[0] || null;

  useEffect(() => {
    if (selectedGoal && filteredGoals.some((goal) => goal.id === selectedGoal.id)) return;
    setSelectedId(filteredGoals[0]?.id || null);
  }, [filteredGoals, selectedGoal]);

  async function refreshGoals() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/root/goals?limit=100", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setWorkspace({
          goals: data.goals || [],
          summary: data.summary || initialGoals.summary,
          source: data.source || initialGoals.source,
        });
        if (data.goals?.[0]?.id) setSelectedId((current) => current || data.goals[0].id);
      }
      const agentResponse = await fetch("/api/root/agents?limit=24", { cache: "no-store" });
      const agentData = await agentResponse.json();
      if (agentResponse.ok) {
        setAgentWorkspace({
          agents: agentData.agents || [],
          summary: agentData.summary || initialAgents.summary,
          source: agentData.source || initialAgents.source,
        });
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/root/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          goal: form.goal || form.success_criteria || form.target_surface,
          runtime_sensitive: form.runtime_sensitive,
          priority: Number(form.priority || 3),
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.goal?.id) setSelectedId(data.goal.id);
      await refreshGoals();
      setForm((current) => ({
        ...current,
        goal: "",
        success_criteria: "",
        notes: "",
      }));
    } finally {
      setCreating(false);
    }
  }

  async function dispatchGoal() {
    if (!selectedGoal) return;
    setDispatching(true);
    setDispatchNote(null);
    try {
      const response = await fetch(`/api/root/goals/${selectedGoal.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDispatchNote(String(data.error || "Dispatch failed"));
        return;
      }
      setDispatchNote(
        data.mode === "event_fallback"
          ? `Dispatch recorded as an event fallback for ${selectedGoal.goal}.`
          : `Dispatch created for ${selectedGoal.goal} on ${data.dispatch?.machine || "M2"}.`,
      );
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Bounded swarm</p>
          <h1 className={styles.title}>Goals and agent ownership.</h1>
          <p className={styles.subtitle}>
            A controlled Root surface for goal dispatch, agent registration, runtime-sensitive work, and
            disjoint ACS / CCO / shared ownership.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link href="/root/work-claims" className={styles.secondaryAction}>
            Work claims
          </Link>
          <Link href="/root/handoffs" className={styles.secondaryAction}>
            Handoffs
          </Link>
          <button type="button" className={styles.primaryAction} onClick={() => void refreshGoals()}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Goals</span>
          <strong className={styles.metricValue}>{workspace.summary.goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Active</span>
          <strong className={styles.metricValue}>{workspace.summary.active_goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Blocked</span>
          <strong className={styles.metricValue}>{workspace.summary.blocked_goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Runtime-sensitive</span>
          <strong className={styles.metricValue}>{workspace.summary.runtime_sensitive_goals}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Agents</span>
          <strong className={styles.metricValue}>{agentWorkspace.summary.agents}</strong>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Active agents</span>
          <strong className={styles.metricValue}>{agentWorkspace.summary.active_agents}</strong>
        </article>
      </section>

      <section className={styles.rail}>
        <span className={styles.metaPill}>goals · {workspace.source.mode}</span>
        <span className={styles.metaPill}>agents · {agentWorkspace.source.mode}</span>
        <span className={styles.metaPill}>goal source · {workspace.source.table || "projection"}</span>
        <span className={styles.metaPill}>agent source · {agentWorkspace.source.table || "projection"}</span>
        {workspace.source.reason ? <span className={styles.metaPill}>fallback · {workspace.source.reason}</span> : null}
      </section>

      <section className={styles.workspace}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Goal queue</p>
              <h2 className={styles.panelTitle}>Dispatchable swarm goals</h2>
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
              placeholder="Search goal, surface, owner, notes..."
            />
          </div>

          <div className={styles.list}>
            {filteredGoals.length === 0 ? (
              <div className={styles.empty}>No goals match the current filters.</div>
            ) : (
              filteredGoals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  className={[styles.goalCard, selectedGoal?.id === goal.id ? styles.goalCardSelected : ""].join(" ")}
                  onClick={() => setSelectedId(goal.id)}
                >
                  <div className={styles.goalCardTop}>
                    <strong>{goal.goal}</strong>
                    <span className={styles.scopeTag}>{scopeLabel(goal.business_scope)}</span>
                  </div>
                  <p>{goal.success_criteria}</p>
                  <div className={styles.chipRow}>
                    <RootStatusPill>{goal.status}</RootStatusPill>
                    <RootStatusPill>{goal.approval_policy}</RootStatusPill>
                    <RootStatusPill>{goal.runtime_sensitive ? "runtime-sensitive" : "static"}</RootStatusPill>
                    <RootStatusPill>{`p${goal.priority}`}</RootStatusPill>
                  </div>
                  <div className={styles.goalMeta}>
                    <span>{goal.target_surface}</span>
                    <span>{goal.owner || "unassigned"}</span>
                    <span>{formatDate(goal.deadline)}</span>
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
                <p className={styles.panelKicker}>Create goal</p>
                <h2 className={styles.panelTitle}>Bounded work dispatch</h2>
              </div>
            </div>
            <form className={styles.form} onSubmit={createGoal}>
              <label className={styles.field}>
                <span>Goal</span>
                <input
                  className={styles.input}
                  value={form.goal}
                  onChange={(e) => setForm((current) => ({ ...current, goal: e.target.value }))}
                  placeholder="Keep runtime solid"
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
                  placeholder="/root/work-claims"
                />
              </label>
              <label className={styles.field}>
                <span>Success criteria</span>
                <textarea
                  className={styles.textarea}
                  value={form.success_criteria}
                  onChange={(e) => setForm((current) => ({ ...current, success_criteria: e.target.value }))}
                  placeholder="What must be true when this is complete?"
                  rows={4}
                />
              </label>
              <div className={styles.twoCol}>
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
                <label className={styles.field}>
                  <span>Deadline</span>
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={form.deadline}
                    onChange={(e) => setForm((current) => ({ ...current, deadline: e.target.value }))}
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
                  <span>Owner type</span>
                  <select
                    className={styles.input}
                    value={form.owner_type}
                    onChange={(e) => setForm((current) => ({ ...current, owner_type: e.target.value }))}
                  >
                    <option value="human">Human</option>
                    <option value="agent">Agent</option>
                    <option value="system">System</option>
                    <option value="team">Team</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
              </div>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>Runtime sensitive</span>
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    checked={form.runtime_sensitive}
                    onChange={(e) => setForm((current) => ({ ...current, runtime_sensitive: e.target.checked }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Owner</span>
                  <input
                    className={styles.input}
                    value={form.owner}
                    onChange={(e) => setForm((current) => ({ ...current, owner: e.target.value }))}
                    placeholder="Bailey / Hermes / agent name"
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea
                  className={styles.textarea}
                  value={form.notes}
                  onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="Optional context, blockers, or implementation notes."
                  rows={3}
                />
              </label>
              <button type="submit" className={styles.primaryAction} disabled={creating}>
                {creating ? "Creating..." : "Create goal"}
              </button>
            </form>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Goal detail</p>
                <h2 className={styles.panelTitle}>{selectedGoal?.goal || "Select a goal"}</h2>
              </div>
            </div>
            {selectedGoal ? (
              <div className={styles.detail}>
                <div className={styles.chipRow}>
                  <RootStatusPill>{selectedGoal.business_scope}</RootStatusPill>
                  <RootStatusPill>{selectedGoal.status}</RootStatusPill>
                  <RootStatusPill>{selectedGoal.approval_policy}</RootStatusPill>
                  <RootStatusPill>{selectedGoal.source}</RootStatusPill>
                </div>
                <div className={styles.detailGrid}>
                  <div>
                    <span className={styles.detailLabel}>Success criteria</span>
                    <p>{selectedGoal.success_criteria}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Target surface</span>
                    <p>{selectedGoal.target_surface}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Owner</span>
                    <p>{selectedGoal.owner || "unassigned"}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Owner type</span>
                    <p>{selectedGoal.owner_type}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Deadline</span>
                    <p>{formatDate(selectedGoal.deadline)}</p>
                  </div>
                  <div>
                    <span className={styles.detailLabel}>Updated</span>
                    <p>{formatDate(selectedGoal.updated_at || selectedGoal.created_at)}</p>
                  </div>
                </div>
                {selectedGoal.notes ? (
                  <div className={styles.noteBlock}>
                    <span className={styles.detailLabel}>Notes</span>
                    <p>{selectedGoal.notes}</p>
                  </div>
                ) : null}
                <div className={styles.chipRow}>
                  <button type="button" className={styles.primaryAction} disabled={dispatching} onClick={() => void dispatchGoal()}>
                    {dispatching ? "Dispatching..." : "Dispatch goal"}
                  </button>
                </div>
                {dispatchNote ? <div className={styles.noteBlock}><p>{dispatchNote}</p></div> : null}
              </div>
            ) : (
              <div className={styles.empty}>No goal selected.</div>
            )}
          </article>
        </aside>
      </section>
    </div>
  );
}
