"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { RootRuntimeSnapshot, WorkClaimRecord } from "@/lib/root-system";

type ExecutionControlSurfaceProps = {
  initialSnapshot: RootRuntimeSnapshot;
  mode?: "system" | "claims";
};

type FeedbackState =
  | { tone: "success" | "error"; message: string }
  | null;

type ClaimDraft = {
  title: string;
  taskKey: string;
  repo: string;
  machine: string;
  owner: string;
  notes: string;
};

type HandoffDraft = {
  owner: string;
  machine: string;
  title: string;
  summary: string;
  blockers: string;
  nextActions: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtAge(value: string | null | undefined) {
  if (!value) return "Unknown age";
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

async function readJson(res: Response) {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function buildClaimDraft(snapshot: RootRuntimeSnapshot): ClaimDraft {
  return {
    title: "",
    taskKey: "",
    repo: "contentco-op/monorepo",
    machine: snapshot.work_claims[0]?.machine || "M2",
    owner: snapshot.active_ownership[0]?.owner || snapshot.work_claims[0]?.owner || "Bailey",
    notes: "",
  };
}

function buildHandoffDraft(snapshot: RootRuntimeSnapshot): HandoffDraft {
  return {
    owner: snapshot.active_ownership[0]?.owner || snapshot.work_claims[0]?.owner || "Bailey",
    machine: snapshot.work_claims[0]?.machine || "M2",
    title: "",
    summary: "",
    blockers: "",
    nextActions: "",
  };
}

function buildClaimReleaseDraft(claim: WorkClaimRecord, fallback: HandoffDraft): HandoffDraft {
  return {
    owner: claim.owner || fallback.owner,
    machine: claim.machine || fallback.machine,
    title: `Handoff: ${claim.title}`,
    summary: claim.notes || "",
    blockers: "",
    nextActions: "",
  };
}

export function ExecutionControlSurface({
  initialSnapshot,
  mode = "system",
}: ExecutionControlSurfaceProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [claimDraft, setClaimDraft] = useState(() => buildClaimDraft(initialSnapshot));
  const [handoffDraft, setHandoffDraft] = useState(() => buildHandoffDraft(initialSnapshot));
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const selectedClaim = snapshot.work_claims.find((claim) => claim.id === selectedClaimId) || null;

  async function refreshSnapshot(successMessage?: string) {
    const res = await fetch("/api/root/system", { cache: "no-store" });
    const data = (await readJson(res)) as RootRuntimeSnapshot;
    setSnapshot(data);
    setClaimDraft((current) => ({
      ...current,
      machine: current.machine || data.work_claims[0]?.machine || "M2",
      owner: current.owner || data.active_ownership[0]?.owner || "Bailey",
    }));
    setHandoffDraft((current) => ({
      ...current,
      owner: current.owner || data.active_ownership[0]?.owner || "Bailey",
      machine: current.machine || data.work_claims[0]?.machine || "M2",
    }));
    if (selectedClaimId && !data.work_claims.some((claim) => claim.id === selectedClaimId)) {
      setSelectedClaimId(null);
    }
    if (successMessage) {
      setFeedback({ tone: "success", message: successMessage });
    }
  }

  async function handleClaimSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("claim");
    setFeedback(null);

    try {
      await readJson(
        await fetch("/api/root/work-claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_key: claimDraft.taskKey || slugify(claimDraft.title),
            title: claimDraft.title,
            repo: claimDraft.repo,
            machine: claimDraft.machine,
            owner: claimDraft.owner,
            notes: claimDraft.notes,
          }),
        }),
      );

      setClaimDraft((current) => ({
        ...current,
        title: "",
        taskKey: "",
        notes: "",
      }));

      await refreshSnapshot("Work claim created.");
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to create work claim.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleStandaloneHandoffSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("handoff");
    setFeedback(null);

    try {
      await readJson(
        await fetch("/api/root/handoffs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: handoffDraft.owner,
            machine: handoffDraft.machine,
            title: handoffDraft.title,
            summary: handoffDraft.summary,
            blockers: parseList(handoffDraft.blockers),
            next_actions: parseList(handoffDraft.nextActions),
          }),
        }),
      );

      setHandoffDraft((current) => ({
        ...current,
        title: "",
        summary: "",
        blockers: "",
        nextActions: "",
      }));

      await refreshSnapshot("Handoff note logged.");
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to log handoff note.",
      });
    } finally {
      setBusy(null);
    }
  }

  function prepareRelease(claim: WorkClaimRecord) {
    setSelectedClaimId(claim.id);
    setHandoffDraft((current) => buildClaimReleaseDraft(claim, current));
    setFeedback(null);
  }

  async function releaseSelectedClaim(options: { withHandoff: boolean }) {
    if (!selectedClaim) {
      setFeedback({ tone: "error", message: "Select an active claim before releasing it." });
      return;
    }

    setBusy(options.withHandoff ? "release-with-handoff" : "release");
    setFeedback(null);

    try {
      if (options.withHandoff) {
        await readJson(
          await fetch("/api/root/handoffs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              owner: handoffDraft.owner,
              machine: handoffDraft.machine,
              title: handoffDraft.title,
              summary: handoffDraft.summary,
              blockers: parseList(handoffDraft.blockers),
              next_actions: parseList(handoffDraft.nextActions),
            }),
          }),
        );
      }

      await readJson(
        await fetch(`/api/root/work-claims/${selectedClaim.id}/release`, {
          method: "POST",
        }),
      );

      const nextHandoffDraft = buildHandoffDraft(snapshot);
      setSelectedClaimId(null);
      setHandoffDraft(nextHandoffDraft);
      await refreshSnapshot(options.withHandoff ? "Handoff logged and claim released." : "Claim released.");
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to complete release flow.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={statsGrid}>
        {[
          {
            label: "active claims",
            value: String(snapshot.work_claims.length),
            detail: snapshot.work_claims.length === 1 ? "1 claimed task" : `${snapshot.work_claims.length} claimed tasks`,
          },
          {
            label: "active owners",
            value: String(snapshot.active_ownership.length),
            detail:
              snapshot.active_ownership.length === 0
                ? "No ownership assigned"
                : snapshot.active_ownership.map((owner) => owner.owner).slice(0, 3).join(" · "),
          },
          {
            label: "recent handoffs",
            value: String(snapshot.handoffs.length),
            detail: snapshot.handoffs[0] ? `Last: ${fmtAge(snapshot.handoffs[0].created_at)}` : "No handoffs logged",
          },
          {
            label: "recent releases",
            value: String(snapshot.recent_releases.length),
            detail: snapshot.recent_releases[0] ? `Last: ${fmtAge(snapshot.recent_releases[0].released_at)}` : "No releases yet",
          },
        ].map((item) => (
          <div key={item.label} style={metricCard}>
            <div style={eyebrow}>{item.label}</div>
            <div style={metricValue}>{item.value}</div>
            <div style={metricDetail}>{item.detail}</div>
          </div>
        ))}
      </section>

      {feedback && (
        <div
          style={{
            ...banner,
            borderColor:
              feedback.tone === "success" ? "rgba(89,180,115,0.28)" : "rgba(209,99,91,0.28)",
            background:
              feedback.tone === "success" ? "rgba(89,180,115,0.12)" : "rgba(209,99,91,0.12)",
            color: feedback.tone === "success" ? "#8ed9a4" : "#f1a39d",
          }}
        >
          {feedback.message}
        </div>
      )}

      {mode === "claims" && snapshot.warnings.length > 0 && (
        <div style={{ ...banner, borderColor: "rgba(228,173,91,0.24)", background: "rgba(228,173,91,0.08)", color: "#e4ad5b" }}>
          {snapshot.warnings.join(" · ")}
        </div>
      )}

      <section style={twoColumnGrid}>
        <div style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={eyebrow}>Claim Work</div>
              <h2 style={sectionTitle}>active ownership starts here</h2>
            </div>
            <button
              type="button"
              onClick={() => refreshSnapshot()}
              disabled={busy === "refresh"}
              style={ghostButton}
            >
              {busy === "refresh" ? "refreshing..." : "refresh"}
            </button>
          </div>

          <form onSubmit={handleClaimSubmit} style={formGrid}>
            <label style={fieldLabel}>
              <span style={labelText}>task title</span>
              <input
                value={claimDraft.title}
                onChange={(event) => setClaimDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Execution-control surface"
                style={inputStyle}
                required
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>task key</span>
              <input
                value={claimDraft.taskKey}
                onChange={(event) => setClaimDraft((current) => ({ ...current, taskKey: event.target.value }))}
                placeholder="auto from title"
                style={inputStyle}
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>repo</span>
              <input
                value={claimDraft.repo}
                onChange={(event) => setClaimDraft((current) => ({ ...current, repo: event.target.value }))}
                placeholder="contentco-op/monorepo"
                style={inputStyle}
                required
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>machine</span>
              <input
                value={claimDraft.machine}
                onChange={(event) => setClaimDraft((current) => ({ ...current, machine: event.target.value }))}
                placeholder="M2"
                style={inputStyle}
                required
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>owner</span>
              <input
                value={claimDraft.owner}
                onChange={(event) => setClaimDraft((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Bailey"
                style={inputStyle}
                required
              />
            </label>

            <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
              <span style={labelText}>notes</span>
              <textarea
                value={claimDraft.notes}
                onChange={(event) => setClaimDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Scope, current status, release expectations."
                style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
              />
            </label>

            <button type="submit" disabled={busy === "claim"} style={primaryButton}>
              {busy === "claim" ? "claiming..." : "claim work"}
            </button>
          </form>
        </div>

        <div style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={eyebrow}>Release Flow</div>
              <h2 style={sectionTitle}>handoff before release</h2>
            </div>
            {selectedClaim && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClaimId(null);
                  setHandoffDraft(buildHandoffDraft(snapshot));
                }}
                style={ghostButton}
              >
                clear
              </button>
            )}
          </div>

          <div style={selectedClaim ? selectedClaimCard : emptyPanel}>
            {selectedClaim ? (
              <>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selectedClaim.title}</div>
                  <div style={metaText}>
                    {selectedClaim.task_key} · {selectedClaim.repo} · {selectedClaim.machine} · {selectedClaim.owner}
                  </div>
                  <div style={metaText}>Claimed {fmtDateTime(selectedClaim.claimed_at)}</div>
                </div>
                {selectedClaim.notes && <div style={noteText}>{selectedClaim.notes}</div>}
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700 }}>no claim selected</div>
                <div style={metaText}>Pick an active claim below to log a handoff and release it.</div>
              </>
            )}
          </div>

          <form onSubmit={handleStandaloneHandoffSubmit} style={formGrid}>
            <label style={fieldLabel}>
              <span style={labelText}>owner</span>
              <input
                value={handoffDraft.owner}
                onChange={(event) => setHandoffDraft((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Bailey"
                style={inputStyle}
                required
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>machine</span>
              <input
                value={handoffDraft.machine}
                onChange={(event) => setHandoffDraft((current) => ({ ...current, machine: event.target.value }))}
                placeholder="M2"
                style={inputStyle}
                required
              />
            </label>

            <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
              <span style={labelText}>handoff title</span>
              <input
                value={handoffDraft.title}
                onChange={(event) => setHandoffDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder={selectedClaim ? `Handoff: ${selectedClaim.title}` : "Shift handoff"}
                style={inputStyle}
                required
              />
            </label>

            <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
              <span style={labelText}>summary</span>
              <textarea
                value={handoffDraft.summary}
                onChange={(event) => setHandoffDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder="What changed, what is blocked, and what the next owner should do."
                style={{ ...inputStyle, minHeight: 112, resize: "vertical" }}
                required
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>blockers</span>
              <textarea
                value={handoffDraft.blockers}
                onChange={(event) => setHandoffDraft((current) => ({ ...current, blockers: event.target.value }))}
                placeholder="One per line"
                style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
              />
            </label>

            <label style={fieldLabel}>
              <span style={labelText}>next actions</span>
              <textarea
                value={handoffDraft.nextActions}
                onChange={(event) => setHandoffDraft((current) => ({ ...current, nextActions: event.target.value }))}
                placeholder="One per line"
                style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
              />
            </label>

            <div style={actionRow}>
              <button type="submit" disabled={busy === "handoff"} style={ghostButton}>
                {busy === "handoff" ? "logging..." : "log handoff"}
              </button>
              <button
                type="button"
                disabled={!selectedClaim || busy === "release"}
                onClick={() => releaseSelectedClaim({ withHandoff: false })}
                style={ghostButton}
              >
                {busy === "release" ? "releasing..." : "release only"}
              </button>
              <button
                type="button"
                disabled={!selectedClaim || busy === "release-with-handoff"}
                onClick={() => releaseSelectedClaim({ withHandoff: true })}
                style={primaryButton}
              >
                {busy === "release-with-handoff" ? "logging + releasing..." : "log handoff + release"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section style={twoColumnGrid}>
        <div style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={eyebrow}>Active Ownership</div>
              <h2 style={sectionTitle}>who owns what right now</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {snapshot.active_ownership.length === 0 ? (
              <div style={emptyPanel}>
                <div style={{ fontWeight: 700 }}>no active owners</div>
                <div style={metaText}>Create a work claim to establish active ownership.</div>
              </div>
            ) : (
              snapshot.active_ownership.map((owner) => (
                <div key={owner.owner} style={listRow}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{owner.owner}</div>
                    <div style={metaText}>
                      {owner.claims} active {owner.claims === 1 ? "claim" : "claims"} · {owner.machines.join(", ") || "No machine"}
                    </div>
                    <div style={metaText}>{owner.repos.join(" · ") || "No repo assigned"}</div>
                  </div>
                  <div style={{ ...metaText, textAlign: "right" }}>
                    <div>Oldest {fmtAge(owner.oldest_claimed_at)}</div>
                    <div>Latest {fmtDateTime(owner.latest_claimed_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={eyebrow}>Active Claims</div>
              <h2 style={sectionTitle}>select a claim to prepare release</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {snapshot.work_claims.length === 0 ? (
              <div style={emptyPanel}>
                <div style={{ fontWeight: 700 }}>no active claims</div>
                <div style={metaText}>The execution-control surface is currently clear.</div>
              </div>
            ) : (
              snapshot.work_claims.map((claim) => {
                const isSelected = claim.id === selectedClaimId;
                return (
                  <div key={claim.id} style={{ ...listRow, ...(isSelected ? selectedRow : null) }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>{claim.title}</div>
                      <div style={metaText}>
                        {claim.task_key} · {claim.repo} · {claim.machine} · {claim.owner}
                      </div>
                      <div style={metaText}>Claimed {fmtDateTime(claim.claimed_at)} · {fmtAge(claim.claimed_at)}</div>
                      {claim.notes && <div style={noteText}>{claim.notes}</div>}
                    </div>
                    <button type="button" onClick={() => prepareRelease(claim)} style={ghostButton}>
                      {isSelected ? "prepared" : "prepare release"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section style={twoColumnGrid}>
        <div style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={eyebrow}>Recent Handoffs</div>
              <h2 style={sectionTitle}>most recent context transfers</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {snapshot.handoffs.length === 0 ? (
              <div style={emptyPanel}>
                <div style={{ fontWeight: 700 }}>no handoffs logged</div>
                <div style={metaText}>Use the handoff form to create the first note.</div>
              </div>
            ) : (
              snapshot.handoffs.map((handoff) => (
                <div key={handoff.id} style={listRow}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{handoff.title}</div>
                    <div style={metaText}>
                      {handoff.owner} · {handoff.machine} · {fmtDateTime(handoff.created_at)}
                    </div>
                    <div style={noteText}>{handoff.summary}</div>
                    {handoff.blockers && handoff.blockers.length > 0 && (
                      <div style={metaText}>Blockers: {handoff.blockers.join(" · ")}</div>
                    )}
                    {handoff.next_actions && handoff.next_actions.length > 0 && (
                      <div style={metaText}>Next: {handoff.next_actions.join(" · ")}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={card}>
          <div style={sectionHeader}>
            <div>
              <div style={eyebrow}>Recent Releases</div>
              <h2 style={sectionTitle}>claims cleared from active ownership</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {snapshot.recent_releases.length === 0 ? (
              <div style={emptyPanel}>
                <div style={{ fontWeight: 700 }}>no releases yet</div>
                <div style={metaText}>Released claims will appear here with their final context.</div>
              </div>
            ) : (
              snapshot.recent_releases.map((claim) => (
                <div key={claim.id} style={listRow}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{claim.title}</div>
                    <div style={metaText}>
                      {claim.task_key} · {claim.repo} · {claim.machine} · {claim.owner}
                    </div>
                    <div style={metaText}>Released {fmtDateTime(claim.released_at)} · {fmtAge(claim.released_at)}</div>
                    {claim.notes && <div style={noteText}>{claim.notes}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const twoColumnGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.015))",
  display: "grid",
  gap: 14,
};

const metricCard: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 6,
};

const metricValue: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1.7rem",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "-0.03em",

};

const metricDetail: CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.82rem",
  lineHeight: 1.5,
};

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.62rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--root-accent)",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
};

const sectionTitle: CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-body)",
  fontSize: "1.12rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",

};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelText: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.62rem",
  fontWeight: 600,

  letterSpacing: "0.08em",
  color: "var(--muted)",
};

const inputStyle: CSSProperties = {
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.035)",
  color: "var(--ink)",
  font: "inherit",
};

const primaryButton: CSSProperties = {
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(74,222,128,0.14)",
  color: "var(--root-accent)",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  fontSize: "0.68rem",
  letterSpacing: "0.08em",

  cursor: "pointer",
};

const ghostButton: CSSProperties = {
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.03)",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  fontSize: "0.68rem",
  letterSpacing: "0.08em",

  cursor: "pointer",
};

const actionRow: CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "flex-end",
};

const banner: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid transparent",
  fontSize: "0.88rem",
};

const emptyPanel: CSSProperties = {
  padding: "16px",
  borderRadius: 12,
  border: "1px dashed var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.02)",
  display: "grid",
  gap: 6,
};

const selectedClaimCard: CSSProperties = {
  padding: "16px",
  borderRadius: 12,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(74,222,128,0.08)",
  display: "grid",
  gap: 8,
};

const listRow: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.025)",
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 14,
};

const selectedRow: CSSProperties = {
  borderColor: "var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(74,222,128,0.08)",
};

const metaText: CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.8rem",
  lineHeight: 1.5,
};

const noteText: CSSProperties = {
  fontSize: "0.9rem",
  lineHeight: 1.6,
  color: "var(--ink)",
};
