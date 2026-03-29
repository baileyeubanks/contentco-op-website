"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DT } from "@/app/root/components/dt";
import { StatusPill } from "@/app/root/components/root-table";
import { QuoteLineItemEditor, type LineItem } from "@/app/root/components/quote-line-item-editor";

/* ─── Types ─── */
type Quote = {
  id: string;
  quote_number: string;
  business_unit: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_company: string | null;
  contact_id: string | null;
  service_address: string | null;
  estimated_total: number;
  internal_status: string;
  client_status: string;
  issue_date: string | null;
  valid_until: string | null;
  created_at: string;
  payment_terms: string | null;
  notes: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_ip: string | null;
  acceptance_method: string | null;
  signature_data: string | null;
  items: LineItem[];
  preview_url: string;
  pdf_url: string;
  share_link_url: string;
  conversion_readiness: boolean;
  next_action: string;
};

type QuoteView  = { id: string; ip_address: string | null; viewed_at: string };
type QuoteComment = { id: string; author: string; body: string; is_client: boolean; created_at: string };
type Tab = "overview" | "items" | "activity" | "agreement";

const G    = DT.G;
const LINE = DT.line;
const MONO = DT.font.mono;

const fmtAmt = (n?: number | null) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—";
const fmtDT = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" }) : "—";

function deriveStatus(q: Quote) {
  const now = new Date();
  if (q.valid_until && new Date(q.valid_until) < now && q.client_status !== "accepted") return "expired";
  if (q.client_status === "accepted") return "accepted";
  if (q.client_status === "declined") return "declined";
  if (q.internal_status === "converted_to_invoice") return "converted";
  if (q.client_status === "sent" || q.internal_status === "sent") return "sent";
  return q.internal_status || "draft";
}

function Field({ label, value, mono = false, large = false }: { label: string; value: React.ReactNode; mono?: boolean; large?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.13em", textTransform: "uppercase" as const, color: "var(--muted)", opacity: 0.38, lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: large ? DT.font.val : DT.font.md, fontFamily: mono ? MONO : DT.font.body, color: "var(--ink)", lineHeight: 1.4, fontWeight: large ? 700 : 400 }}>
        {value ?? <span style={{ opacity: 0.18 }}>—</span>}
      </span>
    </div>
  );
}

function SHead({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--muted)", opacity: 0.42 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `${G}0.08)` }} />
    </div>
  );
}

function SidebarLabel({ label }: { label: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: "0.42rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--muted)", opacity: 0.36, marginBottom: 6 }}>{label}</div>
  );
}

