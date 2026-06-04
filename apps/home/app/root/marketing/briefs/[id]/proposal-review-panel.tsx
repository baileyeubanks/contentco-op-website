"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/pricing";

interface ProposalReviewPanelProps {
  briefId: string;
}

export function ProposalReviewPanel({ briefId }: ProposalReviewPanelProps) {
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetch(`/api/root/marketing/briefs/${briefId}/proposal`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.proposal) {
          setProposal(data.proposal);
          setStatus(String(data.proposal.status || "draft"));
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [briefId]);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/root/marketing/briefs/${briefId}/proposal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", approvedAt: new Date().toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "approve_failed"));
      setStatus("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    setBusy(true);
    setError(null);
    try {
      // Fetch brief to get client email
      const briefRes = await fetch(`/api/cco/briefs/${briefId}`);
      const briefData = await briefRes.json();
      const clientEmail = briefData.person?.email;
      if (!clientEmail) {
        throw new Error("No client email found for this brief");
      }

      const res = await fetch(`/api/root/marketing/briefs/${briefId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: clientEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error || "send_failed"));
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "1rem", color: "var(--root-muted)" }}>Loading proposal…</div>
    );
  }

  if (!proposal) {
    return (
      <div style={{ padding: "1rem", color: "var(--root-muted)" }}>
        No AI proposal found for this brief. The client may not have generated one yet.
      </div>
    );
  }

  const snapshot = (proposal.snapshot || {}) as Record<string, unknown>;
  const aiProposal = snapshot.aiProposal as Record<string, unknown> | undefined;
  const estimate = snapshot.estimate as Record<string, unknown> | undefined;

  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(76,142,245,0.15)",
      background: "rgba(76,142,245,0.03)",
      padding: "18px 20px",
      display: "grid",
      gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700 }}>AI Proposal</span>
        <span style={{
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "4px 10px",
          borderRadius: 999,
          border: status === "approved" ? "1px solid rgba(52,211,153,0.3)" : status === "sent" ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(251,191,36,0.3)",
          color: status === "approved" ? "#6ee7b7" : status === "sent" ? "#93c5fd" : "#fbbf24",
          background: "rgba(255,255,255,0.02)",
        }}>
          {status}
        </span>
      </div>

      {aiProposal ? (
        <div style={{ display: "grid", gap: 10, fontSize: "0.85rem" }}>
          <div>
            <strong style={{ color: "var(--root-fg)" }}>{String(aiProposal.title || "Untitled")}</strong>
          </div>
          <div style={{ color: "var(--root-muted)" }}>
            {String((aiProposal.executiveSummary as string || "")).slice(0, 200)}…
          </div>
          {estimate ? (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>Low: <strong>{formatCurrency(Number(estimate.low || 0))}</strong></span>
              <span>High: <strong>{formatCurrency(Number(estimate.high || 0))}</strong></span>
              <span>Deposit: <strong>{formatCurrency(Number(estimate.deposit || 0))}</strong></span>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ color: "var(--root-muted)", fontSize: "0.85rem" }}>
          Proposal snapshot exists but AI content is not yet generated.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {status !== "approved" && status !== "sent" ? (
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="root-atlas-button root-atlas-button-primary"
          >
            {busy ? "Approving…" : "Approve proposal"}
          </button>
        ) : null}
        {status === "approved" ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="root-atlas-button root-atlas-button-primary"
          >
            {busy ? "Sending…" : "Send to client"}
          </button>
        ) : null}
        <a
          href={`/brief/proposal/${briefId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="root-atlas-button root-atlas-button-secondary"
        >
          Preview public page
        </a>
      </div>

      {error ? (
        <div style={{ fontSize: "0.78rem", color: "#fbbf24" }}>{error}</div>
      ) : null}
    </div>
  );
}
