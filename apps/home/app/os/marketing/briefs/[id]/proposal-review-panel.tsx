"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/pricing";

interface ProposalReviewPanelProps {
  briefId: string;
}

export function ProposalReviewPanel({ briefId }: ProposalReviewPanelProps) {
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetch(`/api/os/marketing/briefs/${briefId}/proposal`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.proposal) {
          setProposal(data.proposal);
          setStatus(String(data.proposal.status || "draft"));
        } else {
          setError(String(data?.error || "proposal_not_found"));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("proposal_lookup_failed");
        setLoading(false);
      });
  }, [briefId]);

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
          border: "1px solid rgba(251,191,36,0.3)",
          color: "#fbbf24",
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

      <div style={{ color: "var(--root-muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
        This is the durable client-preview record. Public proposal access is capability-bound; commercial approval, client delivery, and payment use the canonical CCO estimate workflow.
      </div>

      {error ? (
        <div style={{ fontSize: "0.78rem", color: "#fbbf24" }}>{error}</div>
      ) : null}
    </div>
  );
}
