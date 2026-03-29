"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type InvoiceDetail = {
  id: string;
  invoice_number: string | null;
  due_date: string | null;
  due_at: string | null;
  invoice_status: string | null;
  notes: string | null;
  contact_name: string | null;
};

export default function RootInvoiceEditPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = String(params.id || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void loadInvoice();
  }, [invoiceId]);

  async function loadInvoice() {
    setLoading(true);
    const res = await fetch(`/api/root/invoices/${invoiceId}`, { cache: "no-store" });
    const data = await res.json();
    const nextInvoice = data.invoice as InvoiceDetail | null;
    setInvoice(nextInvoice);
    setDueDate(String(nextInvoice?.due_date || nextInvoice?.due_at || "").slice(0, 10));
    setStatus(String(nextInvoice?.invoice_status || "draft"));
    setNotes(String(nextInvoice?.notes || ""));
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/root/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          due_date: dueDate,
          status,
          notes,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      router.push(`/root/invoices/${invoiceId}`);
      router.refresh();
    } catch {
      alert("Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !invoice) {
    return <div style={{ padding: 48, color: "var(--muted)" }}>loading invoice editor…</div>;
  }

  return (
    <div className="root-atlas-page" style={{ maxWidth: 900, display: "grid", gap: 18 }}>
      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={kickerStyle}>invoice edit</div>
          <h1 style={{ margin: 0, fontSize: "2rem", textTransform: "lowercase" }}>
            {invoice.invoice_number || `invoice ${invoice.id.slice(0, 8).toUpperCase()}`}
          </h1>
          <div style={subtitleStyle}>{invoice.contact_name || "unknown client"}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/root/invoices/${invoiceId}`} className="root-atlas-button root-atlas-button-secondary">back</Link>
          <button type="button" onClick={() => void handleSave()} className="root-atlas-button root-atlas-button-primary" disabled={saving}>
            {saving ? "saving..." : "save"}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={fieldGridStyle}>
          <label style={labelStyle}>
            <span>status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={inputStyle}>
              <option value="draft">draft</option>
              <option value="sent">sent</option>
              <option value="issued">issued</option>
              <option value="paid">paid</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span>due date</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={labelStyle}>
          <span>notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={textareaStyle} />
        </label>
      </section>
    </div>
  );
}

const panelStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  padding: "18px 20px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
} as const;

const kickerStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.66rem",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "var(--root-accent)",
} as const;

const subtitleStyle = {
  color: "var(--root-muted, var(--muted))",
  fontSize: "0.94rem",
} as const;

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  width: "100%",
} as const;

const labelStyle = {
  display: "grid",
  gap: 8,
  width: "100%",
  color: "var(--ink)",
  fontSize: "0.82rem",
} as const;

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--ink)",
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: 220,
  resize: "vertical" as const,
} as const;
