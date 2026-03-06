"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { BuyerForm, BuyerInfo } from "../../components/quote-builder/buyer-form";
import { PhaseEditor, Phase, ACS_PHASE_DEFAULTS, CC_PHASE_DEFAULTS } from "../../components/quote-builder/phase-editor";
import { TermsEditor, TermsSection, ACS_DEFAULT_TERMS, CC_DEFAULT_TERMS } from "../../components/quote-builder/terms-editor";
import { SummaryPanel } from "../../components/quote-builder/summary-panel";
import { PdfPreviewModal } from "../../components/pdf-preview-modal";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function QuoteEditorPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ base64: string; metadata: any } | null>(null);

  const [bu, setBu] = useState<"ACS" | "CC">("ACS");
  const [referenceName, setReferenceName] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [internalStatus, setInternalStatus] = useState("draft");

  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: "", email: "", phone: "", company: "",
  });

  const [phases, setPhases] = useState<Phase[]>([]);
  const [terms, setTerms] = useState<TermsSection[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  async function fetchQuote() {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      const q = data.quote;
      const items = data.items || [];

      const buVal = (q.business_unit || "ACS").toUpperCase() as "ACS" | "CC";
      setBu(buVal);
      setReferenceName(q.notes || "");
      setQuoteNumber(q.quote_number || "");
      setIssueDate(q.created_at ? new Date(q.created_at).toISOString().split("T")[0] : "");
      setValidUntil(q.valid_until ? new Date(q.valid_until).toISOString().split("T")[0] : "");
      setInternalStatus(q.internal_status || "draft");

      setBuyer({
        name: q.client_name || "",
        email: q.client_email || "",
        phone: q.client_phone || "",
        company: q.client_company || "",
      });

      // Group items by phase
      const phaseMap = new Map<string, Phase>();
      for (const item of items) {
        const phaseName = item.phase_name || "General";
        if (!phaseMap.has(phaseName)) {
          phaseMap.set(phaseName, {
            id: generateId(),
            name: phaseName,
            items: [],
          });
        }
        phaseMap.get(phaseName)!.items.push({
          id: item.id || generateId(),
          description: item.description || "",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          unit: item.unit || "ea",
        });
      }

      const loadedPhases = Array.from(phaseMap.values());
      setPhases(loadedPhases.length > 0 ? loadedPhases : [{
        id: generateId(),
        name: buVal === "ACS" ? "Service" : "Production",
        items: [{ id: generateId(), description: "", quantity: 1, unit_price: 0, unit: "ea" }],
      }]);

      // Load BU-default terms (stored terms not yet persisted in DB)
      setTerms(buVal === "ACS" ? ACS_DEFAULT_TERMS : CC_DEFAULT_TERMS);
      setNotes(q.notes || "");
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const grandTotal = phases.reduce(
        (s, p) => s + p.items.reduce((si, i) => si + (i.quantity || 0) * (i.unit_price || 0), 0),
        0
      );

      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: buyer.name,
          client_email: buyer.email,
          business_unit: bu,
          estimated_total: grandTotal,
          internal_status: internalStatus,
          notes: [referenceName, notes].filter(Boolean).join(" — "),
          valid_until: validUntil ? new Date(validUntil).toISOString() : undefined,
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
    } catch {
      alert("Failed to save quote");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/preview`, { method: "POST" });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreviewData({ base64: data.pdf_base64, metadata: data });
    } catch {
      alert("Failed to generate preview — save the quote first");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quoteNumber || `Q-${quoteId.slice(0, 8)}`}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF — save the quote first");
    }
  }

  function handleBuToggle(newBu: "ACS" | "CC") {
    if (newBu === bu) return;
    setBu(newBu);
    setTerms(newBu === "ACS" ? ACS_DEFAULT_TERMS : CC_DEFAULT_TERMS);
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

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
        Loading quote...
      </div>
    );
  }

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
          }}>
            {quoteNumber || `Quote ${quoteId.slice(0, 8)}`}
          </h1>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>
            Status: {internalStatus}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Status selector */}
          <select
            value={internalStatus}
            onChange={(e) => setInternalStatus(e.target.value)}
            style={{
              ...inputStyle,
              cursor: "pointer",
              fontSize: "0.74rem",
              fontWeight: 600,
            }}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>

          {/* BU toggle */}
          {(["ACS", "CC"] as const).map((b) => (
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
              {b === "ACS" ? "ACS" : "CC"}
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
                Reference
              </label>
              <input
                type="text"
                value={referenceName}
                onChange={(e) => setReferenceName(e.target.value)}
                placeholder="Internal reference"
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
            quoteId={quoteId}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onSave={handleSave}
            saving={saving}
            previewLoading={previewLoading}
          />
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewData && (
        <PdfPreviewModal
          base64={previewData.base64}
          filename={`${quoteNumber || `Q-${quoteId.slice(0, 8)}`}.pdf`}
          metadata={previewData.metadata}
          onClose={() => setPreviewData(null)}
        />
      )}
    </div>
  );
}
