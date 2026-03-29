"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DT } from "./dt";

/* ─── Props ─── */
type Props = {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  balanceDue: number;
  clientEmail?: string | null;
  clientName?: string | null;
};

const G    = DT.G;
const LINE = DT.line;
const MONO = DT.font.mono;

const fmtAmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ══════════════════════════════════════════════════════
   RECORD PAYMENT MODAL
══════════════════════════════════════════════════════ */
function RecordPaymentModal({
  invoiceId, balanceDue, onClose, onSuccess,
}: { invoiceId: string; balanceDue: number; onClose: () => void; onSuccess: (amount: number) => void }) {
  const [amount,   setAmount]   = useState(String(balanceDue.toFixed(2)));
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [method,   setMethod]   = useState("bank");
  const [ref,      setRef]      = useState("");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/root/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paid_at: date, method, reference: ref, notes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      onSuccess(amt);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally { setSaving(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalCard title="Record Payment" onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="Amount">
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.sm, color: "var(--muted)", opacity: 0.5 }}>$</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
              <button onClick={() => setAmount(String(balanceDue.toFixed(2)))} style={miniBtn}>Full</button>
              <button onClick={() => setAmount(String((balanceDue / 2).toFixed(2)))} style={miniBtn}>50%</button>
            </div>
          </Row>
          <Row label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </Row>
          <Row label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
              {["bank", "ach", "card", "check", "cash", "zelle", "paypal", "other"].map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </Row>
          <Row label="Reference #">
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Check #, transaction ID…" style={inputStyle} />
          </Row>
          <Row label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" style={inputStyle} />
          </Row>
          {error && <div style={{ fontSize: DT.font.xs, color: "#f87171", fontFamily: MONO }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={submit} disabled={saving} style={primaryBtn}>{saving ? "Recording…" : "Record Payment"}</button>
          </div>
        </div>
      </ModalCard>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════
   SPLIT INVOICE MODAL
══════════════════════════════════════════════════════ */
function SplitInvoiceModal({
  invoiceId, invoiceNumber, total, onClose, onSuccess,
}: { invoiceId: string; invoiceNumber: string; total: number; onClose: () => void; onSuccess: (newId: string) => void }) {
  const [label,    setLabel]    = useState("2nd HALF");
  const [pct,      setPct]      = useState("50");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const pctNum    = parseFloat(pct) || 0;
  const splitAmt  = total * (pctNum / 100);

  async function submit() {
    if (pctNum <= 0 || pctNum > 100) { setError("Percent must be 1–100"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/root/invoices/${invoiceId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ split_label: label, split_percent: pctNum }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      onSuccess(d.invoice?.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Split failed");
    } finally { setSaving(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalCard title="Create Split Invoice" onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "6px 10px", background: `${G}0.06)`, border: `1px solid ${G}0.15)`, borderRadius: 4, fontSize: DT.font.xs, fontFamily: MONO, color: "#4ade80", opacity: 0.8 }}>
            Parent: {invoiceNumber} — {fmtAmt(total)}
          </div>
          <Row label="Label">
            <div style={{ display: "flex", gap: 4 }}>
              <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
              <button onClick={() => setLabel("1st HALF")} style={miniBtn}>1st Half</button>
              <button onClick={() => setLabel("2nd HALF")} style={miniBtn}>2nd Half</button>
            </div>
          </Row>
          <Row label="Percent">
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} style={{ ...inputStyle, width: 60 }} />
              <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)" }}>%</span>
              <span style={{ fontFamily: MONO, fontSize: DT.font.sm, fontWeight: 700, color: "var(--ink)", marginLeft: 4 }}>= {fmtAmt(splitAmt)}</span>
            </div>
          </Row>
          <div style={{ display: "flex", gap: 4 }}>
            {[25, 50, 75].map((p) => (
              <button key={p} onClick={() => setPct(String(p))} style={{ ...miniBtn, background: pctNum === p ? `${G}0.12)` : "transparent" }}>{p}%</button>
            ))}
          </div>
          {error && <div style={{ fontSize: DT.font.xs, color: "#f87171", fontFamily: MONO }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={submit} disabled={saving} style={primaryBtn}>{saving ? "Creating…" : "Create Split Invoice"}</button>
          </div>
        </div>
      </ModalCard>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════
   VOID CONFIRM MODAL
══════════════════════════════════════════════════════ */
function VoidConfirmModal({
  invoiceId, invoiceNumber, onClose, onSuccess,
}: { invoiceId: string; invoiceNumber: string; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function submit() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/root/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_status: "void", payment_status: "void" }),
      });
      if (!res.ok) throw new Error("Failed to void");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally { setSaving(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalCard title="Void Invoice" onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", borderRadius: 4, fontSize: DT.font.xs, color: "#f87171", fontFamily: MONO }}>
            ⚠ Voiding {invoiceNumber} is permanent. The invoice will be marked void and removed from collections.
          </div>
          {error && <div style={{ fontSize: DT.font.xs, color: "#f87171", fontFamily: MONO }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ ...primaryBtn, background: saving ? "rgba(239,68,68,0.4)" : "#ef4444" }}>{saving ? "Voiding…" : "Void Invoice"}</button>
          </div>
        </div>
      </ModalCard>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════
   SEND REMINDER MODAL
══════════════════════════════════════════════════════ */
function SendReminderModal({
  invoiceId, invoiceNumber, clientEmail, clientName, onClose, onSuccess,
}: { invoiceId: string; invoiceNumber: string; clientEmail?: string | null; clientName?: string | null; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function submit() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/root/invoices/${invoiceId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_number: invoiceNumber }),
      });
      if (!res.ok) throw new Error("Failed to queue reminder");
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reminder failed");
    } finally { setSaving(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalCard title="Send Reminder" onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: DT.font.sm, color: "var(--muted)", lineHeight: 1.5 }}>
            Send a payment reminder for <strong style={{ color: "var(--ink)" }}>{invoiceNumber}</strong> to{" "}
            <strong style={{ color: "#4ade80" }}>{clientEmail || clientName || "client"}</strong>.
          </div>
          <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${LINE}`, borderRadius: 4, fontSize: DT.font.xs, fontFamily: MONO, color: "var(--muted)", opacity: 0.6 }}>
            This will update last_reminder_at on the invoice.
          </div>
          {error && <div style={{ fontSize: DT.font.xs, color: "#f87171", fontFamily: MONO }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={submit} disabled={saving} style={primaryBtn}>{saving ? "Sending…" : "Send Reminder"}</button>
          </div>
        </div>
      </ModalCard>
    </Overlay>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN EXPORT: InvoiceDetailActions
   — Renders as a compact action bar to inject into the detail page
══════════════════════════════════════════════════════ */
export function InvoiceDetailActions({ invoiceId, invoiceNumber, total, balanceDue, clientEmail, clientName }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<"payment" | "reminder" | "void" | "split" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3200);
  }

  return (
    <>
      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <button
          onClick={() => setModal("payment")}
          style={{ padding: DT.btn.primary.pad, fontSize: DT.btn.primary.font, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.06em", color: "#0d1109", background: "#4ade80", border: "none", borderRadius: DT.btn.primary.radius, cursor: "pointer" }}
        >
          ✓ Record Payment
        </button>
        <button
          onClick={() => setModal("reminder")}
          style={{ padding: DT.btn.ghost.pad, fontSize: DT.btn.ghost.font, fontFamily: MONO, color: "var(--muted)", border: `1px solid ${LINE}`, borderRadius: DT.btn.ghost.radius, background: "transparent", cursor: "pointer" }}
        >
          🔔 Reminder
        </button>

        {/* More ··· */}
        <div style={{ position: "relative" }} ref={moreRef}>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            style={{ padding: DT.btn.ghost.pad, fontSize: DT.btn.ghost.font, fontFamily: MONO, color: "var(--muted)", border: `1px solid ${LINE}`, borderRadius: DT.btn.ghost.radius, background: "transparent", cursor: "pointer" }}
          >
            ···
          </button>
          {moreOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--surface)", border: `1px solid ${G}0.18)`, borderRadius: 5, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 170, zIndex: 200, overflow: "hidden" }}>
              {[
                { label: "✂ Create Split Invoice", fn: () => { setModal("split"); setMoreOpen(false); } },
                { label: "⊘ Void Invoice",         fn: () => { setModal("void"); setMoreOpen(false); }, danger: true },
              ].map((it) => (
                <button key={it.label} onClick={it.fn} style={{ display: "block", width: "100%", padding: "6px 12px", fontSize: DT.font.xs, fontFamily: MONO, color: it.danger ? "#f87171" : "var(--muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = it.danger ? "rgba(239,68,68,0.07)" : DT.hover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >{it.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "8px 16px", background: "#4ade80", color: "#0d1109", borderRadius: 6, fontFamily: MONO, fontSize: DT.font.sm, fontWeight: 700, zIndex: 400, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          {toastMsg}
        </div>
      )}

      {/* Modals */}
      {modal === "payment" && (
        <RecordPaymentModal
          invoiceId={invoiceId}
          balanceDue={balanceDue}
          onClose={() => setModal(null)}
          onSuccess={(amt) => { setModal(null); toast(`Payment of ${fmtAmt(amt)} recorded.`); router.refresh(); }}
        />
      )}
      {modal === "reminder" && (
        <SendReminderModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          clientEmail={clientEmail}
          clientName={clientName}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); toast("Reminder sent."); router.refresh(); }}
        />
      )}
      {modal === "void" && (
        <VoidConfirmModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); toast(`${invoiceNumber} voided.`); router.refresh(); }}
        />
      )}
      {modal === "split" && (
        <SplitInvoiceModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          total={total}
          onClose={() => setModal(null)}
          onSuccess={(newId) => { setModal(null); toast("Split invoice created."); if (newId) router.push(`/root/invoices/${newId}`); else router.refresh(); }}
        />
      )}
    </>
  );
}

/* ─── Shared primitives ─── */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalCard({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ width: 340, background: "var(--surface)", border: `1px solid ${G}0.20)`, borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontFamily: MONO, fontSize: DT.font.sm, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.55rem", opacity: 0.5 }}>✕</button>
      </div>
      <div style={{ padding: "14px 14px" }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--muted)", opacity: 0.45 }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  fontSize: DT.font.xs,
  fontFamily: MONO,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${LINE}`,
  borderRadius: 3,
  color: "var(--ink)",
  outline: "none",
};

const miniBtn: React.CSSProperties = {
  padding: "2px 7px",
  fontSize: DT.font.label,
  fontFamily: MONO,
  color: "var(--muted)",
  background: "transparent",
  border: `1px solid ${LINE}`,
  borderRadius: 3,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const primaryBtn: React.CSSProperties = {
  padding: DT.btn.primary.pad,
  fontSize: DT.btn.primary.font,
  fontFamily: MONO,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "#0d1109",
  background: "#4ade80",
  border: "none",
  borderRadius: DT.btn.primary.radius,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: DT.btn.ghost.pad,
  fontSize: DT.btn.ghost.font,
  fontFamily: MONO,
  color: "var(--muted)",
  background: "transparent",
  border: `1px solid ${LINE}`,
  borderRadius: DT.btn.ghost.radius,
  cursor: "pointer",
};