function TLItem({ icon, label, sub, accent }: { icon: string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 9, paddingBottom: 10, position: "relative" }}>
      {/* connector line */}
      <div style={{ position: "absolute", left: 8, top: 17, bottom: -3, width: 1, background: `${G}0.08)` }} />
      <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: accent ? `${G}0.14)` : "rgba(255,255,255,0.04)", border: `1px solid ${accent ? `${G}0.30)` : `rgba(255,255,255,0.08)`}`, fontSize: "0.42rem", zIndex: 1 }}>{icon}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingTop: 2 }}>
        <span style={{ fontSize: DT.font.sm, fontWeight: accent ? 600 : 500, color: accent ? "#4ade80" : "var(--ink)" }}>{label}</span>
        {sub && <span style={{ fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.38 }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function QuoteDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const quoteId = params.id as string;

  const [quote,    setQuote]    = useState<Quote | null>(null);
  const [views,    setViews]    = useState<QuoteView[]>([]);
  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>("overview");
  const [cmtBody,  setCmtBody]  = useState("");
  const [posting,  setPosting]  = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const sendRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  /* close dropdowns on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sendRef.current && !sendRef.current.contains(e.target as Node)) setSendOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* load data */
  useEffect(() => {
    if (!quoteId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/root/quotes/${quoteId}`).then((r) => r.json()),
      fetch(`/api/root/quotes/${quoteId}/views`).then((r) => r.json()).catch(() => ({ views: [] })),
      fetch(`/api/root/quotes/${quoteId}/comments`).then((r) => r.json()).catch(() => ({ comments: [] })),
    ]).then(([qd, vd, cd]) => {
      if (qd.quote) setQuote(qd.quote);
      setViews(vd.views ?? []);
      setComments(cd.comments ?? []);
    }).finally(() => setLoading(false));
  }, [quoteId]);

  async function postComment() {
    if (!cmtBody.trim() || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/root/quotes/${quoteId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "Team", body: cmtBody, is_client: false }),
      });
      const d = await r.json();
      if (d.comment) setComments((c) => [...c, d.comment]);
      setCmtBody("");
    } finally { setPosting(false); }
  }

  async function doConvert() {
    if (!confirm("Convert to invoice?")) return;
    const r = await fetch(`/api/quotes/${quoteId}/convert`, { method: "POST" });
    const d = await r.json();
    if (d.invoice?.id) router.push(`/root/invoices/${d.invoice.id}`);
  }

  async function doDelete() {
    if (!quote || !confirm(`Delete ${quote.quote_number}?`)) return;
    await fetch(`/api/root/quotes/${quoteId}`, { method: "DELETE" });
    router.push("/root/quotes");
  }

  if (loading) return <div style={{ padding: 24, fontFamily: MONO, fontSize: DT.font.sm, opacity: 0.3 }}>Loading…</div>;
  if (!quote)  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontFamily: MONO, fontSize: DT.font.sm, color: "#f87171", marginBottom: 8 }}>Quote not found.</div>
      <Link href="/root/quotes" style={{ fontSize: DT.font.sm, color: "#4ade80", textDecoration: "none" }}>← Back to Quotes</Link>
    </div>
  );

  const status    = deriveStatus(quote);
  const name      = quote.contact_name  || quote.client_name  || "Unknown Client";
  const email     = quote.contact_email || quote.client_email;
  const phone     = quote.contact_phone || quote.client_phone;
  const total     = quote.estimated_total || 0;

  /* ─────────────────────────── TOP BAR ─────────────────────────── */
  const topBar = (
    <div style={{
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px",
      borderBottom: `1px solid ${LINE}`,
      background: "rgba(0,0,0,0.14)",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
        <Link href="/root/quotes" style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.38, textDecoration: "none", flexShrink: 0, letterSpacing: "0.02em" }}>← Quotes</Link>
        <span style={{ color: `${G}0.25)`, opacity: 1, flexShrink: 0, fontSize: DT.font.xs }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: DT.font.sm, color: "#4ade80", fontWeight: 700, flexShrink: 0, letterSpacing: "0.04em" }}>
          {quote.quote_number || quoteId.slice(0, 8).toUpperCase()}
        </span>
        <span style={{ fontSize: DT.font.sm, color: "var(--muted)", opacity: 0.38, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {name}</span>
        <span style={{ fontFamily: MONO, fontSize: DT.font.md, fontWeight: 700, color: "var(--ink)", flexShrink: 0, letterSpacing: "-0.01em" }}>{fmtAmt(total)}</span>
        <StatusPill status={status} />
        <span style={{ fontFamily: MONO, fontSize: DT.font.xs, opacity: 0.18, flexShrink: 0, letterSpacing: "0.06em" }}>{quote.business_unit}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {/* Send ▾ */}
        <div style={{ position: "relative" }} ref={sendRef}>
          <button
            onClick={() => setSendOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: DT.btn.primary.pad, fontSize: DT.btn.primary.font, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.07em", color: "#0d1109", background: "#4ade80", border: "none", borderRadius: DT.btn.primary.radius, cursor: "pointer", boxShadow: "0 1px 8px rgba(74,222,128,0.25)" }}
          >
            ✉ Send ▾
          </button>
          {sendOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--surface, #111)", backdropFilter: "blur(8px)", border: `1px solid ${G}0.20)`, borderRadius: 6, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", minWidth: 158, zIndex: 200, overflow: "hidden", padding: "3px 0" }}>
              {[
                { label: "✉ Email to Client", fn: () => setSendOpen(false) },
                { label: "🔗 Copy Share Link", fn: () => { navigator.clipboard?.writeText(`${window.location.origin}${quote.share_link_url}`); setSendOpen(false); } },
                { label: "📄 Portal",          fn: () => setSendOpen(false) },
              ].map((it) => (
                <button key={it.label} onClick={it.fn} style={{ display: "block", width: "100%", padding: "5px 12px", fontSize: DT.font.xs, fontFamily: MONO, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", letterSpacing: "0.01em" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = DT.hover; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>{it.label}</button>
              ))}
            </div>
          )}
        </div>
        {/* Preview */}
        <a href={quote.preview_url} target="_blank" rel="noreferrer" style={{ padding: DT.btn.ghost.pad, fontSize: DT.btn.ghost.font, fontFamily: MONO, color: "var(--muted)", border: `1px solid ${LINE}`, borderRadius: DT.btn.ghost.radius, textDecoration: "none", letterSpacing: "0.04em" }}>👁 Preview</a>
        {/* ··· */}
        <div style={{ position: "relative" }} ref={moreRef}>
          <button onClick={() => setMoreOpen((v) => !v)} style={{ padding: DT.btn.ghost.pad, fontSize: DT.btn.ghost.font, fontFamily: MONO, color: "var(--muted)", border: `1px solid ${LINE}`, borderRadius: DT.btn.ghost.radius, background: "transparent", cursor: "pointer" }}>···</button>
          {moreOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--surface, #111)", backdropFilter: "blur(8px)", border: `1px solid ${G}0.18)`, borderRadius: 6, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", minWidth: 168, zIndex: 200, overflow: "hidden", padding: "3px 0" }}>
              {([
                { label: "⬇ Download PDF",       fn: () => { window.open(quote.pdf_url, "_blank"); setMoreOpen(false); } },
                { label: "📋 Duplicate",           fn: () => { fetch(`/api/root/quotes/${quoteId}/duplicate`, { method: "POST" }).then((r) => r.json()).then((d) => d.quote?.id && router.push(`/root/quotes/${d.quote.id}`)); setMoreOpen(false); } },
                quote.conversion_readiness ? { label: "🔄 Convert to Invoice", fn: () => { doConvert(); setMoreOpen(false); } } : null,
                { label: "🗑 Delete", fn: () => { doDelete(); setMoreOpen(false); }, danger: true },
              ] as Array<{ label: string; fn: () => void; danger?: boolean } | null>).filter(Boolean).map((it) => it && (
                <button key={it.label} onClick={it.fn} style={{ display: "block", width: "100%", padding: "5px 12px", fontSize: DT.font.xs, fontFamily: MONO, color: it.danger ? "#f87171" : "var(--muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", letterSpacing: "0.01em" }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = it.danger ? "rgba(239,68,68,0.07)" : DT.hover; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>{it.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────── TABS ─────────────────────────── */
  const tabLabels: Record<Tab, string> = { overview: "Overview", items: "Line Items", activity: "Activity", agreement: "Agreement" };
  const tabNav = (
    <div style={{ display: "flex", borderBottom: `1px solid ${LINE}`, padding: "0 12px", flexShrink: 0, background: "rgba(0,0,0,0.06)" }}>
      {(Object.keys(tabLabels) as Tab[]).map((t) => {
        const active = tab === t;
        return (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "7px 12px 6px",
              fontSize: DT.font.xs,
              fontFamily: MONO,
              fontWeight: active ? 700 : 500,
              letterSpacing: "0.07em",
              textTransform: "uppercase" as const,
              color: active ? "#4ade80" : "var(--muted)",
              background: active ? `${G}0.04)` : "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "#4ade80" : "transparent"}`,
              cursor: "pointer",
              marginBottom: -1,
              opacity: active ? 1 : 0.45,
              transition: "color 80ms, opacity 80ms",
            }}
            onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.opacity = "0.75"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; } }}
            onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.opacity = "0.45"; (e.currentTarget as HTMLElement).style.color = "var(--muted)"; } }}
          >
            {tabLabels[t]}
          </button>
        );
      })}
    </div>
  );

  /* ─────────────────────────── OVERVIEW ─────────────────────────── */
  const overviewTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 12px" }}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "10px 12px" }}>
        <SHead label="Client" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
          <Field label="Name"    value={name} />
          <Field label="Email"   value={email} />
          <Field label="Phone"   value={phone} />
          <Field label="Company" value={quote.contact_company} />
        </div>
        {quote.service_address && <div style={{ marginTop: 10 }}><Field label="Service Address" value={quote.service_address} /></div>}
        {quote.contact_id && <div style={{ marginTop: 8 }}><Link href={`/root/contacts/${quote.contact_id}`} style={{ fontSize: DT.font.xs, fontFamily: MONO, color: "#4ade80", opacity: 0.65, textDecoration: "none" }}>View contact record →</Link></div>}
      </div>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "10px 12px" }}>
        <SHead label="Details" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 16px" }}>
          <Field label="Issue Date"     value={fmtDate(quote.issue_date ?? quote.created_at)} />
          <Field label="Expires"        value={fmtDate(quote.valid_until)} />
          <Field label="Payment Terms"  value={quote.payment_terms} />
          <Field label="Business Unit"  value={quote.business_unit} mono />
          <Field label="Created"        value={fmtDT(quote.created_at)} />
          <Field label="Status"         value={<StatusPill status={status} />} />
        </div>
      </div>
      {quote.notes && (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "10px 12px" }}>
          <SHead label="Notes" />
          <p style={{ margin: 0, fontSize: DT.font.md, color: "var(--muted)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{quote.notes}</p>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────── ITEMS ─────────────────────────── */
  const itemsTab = (
    <div style={{ padding: 12 }}>
      <QuoteLineItemEditor quoteId={quoteId} initialItems={quote.items || []} businessUnit={quote.business_unit} />
    </div>
  );

  /* ─────────────────────────── ACTIVITY ─────────────────────────── */
  const activityTab = (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "10px 12px" }}>
        <SHead label="Timeline" />
        <TLItem icon="✦" label="Quote created" sub={fmtDT(quote.created_at)} />
        {(quote.internal_status === "sent" || quote.client_status === "sent") && <TLItem icon="✉" label={`Sent to ${email || name}`} sub={fmtDT(quote.issue_date)} accent />}
        {views.length > 0 && <TLItem icon="👁" label={`Viewed ${views.length}×`} sub={`Last: ${fmtDT(views[views.length - 1]?.viewed_at)}`} />}
        {quote.accepted_at && <TLItem icon="✓" label={`Accepted by ${quote.accepted_by_name || name}`} sub={fmtDT(quote.accepted_at)} accent />}
        {quote.client_status === "declined" && <TLItem icon="✗" label="Declined by client" />}
        {quote.internal_status === "converted_to_invoice" && <TLItem icon="🔄" label="Converted to invoice" accent />}
        {views.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--muted)", opacity: 0.32, marginBottom: 5 }}>View Log</div>
            {views.slice(-5).reverse().map((v) => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: `1px solid rgba(74,222,128,0.04)` }}>
                <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.4 }}>{v.ip_address || "—"}</span>
                <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.35 }}>{fmtDT(v.viewed_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "10px 12px" }}>
        <SHead label="Internal Notes" />
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
          {comments.length === 0 && <div style={{ fontFamily: MONO, fontSize: DT.font.xs, opacity: 0.18, textAlign: "center", padding: "8px 0" }}>No notes yet</div>}
          {comments.map((c) => (
            <div key={c.id} style={{ padding: "5px 8px", background: c.is_client ? `${G}0.05)` : "rgba(255,255,255,0.025)", borderRadius: 3, border: `1px solid ${c.is_client ? `${G}0.12)` : LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontFamily: MONO, fontSize: DT.font.xs, fontWeight: 700, color: c.is_client ? "#4ade80" : "var(--muted)" }}>{c.author}</span>
                <span style={{ fontFamily: MONO, fontSize: DT.font.label, color: "var(--muted)", opacity: 0.32 }}>{fmtDT(c.created_at)}</span>
              </div>
              <p style={{ margin: 0, fontSize: DT.font.sm, color: "var(--muted)", lineHeight: 1.5 }}>{c.body}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <input value={cmtBody} onChange={(e) => setCmtBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }} placeholder="Add note…" style={{ flex: 1, padding: "4px 8px", fontSize: DT.font.xs, fontFamily: MONO, background: "rgba(255,255,255,0.03)", border: `1px solid ${LINE}`, borderRadius: 3, color: "var(--ink)", outline: "none" }} />
          <button onClick={postComment} disabled={!cmtBody.trim() || posting} style={{ padding: "4px 10px", fontSize: DT.font.xs, fontFamily: MONO, color: "#0d1109", background: cmtBody.trim() ? "#4ade80" : "rgba(74,222,128,0.18)", border: "none", borderRadius: 3, cursor: cmtBody.trim() ? "pointer" : "default" }}>Post</button>
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────── AGREEMENT ─────────────────────────── */
  const agreementTab = (
    <div style={{ padding: 12 }}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "10px 12px" }}>
        <SHead label="Acceptance Status" />
        {quote.accepted_at ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: `${G}0.08)`, border: `1px solid ${G}0.20)`, borderRadius: 4 }}>
              <span style={{ fontSize: "0.65rem", color: "#4ade80" }}>✓</span>
              <span style={{ fontFamily: MONO, fontSize: DT.font.sm, color: "#4ade80", fontWeight: 700 }}>Accepted</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              <Field label="Accepted At" value={fmtDT(quote.accepted_at)} />
              <Field label="Accepted By" value={quote.accepted_by_name} />
              <Field label="Method"      value={quote.acceptance_method} />
              <Field label="IP Address"  value={quote.accepted_ip} />
            </div>
            {quote.signature_data && (
              <div>
                <div style={{ fontFamily: MONO, fontSize: DT.font.label, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--muted)", opacity: 0.35, marginBottom: 6 }}>Signature</div>
                <div style={{ padding: 8, background: "white", borderRadius: 3, display: "inline-block" }}>
                  <img src={quote.signature_data} alt="Signature" style={{ maxWidth: 280, height: "auto", display: "block" }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.025)", border: `1px solid ${LINE}`, borderRadius: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.sm, color: "var(--muted)", opacity: 0.4 }}>Not yet accepted</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.3 }}>Share: <span style={{ color: "#4ade80" }}>/share/quote/{quoteId}</span></div>
          </div>
        )}
      </div>
    </div>
  );

  /* ─────────────────────────── SIDEBAR ─────────────────────────── */
  const SBtn = ({ children, onClick, style: extraStyle = {} }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "5px 10px",
        fontSize: DT.font.xs,
        fontFamily: MONO,
        letterSpacing: "0.04em",
        color: "var(--muted)",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        cursor: "pointer",
        textAlign: "center" as const,
        transition: "background 60ms, border-color 60ms",
        ...extraStyle,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = DT.hover; (e.currentTarget as HTMLElement).style.borderColor = `${G}0.20)`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = LINE; }}
    >
      {children}
    </button>
  );

  const sidebar = (
    <div style={{ width: DT.sidebar.w, flexShrink: 0, borderLeft: `1px solid ${LINE}`, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 62px)", overflowY: "auto", position: "sticky", top: 0, background: "rgba(0,0,0,0.06)" }}>

      {/* ── Status ── */}
      <div style={{ padding: "10px 12px 9px", borderBottom: `1px solid ${LINE}` }}>
        <SidebarLabel label="Status" />
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: status === "accepted" ? "#4ade80" : status === "overdue" || status === "expired" ? "#f87171" : status === "sent" ? "#4ade80" : "rgba(255,255,255,0.25)", boxShadow: status === "accepted" || status === "sent" ? "0 0 6px rgba(74,222,128,0.6)" : "none" }} />
          <StatusPill status={status} />
        </div>
      </div>

      {/* ── Primary actions ── */}
      <div style={{ padding: "9px 10px", borderBottom: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={() => setSendOpen(true)}
          style={{ width: "100%", padding: "7px 10px", fontSize: DT.font.xs, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.07em", color: "#0d1109", background: "#4ade80", border: "none", borderRadius: 4, cursor: "pointer", boxShadow: "0 1px 10px rgba(74,222,128,0.22)" }}
        >
          ✉ Send Quote
        </button>
        <SBtn><a href={quote.preview_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>👁 Preview PDF</a></SBtn>
        <SBtn><a href={quote.pdf_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>⬇ Download PDF</a></SBtn>
        <SBtn onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${quote.share_link_url}`)}>🔗 Copy Share Link</SBtn>
      </div>

      {/* ── Secondary ── */}
      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 3 }}>
        {quote.conversion_readiness && (
          <button onClick={doConvert} style={{ width: "100%", padding: "5px 10px", fontSize: DT.font.xs, fontFamily: MONO, letterSpacing: "0.04em", color: "#4ade80", background: `${G}0.07)`, border: `1px solid ${G}0.18)`, borderRadius: 4, cursor: "pointer" }}>🔄 Convert to Invoice</button>
        )}
        <SBtn onClick={() => { fetch(`/api/root/quotes/${quoteId}/duplicate`, { method: "POST" }).then((r) => r.json()).then((d) => d.quote?.id && router.push(`/root/quotes/${d.quote.id}`)); }}>📋 Duplicate</SBtn>
        <button
          onClick={doDelete}
          style={{ width: "100%", padding: "4px 10px", fontSize: DT.font.xs, fontFamily: MONO, color: "rgba(239,68,68,0.5)", background: "transparent", border: `1px solid rgba(239,68,68,0.12)`, borderRadius: 4, cursor: "pointer" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.06)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,0.5)"; }}
        >🗑 Delete</button>
      </div>

      {/* ── Client ── */}
      <div style={{ padding: "9px 12px", borderBottom: `1px solid ${LINE}` }}>
        <SidebarLabel label="Client" />
        <div style={{ fontSize: DT.font.xs, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--ink)", fontSize: DT.font.sm }}>{name}</span>
          {email && <span style={{ opacity: 0.5 }}>{email}</span>}
          {phone && <span style={{ opacity: 0.4 }}>{phone}</span>}
          {quote.contact_company && <span style={{ opacity: 0.35 }}>{quote.contact_company}</span>}
        </div>
      </div>

      {/* ── Financials ── */}
      <div style={{ padding: "9px 12px", borderBottom: `1px solid ${LINE}` }}>
        <SidebarLabel label="Financial" />
        {/* Big total */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: "0.90rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1 }}>
            {fmtAmt(total)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[
            { l: "Valid Until", v: fmtDate(quote.valid_until), danger: !!(quote.valid_until && new Date(quote.valid_until) < new Date()) },
            { l: "Line Items",  v: String((quote.items || []).length) },
            ...(views.length > 0 ? [{ l: "Views", v: String(views.length), danger: false }] : []),
          ].map(({ l, v, danger }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.38 }}>{l}</span>
              <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: danger ? "#f87171" : "var(--muted)", opacity: 0.65 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Next step ── */}
      {quote.next_action && (
        <div style={{ padding: "8px 12px" }}>
          <SidebarLabel label="Next Step" />
          <div style={{ fontSize: DT.font.xs, color: "#4ade80", opacity: 0.6, lineHeight: 1.5, fontFamily: MONO }}>{quote.next_action}</div>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", overflow: "hidden" }}>
      {topBar}
      {tabNav}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          {tab === "overview"   && overviewTab}
          {tab === "items"      && itemsTab}
          {tab === "activity"   && activityTab}
          {tab === "agreement"  && agreementTab}
        </div>
        {sidebar}
      </div>
    </div>
  );
}
