"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StatCard } from "../components/stat-card";
import { BuBadge } from "../components/bu-badge";
import { StatusDot } from "../components/status-dot";
import { PdfPreviewModal } from "../components/pdf-preview-modal";

interface QuoteRow {
  id: string;
  quote_number?: string;
  client_name: string;
  business_unit: string;
  estimated_total: number;
  internal_status: string;
  client_status: string;
  valid_until?: string;
  created_at: string;
  phase_count?: number;
}

type BizFilter = "ALL" | "ACS" | "CC";
type StatusFilter = "ALL" | "draft" | "sent" | "accepted" | "rejected" | "expired";

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted, #9cadc8)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState<BizFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  // PDF preview state
  const [previewData, setPreviewData] = useState<{ base64: string; metadata: any } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    try {
      const res = await fetch("/api/quotes?limit=200");
      if (res.ok) {
        const data = await res.json();
        setQuotes(data.quotes || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const filtered = quotes.filter((q) => {
    if (biz !== "ALL" && (q.business_unit || "ACS").toUpperCase() !== biz) return false;
    if (statusFilter !== "ALL" && q.internal_status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (q.client_name || "").toLowerCase().includes(s) ||
        (q.quote_number || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalPipeline = filtered
    .filter((q) => ["draft", "sent"].includes(q.internal_status))
    .reduce((sum, q) => sum + (q.estimated_total || 0), 0);

  const totalAccepted = filtered
    .filter((q) => q.client_status === "accepted" || q.internal_status === "accepted")
    .reduce((sum, q) => sum + (q.estimated_total || 0), 0);

  const expiringSoon = filtered.filter((q) => {
    if (!q.valid_until) return false;
    const daysLeft = (new Date(q.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 3 && q.internal_status !== "accepted";
  });

  async function handlePreview(quoteId: string) {
    setPreviewLoading(quoteId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/preview`, { method: "POST" });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreviewData({ base64: data.pdf_base64, metadata: data });
    } catch {
      alert("Failed to generate preview");
    } finally {
      setPreviewLoading(null);
    }
  }

  async function handleDownload(quoteId: string, quoteName: string) {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quoteName || "quote"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF");
    }
  }

  async function handleDuplicate(quoteId: string) {
    // Fetch existing quote, then POST a copy
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      const q = data.quote;
      const items = data.items || [];

      const createRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: q.client_name,
          client_email: q.client_email,
          business_unit: q.business_unit,
          estimated_total: q.estimated_total,
          internal_status: "draft",
          client_status: "not_sent",
          notes: q.notes ? `Copy of ${q.quote_number || quoteId.slice(0, 8)}. ${q.notes}` : `Copy of ${q.quote_number || quoteId.slice(0, 8)}`,
          valid_until: new Date(Date.now() + (q.business_unit === "ACS" ? 7 : 14) * 86400000).toISOString(),
          items: items.map((i: any) => ({
            phase_name: i.phase_name,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            unit: i.unit,
          })),
        }),
      });
      if (!createRes.ok) throw new Error("Create failed");
      await fetchQuotes();
    } catch {
      alert("Failed to duplicate quote");
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}>Quotes</h1>
          {expiringSoon.length > 0 && (
            <p style={{ fontSize: "0.72rem", color: "#e4ad5b", marginTop: 4 }}>
              ⚠ {expiringSoon.length} quote{expiringSoon.length > 1 ? "s" : ""} expiring within 3 days
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              fontSize: "0.72rem",
              fontWeight: 600,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--ink)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>

          {/* BU filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "ACS", "CC"] as BizFilter[]).map((b) => (
              <button
                key={b}
                onClick={() => setBiz(b)}
                style={{
                  background: biz === b ? "rgba(139,164,196,0.15)" : "transparent",
                  border: `1px solid ${biz === b ? "var(--accent, #8ba4c4)" : "rgba(255,255,255,0.07)"}`,
                  color: biz === b ? "var(--ink)" : "var(--muted)",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
              >{b}</button>
            ))}
          </div>

          <Link
            href="/root/quotes/new"
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              fontSize: "0.74rem",
              fontWeight: 600,
              background: "#3d7dd8",
              color: "#fff",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >+ New Quote</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Pipeline" value={`$${totalPipeline.toLocaleString()}`} color="#e4ad5b" />
        <StatCard label="Accepted" value={`$${totalAccepted.toLocaleString()}`} color="#3ec983" />
        <StatCard label="Total Quotes" value={filtered.length} color="#8ba4c4" />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search quotes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "10px 16px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "var(--ink)",
            fontSize: "0.88rem",
            outline: "none",
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>Loading quotes...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>No quotes found.</p>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={thStyle}>Quote #</th>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>BU</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Valid Until</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((q) => {
                const isExpiring = q.valid_until && (() => {
                  const d = (new Date(q.valid_until!).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                  return d > 0 && d <= 3;
                })();

                return (
                  <tr key={q.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={tdStyle}>
                      <Link
                        href={`/root/quotes/${q.id}`}
                        style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}
                      >
                        {q.quote_number || `Q-${q.id.slice(0, 8)}`}
                      </Link>
                    </td>
                    <td style={tdStyle}>{q.client_name || "—"}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      ${(q.estimated_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={tdStyle}><BuBadge bu={q.business_unit || "ACS"} /></td>
                    <td style={tdStyle}><StatusDot status={q.internal_status || "draft"} /></td>
                    <td style={{
                      ...tdStyle,
                      color: isExpiring ? "#e4ad5b" : "var(--muted)",
                      fontWeight: isExpiring ? 600 : 400,
                    }}>
                      {q.valid_until
                        ? new Date(q.valid_until).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"}
                      {isExpiring && " ⚠"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--muted)" }}>
                      {new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link
                          href={`/root/quotes/${q.id}`}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: "0.64rem",
                            fontWeight: 600,
                            background: "rgba(139,164,196,0.12)",
                            color: "#8ba4c4",
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                        >Edit</Link>
                        <button
                          onClick={() => handlePreview(q.id)}
                          disabled={previewLoading === q.id}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: "0.64rem",
                            fontWeight: 600,
                            background: "rgba(61,125,216,0.12)",
                            color: "#3d7dd8",
                            border: "none",
                            cursor: "pointer",
                            opacity: previewLoading === q.id ? 0.5 : 1,
                          }}
                        >{previewLoading === q.id ? "..." : "Preview"}</button>
                        <button
                          onClick={() => handleDownload(q.id, q.quote_number || `Q-${q.id.slice(0, 8)}`)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: "0.64rem",
                            fontWeight: 600,
                            background: "rgba(62,201,131,0.12)",
                            color: "#3ec983",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >PDF</button>
                        <button
                          onClick={() => handleDuplicate(q.id)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: "0.64rem",
                            fontWeight: 600,
                            background: "rgba(228,173,91,0.12)",
                            color: "#e4ad5b",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >Dup</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div style={{ padding: "12px 14px", fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
              Showing 100 of {filtered.length} quotes
            </div>
          )}
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewData && (
        <PdfPreviewModal
          base64={previewData.base64}
          metadata={previewData.metadata}
          onClose={() => setPreviewData(null)}
        />
      )}
    </div>
  );
}
