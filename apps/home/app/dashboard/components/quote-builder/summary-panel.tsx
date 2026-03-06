"use client";

import React from "react";
import { Phase } from "./phase-editor";

interface SummaryPanelProps {
  phases: Phase[];
  businessUnit: string;
  validUntil?: string;
  quoteId?: string;
  onPreview: () => void;
  onDownload: () => void;
  onSave: () => void;
  saving?: boolean;
  previewLoading?: boolean;
}

export function SummaryPanel({
  phases,
  businessUnit,
  validUntil,
  quoteId,
  onPreview,
  onDownload,
  onSave,
  saving,
  previewLoading,
}: SummaryPanelProps) {
  const phaseSubtotals = phases.map((p) => ({
    name: p.name,
    total: p.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0),
    itemCount: p.items.length,
  }));

  const grandTotal = phaseSubtotals.reduce((s, p) => s + p.total, 0);
  const totalItems = phaseSubtotals.reduce((s, p) => s + p.itemCount, 0);

  const paymentTerms = businessUnit === "ACS"
    ? "Due within 7 days of invoice. Zelle / check / bank transfer."
    : "50% deposit on acceptance. Balance on delivery. Net 14.";

  return (
    <div style={{
      position: "sticky",
      top: 24,
      padding: 20,
      background: "rgba(12,19,34,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        fontSize: "0.78rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: 16,
      }}>
        Quote Summary
      </div>

      {/* Phase breakdown */}
      {phaseSubtotals.map((p, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 0",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{p.name || `Phase ${i + 1}`}</div>
            <div style={{ fontSize: "0.62rem", color: "var(--muted)" }}>
              {p.itemCount} item{p.itemCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{
            fontSize: "0.82rem",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: p.total > 0 ? "var(--ink)" : "var(--muted)",
          }}>
            ${p.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      ))}

      {/* Grand total */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0 6px",
        marginTop: 8,
        borderTop: "2px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>Total</div>
        <div style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "#3ec983",
        }}>
          ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Meta */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        fontSize: "0.68rem",
        color: "var(--muted)",
        lineHeight: 1.6,
      }}>
        <div><strong>BU:</strong> {businessUnit === "ACS" ? "Astro Cleanings" : "Content Co-op"}</div>
        <div><strong>Phases:</strong> {phases.length}</div>
        <div><strong>Line items:</strong> {totalItems}</div>
        {validUntil && (
          <div><strong>Valid until:</strong> {new Date(validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
        )}
        <div style={{ marginTop: 4 }}><strong>Payment:</strong> {paymentTerms}</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            border: "none",
            background: saving ? "rgba(61,125,216,0.4)" : "#3d7dd8",
            color: "#fff",
            width: "100%",
          }}
        >
          {saving ? "Saving..." : quoteId ? "Save Changes" : "Save Draft"}
        </button>

        {quoteId && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onPreview}
              disabled={previewLoading}
              style={{
                flex: 1,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: previewLoading ? "not-allowed" : "pointer",
                border: "1px solid rgba(139,164,196,0.2)",
                background: "rgba(139,164,196,0.08)",
                color: "#8ba4c4",
                opacity: previewLoading ? 0.5 : 1,
              }}
            >
              {previewLoading ? "Generating..." : "Preview PDF"}
            </button>
            <button
              onClick={onDownload}
              style={{
                flex: 1,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid rgba(62,201,131,0.2)",
                background: "rgba(62,201,131,0.08)",
                color: "#3ec983",
              }}
            >
              ↓ Download PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
