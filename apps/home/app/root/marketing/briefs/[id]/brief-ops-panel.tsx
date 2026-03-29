"use client";

import { useState } from "react";

export function BriefOpsPanel({
  briefId,
  existingQuoteId,
}: {
  briefId: string;
  existingQuoteId?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        window.location.href = `/root/quotes/${quoteId}`;
        return;
      }
      window.location.href = "/root/quotes";
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
          <a href={`/root/quotes/${existingQuoteId}`} className="root-atlas-button root-atlas-button-secondary">
            open latest draft
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={busy}
          className="root-atlas-button root-atlas-button-primary"
        >
          {busy ? "building draft..." : existingQuoteId ? "generate fresh draft" : "generate draft quote"}
        </button>
      </div>
      {error ? (
        <div style={{ fontSize: "0.78rem", color: "#fbbf24" }}>
          {error.replace(/_/g, " ")}
        </div>
      ) : null}
    </div>
  );
}
