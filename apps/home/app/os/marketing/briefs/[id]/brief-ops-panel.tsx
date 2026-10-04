"use client";

import { useState } from "react";
import { recordedBriefWorkspace, type RecordedBriefWorkspace } from "@/lib/cco-provisional-brief-contract";

export function RecordedBriefWorkspaceLink({ workspace }: { workspace: RecordedBriefWorkspace }) {
  return (
    <div style={{ display: "grid", gap: 8, fontSize: "0.82rem" }}>
      <p style={{ margin: 0 }}>
        Workspace recorded ({workspace.id.slice(0, 8)}). Current workspace access is unverified.
      </p>
      <p style={{ margin: 0, color: "var(--root-muted, var(--muted))" }}>
        Agreement/signature: unverified · Deposit: unverified · Creative approval: unverified.
        Verify production authorization separately.
      </p>
      <a href={workspace.href} className="os-atlas-button os-atlas-button-secondary" style={{ justifySelf: "start" }}>
        Open recorded Co-VideoPro workspace
      </a>
    </div>
  );
}

export function BriefOpsPanel({
  briefId,
  existingQuoteId,
  briefStatus,
}: {
  briefId: string;
  existingQuoteId?: string | null;
  briefStatus?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [converted, setConverted] = useState<RecordedBriefWorkspace | null>(null);
  const alreadyConverted = briefStatus === "converted";

  async function handleConvertToProject() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/briefs/${briefId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.project?.id) {
        if (data?.partial && data?.retryable) {
          throw new Error(data?.project?.id
            ? "Your project is saved, but setup is incomplete. Try again to finish; your existing work will be kept."
            : "Part of the production setup is saved. Try again to finish; your existing work will be kept.");
        }
        throw new Error(String(data?.action || data?.error || "brief_convert_failed"));
      }
      const workspace = recordedBriefWorkspace(briefId, data);
      if (!workspace) {
        throw new Error("The workspace receipt could not be verified. Check project setup again.");
      }
      setConverted(workspace);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "brief_convert_failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateDraft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefs/${briefId}/quote-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "quote_draft_failed"));
      }
      const quoteId = data?.quote?.id;
      if (quoteId) {
        window.location.href = `/os/quotes/${quoteId}`;
        return;
      }
      window.location.href = "/os/quotes";
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "quote_draft_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(62,201,131,0.12)",
      background: "rgba(255,255,255,0.02)",
      padding: "16px 18px",
      display: "grid",
      gap: 10,
    }}>
      <div style={{ fontWeight: 700 }}>operator actions</div>
      <div style={{ fontSize: "0.82rem", color: "var(--root-muted, var(--muted))" }}>
        Generate an internal quote draft from this brief or jump back into the latest draft already created for it.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {existingQuoteId ? (
          <a href={`/os/quotes/${existingQuoteId}`} className="os-atlas-button os-atlas-button-secondary">
            open latest draft
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={busy}
          className="os-atlas-button os-atlas-button-primary"
        >
          {busy ? "building draft..." : existingQuoteId ? "generate fresh draft" : "generate draft quote"}
        </button>
        <button
          type="button"
          onClick={handleConvertToProject}
          disabled={busy || Boolean(converted)}
          className="os-atlas-button os-atlas-button-secondary"
        >
          {converted ? "workspace recorded" : busy ? "working..." : alreadyConverted ? "check project setup" : "open approved production project"}
        </button>
      </div>
      {converted ? <RecordedBriefWorkspaceLink workspace={converted} /> : null}
      {error ? (
        <div style={{ fontSize: "0.78rem", color: "#fbbf24" }}>
          {error.replace(/_/g, " ")}
        </div>
      ) : null}
    </div>
  );
}
