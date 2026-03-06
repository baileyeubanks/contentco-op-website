"use client";

import React from "react";

export interface TermsSection {
  title: string;
  body: string;
}

interface TermsEditorProps {
  terms: TermsSection[];
  notes: string;
  onChange: (terms: TermsSection[]) => void;
  onNotesChange: (notes: string) => void;
}

const ACS_DEFAULT_TERMS: TermsSection[] = [
  { title: "Service Agreement", body: "This quote is valid for the services described above. Any additional services will be quoted separately." },
  { title: "Payment Terms", body: "Payment is due within 7 days of invoice date. We accept Zelle, check, or bank transfer." },
  { title: "Cancellation", body: "Cancellations made less than 24 hours before scheduled service may incur a cancellation fee equal to 50% of the quoted amount." },
  { title: "Liability", body: "Astro Cleanings carries general liability insurance. Any damage claims must be reported within 24 hours of service completion." },
];

const CC_DEFAULT_TERMS: TermsSection[] = [
  { title: "Scope of Work", body: "This quote covers only the deliverables explicitly listed above. Additional deliverables will require a change order or supplemental quote." },
  { title: "Payment Terms", body: "50% deposit due upon acceptance. Remaining balance due upon delivery of final deliverables. Net 14 days." },
  { title: "Timeline", body: "Production timelines begin upon receipt of deposit and all required client materials. Delays in client feedback may extend delivery dates." },
  { title: "Revisions", body: "Two rounds of revisions are included per deliverable. Additional revision rounds will be billed at the hourly rate specified." },
  { title: "Intellectual Property", body: "Upon full payment, all deliverables and associated intellectual property rights transfer to the client." },
  { title: "Usage Rights", body: "Content Co-op reserves the right to use completed work in portfolio and marketing materials unless otherwise agreed in writing." },
  { title: "Cancellation", body: "Cancellation after production begins will be billed for all completed work plus 25% of remaining quoted amount." },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "var(--ink)",
  fontSize: "0.78rem",
  outline: "none",
};

export function TermsEditor({ terms, notes, onChange, onNotesChange }: TermsEditorProps) {
  function updateTerm(index: number, updates: Partial<TermsSection>) {
    const next = [...terms];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  }

  function removeTerm(index: number) {
    onChange(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    onChange([...terms, { title: "", body: "" }]);
  }

  return (
    <div>
      {/* Notes */}
      <div style={{
        marginBottom: 16,
        padding: 16,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}>
        <div style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 8,
          color: "var(--muted)",
        }}>Notes</div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Additional notes for the client..."
          rows={3}
          style={{
            ...inputStyle,
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Terms sections */}
      <div style={{
        padding: 16,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}>
        <div style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 12,
          color: "var(--muted)",
        }}>Terms & Conditions</div>

        {terms.map((term, i) => (
          <div key={i} style={{
            marginBottom: 12,
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input
                type="text"
                value={term.title}
                onChange={(e) => updateTerm(i, { title: e.target.value })}
                placeholder="Section title"
                style={{ ...inputStyle, fontWeight: 600, flex: 1 }}
              />
              <button
                onClick={() => removeTerm(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  padding: "2px 4px",
                }}
              >✕</button>
            </div>
            <textarea
              value={term.body}
              onChange={(e) => updateTerm(i, { body: e.target.value })}
              placeholder="Terms text..."
              rows={2}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}

        <button
          onClick={addTerm}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: "0.68rem",
            fontWeight: 600,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >+ Add Section</button>
      </div>
    </div>
  );
}

export { ACS_DEFAULT_TERMS, CC_DEFAULT_TERMS };
