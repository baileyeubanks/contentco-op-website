"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BuyerForm, BuyerInfo } from "../../components/quote-builder/buyer-form";
import { PhaseEditor, Phase, ACS_PHASE_DEFAULTS, CC_PHASE_DEFAULTS } from "../../components/quote-builder/phase-editor";
import { TermsEditor, TermsSection, ACS_DEFAULT_TERMS, CC_DEFAULT_TERMS } from "../../components/quote-builder/terms-editor";
import { SummaryPanel } from "../../components/quote-builder/summary-panel";

type BU = "ACS" | "CC";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getDefaultPhases(bu: BU): Phase[] {
  const defaults = bu === "ACS" ? ACS_PHASE_DEFAULTS : CC_PHASE_DEFAULTS;
  return defaults.map((name) => ({
    id: generateId(),
    name,
    items: [{ id: generateId(), description: "", quantity: 1, unit_price: 0, unit: "ea" }],
  }));
}

export default function NewQuotePage() {
  const router = useRouter();
  const [bu, setBu] = useState<BU>("ACS");
  const [referenceName, setReferenceName] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );

  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  const [phases, setPhases] = useState<Phase[]>(getDefaultPhases("ACS"));
  const [terms, setTerms] = useState<TermsSection[]>(ACS_DEFAULT_TERMS);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function handleBuToggle(newBu: BU) {
    if (newBu === bu) return;
    setBu(newBu);
    // Reset to defaults for the new BU
    setPhases(getDefaultPhases(newBu));
    setTerms(newBu === "ACS" ? ACS_DEFAULT_TERMS : CC_DEFAULT_TERMS);
    setValidUntil(
      new Date(Date.now() + (newBu === "ACS" ? 7 : 14) * 86400000).toISOString().split("T")[0]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const grandTotal = phases.reduce(
        (s, p) => s + p.items.reduce((si, i) => si + (i.quantity || 0) * (i.unit_price || 0), 0),
        0
      );

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: buyer.name,
          client_email: buyer.email,
          business_unit: bu,
          estimated_total: grandTotal,
          internal_status: "draft",
          client_status: "not_sent",
          notes: [referenceName, notes].filter(Boolean).join(" — "),
          valid_until: new Date(validUntil).toISOString(),
          items: phases.flatMap((p) =>
            p.items.filter((i) => i.description).map((i) => ({
              phase_name: p.name,
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unit_price,
              unit: i.unit,
            }))
          ),
        }),
      });

      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      router.push(`/root/quotes/${data.id}`);
    } catch (err) {
      alert("Failed to save quote");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "var(--ink)",
    fontSize: "0.82rem",
    outline: "none",
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
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
            fontSize: "1.1rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}>New Quote</h1>
        </div>

        {/* BU toggle */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["ACS", "CC"] as BU[]).map((b) => (
            <button
              key={b}
              onClick={() => handleBuToggle(b)}
              style={{
                padding: "6px 18px",
                borderRadius: 8,
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                border: `2px solid ${bu === b ? (b === "ACS" ? "#0d5487" : "#1e4d8c") : "rgba(255,255,255,0.08)"}`,
                background: bu === b ? (b === "ACS" ? "rgba(13,84,135,0.15)" : "rgba(30,77,140,0.15)") : "transparent",
                color: bu === b ? "var(--ink)" : "var(--muted)",
              }}
            >
              {b === "ACS" ? "Astro Cleanings" : "Content Co-op"}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: 24 }}>
        {/* Form (60%) */}
        <div style={{ flex: 3 }}>
          {/* Metadata */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}>
            <div>
              <label style={{ fontSize: "0.64rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Reference Name
              </label>
              <input
                type="text"
                value={referenceName}
                onChange={(e) => setReferenceName(e.target.value)}
                placeholder="e.g. Monthly Deep Clean — March 2026"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.64rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.64rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Valid Until
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
          </div>

          {/* Client info */}
          <div style={{ marginBottom: 20 }}>
            <BuyerForm buyer={buyer} onChange={setBuyer} />
          </div>

          {/* Phases */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 10,
              color: "var(--muted)",
            }}>Phases & Line Items</div>
            <PhaseEditor
              phases={phases}
              onChange={setPhases}
              buDefaults={bu === "ACS" ? ACS_PHASE_DEFAULTS : CC_PHASE_DEFAULTS}
            />
          </div>

          {/* Terms */}
          <TermsEditor
            terms={terms}
            notes={notes}
            onChange={setTerms}
            onNotesChange={setNotes}
          />
        </div>

        {/* Summary (40%) */}
        <div style={{ flex: 2, maxWidth: 360 }}>
          <SummaryPanel
            phases={phases}
            businessUnit={bu}
            validUntil={validUntil}
            onPreview={() => {}}
            onDownload={() => {}}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
}
