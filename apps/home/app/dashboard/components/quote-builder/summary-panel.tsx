"use client";

import React from "react";
import { Phase } from "./phase-editor";

/* ── Brand-center v2 tokens ── */
const G = "rgba(74,222,128,";
const LINE = `${G}0.10)`;
const MUTED = "var(--root-muted, var(--muted))";
const MONO = "var(--font-mono), monospace";
const HEALTHY = "#9ce7ba";

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

function CopyShareButton({ quoteId }: { quoteId: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      const shareUrl = `${window.location.origin}/share/quote/${quoteId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // silent
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        flex: 1,
        padding: "8px 12px",
        borderRadius: 10,
        fontSize: "0.7rem",
        fontWeight: 700,
        fontFamily: MONO,
        letterSpacing: "0.04em",
        cursor: "pointer",
        border: `1px solid ${LINE}`,
        background: "rgba(255,255,255,0.025)",
        color: "var(--ink)",
        transition: "all 140ms ease",
      }}
    >
      {copied ? "Copied!" : "Copy Share Link"}
    </button>
  );
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
      background: `radial-gradient(ellipse 80% 50% at 30% 0%, ${G}0.05), transparent), rgba(12,19,34,0.92)`,
      border: `1px solid ${LINE}`,
      borderRadius: 18,
      backdropFilter: "blur(12px)",
      boxShadow: "0 14px 40px rgba(0,0,0,0.15)",
    }}>
      <div style={{
        fontFamily: MONO,
        fontSize: "0.56rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "var(--root-accent)",
        marginBottom: 14,
      }}>
        Quote Summary
      </div>

      {/* Phase breakdown */}
      {phaseSubtotals.map((p, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "7px 0",
          borderBottom: "1px solid rgba(255,255,255,0.035)",
        }}>
          <div>
            <div style={{ fontSize: "0.76rem", fontWeight: 700 }}>{p.name || `Phase ${i + 1}`}</div>
            <div style={{ fontSize: "0.58rem", color: MUTED, fontFamily: MONO, opacity: 0.7 }}>
              {p.itemCount} item{p.itemCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: p.total > 0 ? "var(--ink)" : MUTED,
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
        borderTop: `2px solid ${LINE}`,
      }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>Total</div>
        <div style={{
          fontSize: "1.15rem",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03em",
          color: HEALTHY,
        }}>
          ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Meta */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${LINE}`,
        fontSize: "0.64rem",
        color: MUTED,
        lineHeight: 1.65,
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
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: "0.78rem",
            fontWeight: 700,
            fontFamily: MONO,
            letterSpacing: "0.04em",
            cursor: saving ? "not-allowed" : "pointer",
            border: "none",
            background: saving ? `${G}0.25)` : `${G}0.16)`,
            color: saving ? MUTED : HEALTHY,
            width: "100%",
            transition: "all 140ms ease",
          }}
        >
          {saving ? "Saving..." : quoteId ? "Save Changes" : "Save Draft"}
        </button>

        {quoteId && (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={onPreview}
                disabled={previewLoading}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  fontFamily: MONO,
                  letterSpacing: "0.04em",
                  cursor: previewLoading ? "not-allowed" : "pointer",
                  border: `1px solid ${LINE}`,
                  background: "rgba(255,255,255,0.025)",
                  color: "var(--ink)",
                  opacity: previewLoading ? 0.5 : 1,
                  transition: "all 140ms ease",
                }}
              >
                {previewLoading ? "Generating..." : "Preview PDF"}
              </button>
              <button
                onClick={onDownload}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  fontFamily: MONO,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  border: `1px solid ${G}0.18)`,
                  background: `${G}0.08)`,
                  color: HEALTHY,
                  transition: "all 140ms ease",
                }}
              >
                ↓ Download PDF
              </button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <CopyShareButton quoteId={quoteId} />
              <a
                href={`/share/quote/${quoteId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  fontFamily: MONO,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  border: `1px solid rgba(243,199,120,0.18)`,
                  background: "rgba(243,199,120,0.06)",
                  color: "#f3c778",
                  textDecoration: "none",
                  textAlign: "center",
                  transition: "all 140ms ease",
                }}
              >
                Open Share Page
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
