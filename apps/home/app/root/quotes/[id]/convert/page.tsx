"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ── Brand-center v2 tokens ── */
const G = "rgba(74,222,128,";
const LINE = `${G}0.10)`;
const MONO = "var(--font-mono), monospace";
const HEALTHY = "#9ce7ba";
const ATTENTION = "#f3c778";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
  phase_name: string;
}

export default function ConvertQuoteToInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [quote, setQuote] = useState<Record<string, any> | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);

  /* Editable invoice fields */
  const [dueDate, setDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [overrideAcceptance, setOverrideAcceptance] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  async function fetchQuote() {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setQuote(data.quote);

      const rawItems = data.items || [];
      setItems(
        rawItems.map((item: any) => ({
          id: item.id || Math.random().toString(36).slice(2),
          description: item.description || "",
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          unit: item.unit || "ea",
          phase_name: item.phase_name || "",
        })),
      );

      /* Default due date */
      const bu = String(data.quote?.business_unit || "ACS").toUpperCase();
      const days = bu === "ACS" ? 7 : 14;
      setDueDate(new Date(Date.now() + days * 86400000).toISOString().split("T")[0]);
      setInvoiceNotes(data.quote?.notes || "");
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }

  const grandTotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
  const clientStatus = String(quote?.client_status || "").toLowerCase();
  const isAccepted = clientStatus === "accepted";
  const needsOverride = !isAccepted;

  async function handleConvert() {
    if (needsOverride && !overrideAcceptance) {
      alert("Please confirm the manual override checkbox since the client hasn't formally accepted this quote.");
      return;
    }

    setConverting(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.detail || "Conversion failed");
      }

      const data = await res.json();
      const invoiceId = data.invoice?.id;
      if (invoiceId) {
        router.push(`/root/invoices/${invoiceId}`);
      } else {
        router.push("/dashboard/invoices");
      }
    } catch (err: any) {
      alert(err.message || "Failed to convert quote to invoice");
    } finally {
      setConverting(false);
    }
  }

  /* ── Styles ── */
  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${LINE}`,
    borderRadius: 10,
    color: "var(--ink)",
    fontSize: "0.8rem",
    outline: "none",
    transition: "border-color 140ms ease",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.52rem",
    fontWeight: 700,
    fontFamily: MONO,
    color: "var(--muted)",
    display: "block",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    opacity: 0.8,
  };

  const panelStyle: React.CSSProperties = {
    padding: "18px 20px",
    borderRadius: 16,
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,0.02)",
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
        Loading quote...
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
        Quote not found.{" "}
        <Link href="/root/quotes" style={{ color: "var(--root-accent)" }}>
          Back to quotes
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderRadius: 18,
          border: `1px solid ${LINE}`,
          background: `radial-gradient(ellipse 50% 50% at 10% 50%, ${G}0.06), transparent), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012))`,
          boxShadow: "0 8px 28px rgba(0,0,0,0.1)",
        }}
      >
        <div>
          <div style={{ fontFamily: MONO, fontSize: "0.52rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--root-accent)", marginBottom: 4 }}>
            convert to invoice
          </div>
          <h1 style={{ fontFamily: "var(--font-body), sans-serif", fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
            {quote.quote_number || `Quote ${quoteId.slice(0, 8)}`} → Invoice
          </h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link
            href={`/root/quotes/${quoteId}`}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: "0.7rem",
              fontWeight: 700,
              fontFamily: MONO,
              letterSpacing: "0.06em",
              border: `1px solid rgba(255,255,255,0.06)`,
              background: "transparent",
              color: "var(--muted)",
              textDecoration: "none",
              transition: "all 140ms ease",
            }}
          >
            Back to Quote
          </Link>
        </div>
      </div>

      {/* Two-column review */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* LEFT: Quote Summary (read-only) */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={panelStyle}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12, color: "var(--root-accent)" }}>
              Quote Summary
            </div>

            <div style={{ display: "grid", gap: 8, fontSize: "0.78rem" }}>
              <div><span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>Client:</span> {quote.client_name || "—"}</div>
              <div><span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>Email:</span> {quote.client_email || "—"}</div>
              <div><span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>BU:</span> {String(quote.business_unit || "ACS").toUpperCase()}</div>
              <div>
                <span style={{ color: "var(--muted)", fontSize: "0.66rem" }}>Client Status:</span>{" "}
                <span style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  fontFamily: MONO,
                  background: isAccepted ? "rgba(156,231,186,0.15)" : "rgba(243,199,120,0.15)",
                  color: isAccepted ? HEALTHY : ATTENTION,
                  border: `1px solid ${isAccepted ? "rgba(156,231,186,0.3)" : "rgba(243,199,120,0.3)"}`,
                }}>
                  {clientStatus || "pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Quote line items (read-only) */}
          <div style={panelStyle}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10, color: `${G}0.7)` }}>
              Quote Line Items
            </div>
            {items.map((item, idx) => {
              const lt = (item.quantity || 0) * (item.unit_price || 0);
              return (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.035)" }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 600 }}>{item.description || "—"}</div>
                    <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontFamily: MONO }}>
                      {item.quantity} × ${item.unit_price.toFixed(2)} / {item.unit}
                      {item.phase_name ? ` · ${item.phase_name}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    ${lt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 6, borderTop: `2px solid ${LINE}` }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>Total</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: HEALTHY, fontVariantNumeric: "tabular-nums" }}>
                ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Invoice Preview (editable) */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={panelStyle}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12, color: "var(--root-accent)" }}>
              Invoice Settings
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Invoice Notes</label>
                <textarea
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            </div>
          </div>

          {/* Override warning */}
          {needsOverride && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 12,
                border: `1px solid rgba(243,199,120,0.25)`,
                background: "rgba(243,199,120,0.06)",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: ATTENTION, marginBottom: 6 }}>
                Client has not accepted this quote
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}>
                The client status is &quot;{clientStatus || "pending"}&quot;. You can still convert to an invoice with a manual override — use this if the client accepted verbally or via email.
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={overrideAcceptance}
                  onChange={(e) => setOverrideAcceptance(e.target.checked)}
                  style={{ accentColor: ATTENTION }}
                />
                <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>
                  I confirm this quote was accepted outside the system
                </span>
              </label>
            </div>
          )}

          {/* Convert button */}
          <button
            type="button"
            onClick={handleConvert}
            disabled={converting || (needsOverride && !overrideAcceptance)}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              fontSize: "0.82rem",
              fontWeight: 700,
              fontFamily: MONO,
              letterSpacing: "0.04em",
              cursor: converting || (needsOverride && !overrideAcceptance) ? "not-allowed" : "pointer",
              border: "none",
              background: converting || (needsOverride && !overrideAcceptance) ? `${G}0.08)` : `${G}0.16)`,
              color: converting || (needsOverride && !overrideAcceptance) ? "var(--muted)" : HEALTHY,
              width: "100%",
              transition: "all 140ms ease",
            }}
          >
            {converting ? "Converting..." : "Create Invoice from Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}
