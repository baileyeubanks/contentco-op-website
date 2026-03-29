"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ── Brand-center v2 tokens ── */
const G = "rgba(74,222,128,";
const LINE = `${G}0.10)`;
const MONO = "var(--font-mono), monospace";
const HEALTHY = "#9ce7ba";

type BU = "ACS" | "CC";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
  phase_name: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyItem(phaseName = ""): LineItem {
  return { id: generateId(), description: "", quantity: 1, unit_price: 0, unit: "ea", phase_name: phaseName };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [bu, setBu] = useState<BU>("ACS");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  function handleBuToggle(newBu: BU) {
    if (newBu === bu) return;
    setBu(newBu);
    setDueDate(
      new Date(Date.now() + (newBu === "ACS" ? 7 : 14) * 86400000).toISOString().split("T")[0],
    );
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  const grandTotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/root/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          client_company: clientCompany,
          business_unit: bu,
          due_date: dueDate,
          notes,
          items: items.filter((i) => i.description.trim()),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      const data = await res.json();
      router.push(`/root/invoices/${data.invoice.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create invoice");
    } finally {
      setSaving(false);
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
    transition: "border-color 140ms ease, box-shadow 140ms ease",
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

  const cardStyle: React.CSSProperties = {
    padding: "18px 20px",
    borderRadius: 16,
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,0.02)",
  };

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
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.52rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--root-accent)",
              marginBottom: 4,
            }}
          >
            new invoice
          </div>
          <h1
            style={{
              fontFamily: "var(--font-body), sans-serif",
              fontSize: "1.15rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Create Invoice
          </h1>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Link
            href="/dashboard/invoices"
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: "0.7rem",
              fontWeight: 700,
              fontFamily: MONO,
              letterSpacing: "0.06em",
              cursor: "pointer",
              border: `1px solid rgba(255,255,255,0.06)`,
              background: "transparent",
              color: "var(--muted)",
              textDecoration: "none",
              transition: "all 140ms ease",
            }}
          >
            Cancel
          </Link>
          {(["ACS", "CC"] as const).map((b) => (
            <button
              key={b}
              onClick={() => handleBuToggle(b)}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                fontSize: "0.7rem",
                fontWeight: 700,
                fontFamily: MONO,
                letterSpacing: "0.06em",
                cursor: "pointer",
                border: `1px solid ${bu === b ? `${G}0.2)` : "rgba(255,255,255,0.06)"}`,
                background: bu === b ? `color-mix(in srgb, var(--root-accent) 12%, transparent)` : "transparent",
                color: bu === b ? "var(--ink)" : "var(--muted)",
                transition: "all 140ms ease",
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: 24 }}>
        {/* Form (left) */}
        <div style={{ flex: 3, display: "grid", gap: 18 }}>
          {/* Client info */}
          <div style={cardStyle}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.56rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: 14,
                color: "var(--root-accent)",
              }}
            >
              Client Details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Full name or business"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input
                  type="text"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                  placeholder="Company name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@email.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes or reference"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Line Items */}
          <div style={cardStyle}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.56rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: 14,
                color: "var(--root-accent)",
              }}
            >
              Line Items
            </div>

            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 0.6fr 0.8fr 0.5fr 0.6fr 32px",
                gap: 8,
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: `1px solid ${LINE}`,
              }}
            >
              {["Description", "Qty", "Price", "Unit", "Total", ""].map((h) => (
                <div
                  key={h}
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.48rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: `${G}0.7)`,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Item rows */}
            {items.map((item, idx) => {
              const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.5fr 0.6fr 0.8fr 0.5fr 0.6fr 32px",
                    gap: 8,
                    marginBottom: 6,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    placeholder="Service or item description"
                    style={{ ...inputStyle, padding: "6px 10px", fontSize: "0.76rem" }}
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                    min={0}
                    step={1}
                    style={{ ...inputStyle, padding: "6px 8px", fontSize: "0.76rem", textAlign: "center" }}
                  />
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
                    min={0}
                    step={0.01}
                    style={{ ...inputStyle, padding: "6px 8px", fontSize: "0.76rem", textAlign: "right" }}
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(idx, "unit", e.target.value)}
                    style={{
                      ...inputStyle,
                      padding: "6px 4px",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                    }}
                  >
                    <option value="ea">ea</option>
                    <option value="hr">hr</option>
                    <option value="day">day</option>
                    <option value="sqft">sqft</option>
                    <option value="mo">mo</option>
                    <option value="flat">flat</option>
                  </select>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                      color: lineTotal > 0 ? "var(--ink)" : "var(--muted)",
                    }}
                  >
                    ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: items.length <= 1 ? "default" : "pointer",
                      fontSize: "0.9rem",
                      opacity: items.length <= 1 ? 0.3 : 0.6,
                      transition: "opacity 140ms ease",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addItem}
              style={{
                marginTop: 8,
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.68rem",
                fontWeight: 700,
                fontFamily: MONO,
                letterSpacing: "0.04em",
                cursor: "pointer",
                border: `1px dashed ${LINE}`,
                background: "transparent",
                color: "var(--muted)",
                transition: "all 140ms ease",
              }}
            >
              + add item
            </button>
          </div>
        </div>

        {/* Summary (right) */}
        <div style={{ flex: 2, maxWidth: 360 }}>
          <div
            style={{
              position: "sticky",
              top: 24,
              padding: 20,
              background: `radial-gradient(ellipse 80% 50% at 30% 0%, ${G}0.05), transparent), rgba(12,19,34,0.92)`,
              border: `1px solid ${LINE}`,
              borderRadius: 18,
              backdropFilter: "blur(12px)",
              boxShadow: "0 14px 40px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.56rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--root-accent)",
                marginBottom: 14,
              }}
            >
              Invoice Summary
            </div>

            {/* Items breakdown */}
            {items
              .filter((i) => i.description.trim())
              .map((item, idx) => {
                const lt = (item.quantity || 0) * (item.unit_price || 0);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.035)",
                    }}
                  >
                    <div style={{ fontSize: "0.74rem", fontWeight: 600, maxWidth: "65%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.description}
                    </div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color: lt > 0 ? "var(--ink)" : "var(--muted)",
                      }}
                    >
                      ${lt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}

            {/* Grand total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0 6px",
                marginTop: 8,
                borderTop: `2px solid ${LINE}`,
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>Total</div>
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.03em",
                  color: HEALTHY,
                }}
              >
                ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Meta */}
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${LINE}`,
                fontSize: "0.64rem",
                color: "var(--muted)",
                lineHeight: 1.65,
              }}
            >
              <div>
                <strong>BU:</strong> {bu === "ACS" ? "Astro Cleanings" : "Content Co-op"}
              </div>
              <div>
                <strong>Line items:</strong> {items.filter((i) => i.description.trim()).length}
              </div>
              {dueDate && (
                <div>
                  <strong>Due:</strong>{" "}
                  {new Date(dueDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                <strong>Payment:</strong>{" "}
                {bu === "ACS"
                  ? "Due within 7 days. Zelle / check / bank transfer."
                  : "50% deposit on acceptance. Balance on delivery. Net 14."}
              </div>
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || grandTotal <= 0}
              style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: "0.78rem",
                fontWeight: 700,
                fontFamily: MONO,
                letterSpacing: "0.04em",
                cursor: saving || grandTotal <= 0 ? "not-allowed" : "pointer",
                border: "none",
                background: saving || grandTotal <= 0 ? `${G}0.12)` : `${G}0.16)`,
                color: saving || grandTotal <= 0 ? "var(--muted)" : HEALTHY,
                width: "100%",
                transition: "all 140ms ease",
              }}
            >
              {saving ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
