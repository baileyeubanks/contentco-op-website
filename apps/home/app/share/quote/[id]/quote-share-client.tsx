"use client";

import React, { useState, useEffect, useRef } from "react";

/* ── Types ── */

interface QuoteData {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  client_email: string | null;
  estimated_total: number | null;
  business_unit: string | null;
  client_status: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  notes: string | null;
  valid_until: string | null;
  created_at: string | null;
}

interface TermsSection {
  title: string;
  body: string;
}

interface Comment {
  id: string;
  sender: "client" | "team";
  body: string;
  created_at: string;
}

interface Props {
  quote: QuoteData;
  terms: TermsSection[];
  previewUrl: string;
  pdfUrl: string;
  brandName: string;
  brandColor: string;
  accentColor: string;
}

type Tab = "scope" | "agreement" | "messages";

/* ── Component ── */

export function QuoteShareClient({
  quote,
  terms,
  previewUrl,
  pdfUrl,
  brandName,
  brandColor,
  accentColor,
}: Props) {
  const [tab, setTab] = useState<Tab>("scope");
  const [status, setStatus] = useState(quote.client_status || "pending");
  const [accepting, setAccepting] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState(quote.accepted_at);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAccepted = status === "accepted";
  const isRejected = status === "rejected";
  const isChangesRequested = status === "changes_requested";
  const total = Number(quote.estimated_total || 0);

  /* Track view on mount */
  useEffect(() => {
    fetch(`/api/share/quote/${quote.id}/view`, { method: "POST" }).catch(() => {});
  }, [quote.id]);

  /* Load comments */
  useEffect(() => {
    fetch(`/api/share/quote/${quote.id}/comment`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments || []))
      .catch(() => {});
  }, [quote.id]);

  /* Scroll to bottom on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/share/quote/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStatus("accepted");
      setAcceptedAt(data.accepted_at);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    try {
      const res = await fetch(`/api/share/quote/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("rejected");
      setShowRejectConfirm(false);
    } catch {
      alert("Something went wrong. Please try again.");
    }
  }

  async function handleRequestChanges() {
    try {
      const res = await fetch(`/api/share/quote/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_changes", comment: changeReason }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("changes_requested");
      setShowChangesForm(false);
      setChangeReason("");
      const cRes = await fetch(`/api/share/quote/${quote.id}/comment`);
      const cData = await cRes.json();
      setComments(cData.comments || []);
    } catch {
      alert("Something went wrong. Please try again.");
    }
  }

  async function handleSendComment() {
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/share/quote/${quote.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newComment }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
      }
      setNewComment("");
    } catch {
      alert("Failed to send message.");
    } finally {
      setSendingComment(false);
    }
  }

  const fmtDate = (v: string | null | undefined, long?: boolean) => {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return long
      ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const fmtMoney = (v: number) =>
    v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "";

  return (
    <>
      {/* Responsive styles */}
      <style>{`
        .qs-main { min-height:100vh; background:#fafafa; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; color:#333; }
        .qs-banner { padding:8px 16px; text-align:center; font-size:11px; font-weight:600; }
        .qs-banner-ok { background:#ecfdf5; border-bottom:1px solid #a7f3d0; color:#065f46; }
        .qs-banner-bad { background:#fef2f2; border-bottom:1px solid #fca5a5; color:#991b1b; }
        .qs-banner-warn { background:#fffbeb; border-bottom:1px solid #fcd34d; color:#92400e; }

        .qs-header { padding:12px 16px; background:#fff; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
        .qs-brand { font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:1px; }
        .qs-title { font-size:14px; font-weight:700; color:#111; line-height:1.3; }
        .qs-subtitle { font-size:10px; color:#888; margin-top:1px; }
        .qs-header-actions { display:flex; gap:6px; align-items:center; flex-shrink:0; }

        .qs-btn { padding:5px 12px; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; transition:all 120ms ease; text-decoration:none; display:inline-block; line-height:1.4; }
        .qs-btn-outline { border:1px solid; background:#fff; }
        .qs-btn-solid { border:none; color:#fff; }
        .qs-btn:hover { opacity:0.88; }
        .qs-btn-sm { padding:4px 10px; font-size:10px; }
        .qs-btn-lg { padding:6px 16px; font-size:11px; font-weight:700; }

        .qs-tabs { background:#fff; border-bottom:1px solid #e5e7eb; padding:0 16px; display:flex; gap:0; overflow-x:auto; }
        .qs-tab { padding:8px 14px; font-size:11px; font-weight:500; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:all 120ms; white-space:nowrap; }
        .qs-tab:hover { color:#333 !important; }
        .qs-tab-active { font-weight:700; }

        .qs-content { max-width:880px; margin:0 auto; padding:16px; }
        .qs-card { background:#fff; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.06); }

        /* Agreement */
        .qs-agree { padding:20px 24px; }
        .qs-agree h2 { font-size:15px; font-weight:700; color:#111; margin:0 0 4px; }
        .qs-agree-intro { font-size:11px; color:#888; margin-bottom:20px; line-height:1.5; }
        .qs-agree-section { margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #f1f5f9; }
        .qs-agree-section:last-of-type { border-bottom:none; padding-bottom:0; }
        .qs-agree-section h3 { font-size:12px; font-weight:700; color:#111; margin:0 0 3px; }
        .qs-agree-section p { font-size:11px; color:#555; line-height:1.6; margin:0; white-space:pre-wrap; }

        .qs-accept-box { margin-top:20px; padding:14px 18px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; }
        .qs-accept-box-title { font-size:12px; font-weight:700; color:#111; margin-bottom:4px; }
        .qs-accept-box-text { font-size:10px; color:#666; line-height:1.5; margin-bottom:10px; }
        .qs-accept-actions { display:flex; gap:6px; flex-wrap:wrap; }

        .qs-status-box { margin-top:20px; padding:12px 16px; border-radius:6px; }
        .qs-status-title { font-size:12px; font-weight:700; }
        .qs-status-detail { font-size:10px; margin-top:2px; }

        /* Messages */
        .qs-msg-header { padding:12px 16px; border-bottom:1px solid #e5e7eb; }
        .qs-msg-header h2 { font-size:13px; font-weight:700; color:#111; margin:0; }
        .qs-msg-header p { font-size:10px; color:#888; margin:2px 0 0; }
        .qs-msg-list { padding:12px 16px; min-height:160px; max-height:360px; overflow-y:auto; }
        .qs-msg-empty { text-align:center; color:#aaa; font-size:11px; padding:32px 0; }
        .qs-bubble { padding:7px 10px; border-radius:10px; max-width:75%; font-size:11px; line-height:1.4; }
        .qs-msg-meta { font-size:9px; color:#aaa; margin-top:2px; padding:0 3px; }
        .qs-compose { padding:8px 16px 10px; border-top:1px solid #e5e7eb; display:flex; gap:6px; }
        .qs-compose input { flex:1; padding:7px 10px; font-size:11px; border-radius:6px; border:1px solid #d1d5db; outline:none; font-family:inherit; }
        .qs-compose button { padding:7px 14px; border-radius:6px; font-size:11px; font-weight:700; border:none; cursor:pointer; transition:all 120ms; }

        /* Floating bar */
        .qs-float { position:fixed; bottom:0; left:0; right:0; padding:8px 16px; background:rgba(255,255,255,0.97); border-top:1px solid #e5e7eb; backdrop-filter:blur(8px); display:flex; justify-content:space-between; align-items:center; z-index:50; }
        .qs-float-total { font-size:11px; color:#555; }
        .qs-float-total strong { font-size:13px; color:#111; }
        .qs-float-actions { display:flex; gap:6px; }

        /* Forms */
        .qs-form-box { margin-top:10px; padding:10px 12px; background:#fff; border-radius:5px; border:1px solid #e2e8f0; }
        .qs-form-label { font-size:11px; font-weight:600; margin-bottom:4px; }
        .qs-form-textarea { width:100%; min-height:60px; padding:7px 9px; font-size:11px; border-radius:5px; border:1px solid #d1d5db; outline:none; resize:vertical; font-family:inherit; }
        .qs-form-actions { display:flex; gap:6px; margin-top:8px; }

        .qs-reject-box { margin-top:10px; padding:10px 12px; background:#fef2f2; border-radius:5px; border:1px solid #fca5a5; }
        .qs-reject-text { font-size:11px; font-weight:600; color:#991b1b; margin-bottom:6px; }

        /* Scope tab detail bar (desktop) */
        .qs-scope-meta { display:none; }

        /* ── Desktop ── */
        @media (min-width: 768px) {
          .qs-header { padding:14px 24px; }
          .qs-brand { font-size:10px; }
          .qs-title { font-size:16px; }
          .qs-subtitle { font-size:11px; }
          .qs-tabs { padding:0 24px; }
          .qs-tab { padding:9px 16px; font-size:12px; }
          .qs-content { padding:20px 24px; }

          .qs-btn { padding:6px 14px; font-size:11px; }
          .qs-btn-lg { padding:7px 20px; font-size:12px; }

          .qs-agree { padding:24px 32px; }
          .qs-agree h2 { font-size:16px; }
          .qs-agree-intro { font-size:12px; margin-bottom:24px; }
          .qs-agree-section { margin-bottom:20px; }
          .qs-agree-section h3 { font-size:13px; }
          .qs-agree-section p { font-size:12px; line-height:1.65; }

          .qs-accept-box { padding:16px 20px; }
          .qs-accept-box-title { font-size:13px; }
          .qs-accept-box-text { font-size:11px; }

          .qs-msg-header { padding:14px 20px; }
          .qs-msg-header h2 { font-size:14px; }
          .qs-msg-header p { font-size:11px; }
          .qs-msg-list { padding:14px 20px; max-height:420px; }
          .qs-bubble { padding:8px 12px; font-size:12px; }
          .qs-msg-meta { font-size:10px; }
          .qs-compose { padding:10px 20px 12px; }
          .qs-compose input { padding:8px 12px; font-size:12px; }
          .qs-compose button { padding:8px 16px; font-size:12px; }

          .qs-float { padding:10px 24px; }
          .qs-float-total { font-size:12px; }
          .qs-float-total strong { font-size:14px; }

          .qs-scope-meta { display:flex; gap:16px; padding:10px 16px; background:#fff; border-radius:6px 6px 0 0; border:1px solid #e5e7eb; border-bottom:none; font-size:11px; color:#666; flex-wrap:wrap; }
          .qs-scope-meta span { display:flex; align-items:center; gap:4px; }
          .qs-scope-meta strong { font-weight:600; color:#333; }
        }

        @media (min-width: 1024px) {
          .qs-content { max-width:960px; padding:20px 32px; }
          .qs-header { padding:16px 32px; }
          .qs-tabs { padding:0 32px; }
          .qs-agree { padding:28px 36px; }
        }
      `}</style>

      <main className="qs-main">
        {/* Status Banner */}
        {isAccepted && (
          <div className="qs-banner qs-banner-ok">
            Quote accepted{acceptedAt ? ` on ${fmtDate(acceptedAt, true)}` : ""}
          </div>
        )}
        {isRejected && (
          <div className="qs-banner qs-banner-bad">Quote declined</div>
        )}
        {isChangesRequested && (
          <div className="qs-banner qs-banner-warn">Changes requested — we&apos;ll be in touch</div>
        )}

        {/* Header */}
        <header className="qs-header">
          <div>
            <div className="qs-brand" style={{ color: brandColor }}>{brandName}</div>
            <div className="qs-title">
              {quote.quote_number || "Quote"}{quote.client_name ? ` — ${quote.client_name}` : ""}
            </div>
            <div className="qs-subtitle">
              {fmtMoney(total)}
              {quote.valid_until ? ` · Valid until ${fmtDate(quote.valid_until)}` : ""}
              {quote.created_at ? ` · Created ${fmtDate(quote.created_at)}` : ""}
            </div>
          </div>
          <div className="qs-header-actions">
            <a href={pdfUrl} target="_blank" rel="noopener" className="qs-btn qs-btn-outline" style={{ borderColor: brandColor, color: brandColor }}>
              PDF
            </a>
            {!isAccepted && !isRejected && (
              <button onClick={handleAccept} disabled={accepting} className="qs-btn qs-btn-solid qs-btn-lg" style={{ background: accepting ? "#94a3b8" : accentColor, cursor: accepting ? "not-allowed" : "pointer" }}>
                {accepting ? "Accepting..." : "Accept Quote"}
              </button>
            )}
          </div>
        </header>

        {/* Tabs */}
        <nav className="qs-tabs">
          {([
            ["scope", "Scope & Pricing"],
            ["agreement", "Agreement"],
            ["messages", `Messages${comments.length > 0 ? ` (${comments.length})` : ""}`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`qs-tab${tab === key ? " qs-tab-active" : ""}`}
              style={{
                color: tab === key ? brandColor : "#888",
                borderBottomColor: tab === key ? brandColor : "transparent",
              }}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="qs-content">
          {/* ── Scope & Pricing ── */}
          {tab === "scope" && (
            <div>
              {/* Desktop detail bar */}
              <div className="qs-scope-meta">
                {quote.quote_number && <span>Quote: <strong>{quote.quote_number}</strong></span>}
                {quote.client_name && <span>Client: <strong>{quote.client_name}</strong></span>}
                {quote.business_unit && <span>Division: <strong>{quote.business_unit === "acs" ? "Astro Cleaning Services" : "Content Co-Op"}</strong></span>}
                {total > 0 && <span>Total: <strong>{fmtMoney(total)}</strong></span>}
                {quote.valid_until && <span>Expires: <strong>{fmtDate(quote.valid_until)}</strong></span>}
                {quote.created_at && <span>Issued: <strong>{fmtDate(quote.created_at)}</strong></span>}
              </div>
              <iframe
                src={previewUrl}
                style={{
                  width: "100%",
                  minHeight: "calc(100vh - 240px)",
                  border: "none",
                  borderRadius: "0 0 6px 6px",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  background: "#fff",
                }}
                title={`Quote ${quote.quote_number}`}
              />
            </div>
          )}

          {/* ── Agreement ── */}
          {tab === "agreement" && (
            <div className="qs-card qs-agree">
              <h2>Service Agreement</h2>
              <p className="qs-agree-intro">
                Please review the following terms before accepting this quote. By clicking &quot;Accept Quote&quot;, you agree to the terms outlined below.
              </p>

              {terms.length > 0 ? (
                terms.map((section, idx) => (
                  <div key={idx} className="qs-agree-section">
                    <h3>{idx + 1}. {section.title}</h3>
                    <p>{section.body}</p>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                  No specific terms have been attached to this quote.
                </p>
              )}

              {/* Acceptance CTA */}
              {!isAccepted && !isRejected && (
                <div className="qs-accept-box">
                  <div className="qs-accept-box-title">Ready to proceed?</div>
                  <div className="qs-accept-box-text">
                    By accepting, you confirm that you have read and agree to the scope of work and terms above. This constitutes a binding agreement.
                  </div>
                  <div className="qs-accept-actions">
                    <button onClick={handleAccept} disabled={accepting} className="qs-btn qs-btn-solid qs-btn-lg" style={{ background: accepting ? "#94a3b8" : accentColor, cursor: accepting ? "not-allowed" : "pointer" }}>
                      {accepting ? "Processing..." : "Accept Quote"}
                    </button>
                    <button onClick={() => setShowChangesForm(true)} className="qs-btn qs-btn-outline" style={{ borderColor: "#d1d5db", color: "#555" }}>
                      Request Changes
                    </button>
                    <button onClick={() => setShowRejectConfirm(true)} className="qs-btn qs-btn-outline" style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                      Decline
                    </button>
                  </div>

                  {/* Request Changes Form */}
                  {showChangesForm && (
                    <div className="qs-form-box">
                      <div className="qs-form-label">What changes would you like?</div>
                      <textarea
                        className="qs-form-textarea"
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Describe the changes you'd like..."
                      />
                      <div className="qs-form-actions">
                        <button onClick={handleRequestChanges} className="qs-btn qs-btn-solid" style={{ background: "#f59e0b" }}>
                          Submit Request
                        </button>
                        <button onClick={() => { setShowChangesForm(false); setChangeReason(""); }} className="qs-btn qs-btn-outline" style={{ borderColor: "#d1d5db", color: "#555" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reject Confirmation */}
                  {showRejectConfirm && (
                    <div className="qs-reject-box">
                      <div className="qs-reject-text">Are you sure you want to decline this quote?</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={handleReject} className="qs-btn qs-btn-solid" style={{ background: "#dc2626" }}>
                          Yes, Decline
                        </button>
                        <button onClick={() => setShowRejectConfirm(false)} className="qs-btn qs-btn-outline" style={{ borderColor: "#d1d5db", color: "#555" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Already accepted */}
              {isAccepted && (
                <div className="qs-status-box" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                  <div className="qs-status-title" style={{ color: "#065f46" }}>Quote Accepted</div>
                  <div className="qs-status-detail" style={{ color: "#047857" }}>
                    Accepted by {quote.accepted_by_name || quote.client_name || "client"}
                    {acceptedAt ? ` on ${new Date(acceptedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Messages ── */}
          {tab === "messages" && (
            <div className="qs-card">
              <div className="qs-msg-header">
                <h2>Messages</h2>
                <p>Ask questions or discuss details about this quote.</p>
              </div>

              <div className="qs-msg-list">
                {comments.length === 0 && (
                  <div className="qs-msg-empty">No messages yet. Start the conversation below.</div>
                )}
                {comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: c.sender === "client" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      className="qs-bubble"
                      style={{
                        background: c.sender === "client" ? brandColor : "#f1f5f9",
                        color: c.sender === "client" ? "#fff" : "#333",
                      }}
                    >
                      {c.body}
                    </div>
                    <div className="qs-msg-meta">
                      {c.sender === "team" ? brandName : "You"} · {new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="qs-compose">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  placeholder="Type a message..."
                />
                <button
                  onClick={handleSendComment}
                  disabled={sendingComment || !newComment.trim()}
                  style={{
                    background: !newComment.trim() ? "#e2e8f0" : brandColor,
                    color: !newComment.trim() ? "#94a3b8" : "#fff",
                    cursor: !newComment.trim() ? "default" : "pointer",
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Floating Accept Bar */}
        {tab === "scope" && !isAccepted && !isRejected && (
          <div className="qs-float">
            <div className="qs-float-total">
              Total: <strong>{fmtMoney(total)}</strong>
            </div>
            <div className="qs-float-actions">
              <button onClick={() => setTab("agreement")} className="qs-btn qs-btn-outline" style={{ borderColor: "#d1d5db", color: "#555" }}>
                Review Agreement
              </button>
              <button onClick={handleAccept} disabled={accepting} className="qs-btn qs-btn-solid qs-btn-lg" style={{ background: accepting ? "#94a3b8" : accentColor, cursor: accepting ? "not-allowed" : "pointer" }}>
                {accepting ? "Accepting..." : "Accept Quote"}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
