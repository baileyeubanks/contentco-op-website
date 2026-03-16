"use client";

import React, { useState, useEffect, useRef } from "react";

/* ── Types ── */

interface Quote {
  id: string;
  quote_number: string | null;
  client_name: string | null;
  estimated_total: number | null;
  business_unit: string | null;
  client_status: string | null;
  accepted_at: string | null;
  valid_until: string | null;
  created_at: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  total: number | null;
  balance_due: number | null;
  payment_status: string | null;
  status: string | null;
  due_date: string | null;
  due_at: string | null;
  created_at: string | null;
  business_unit: string | null;
  stripe_payment_link: string | null;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  method: string;
  status: string;
  reference_number: string | null;
  paid_at: string | null;
}

interface Message {
  id: string;
  sender: "client" | "team";
  body: string;
  created_at: string;
}

type Tab = "quotes" | "invoices" | "payments" | "messages";

interface Props {
  token: string;
  contactName: string;
}

/* ── Helpers ── */

function formatMoney(value: number | null) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(status: string | null, type: "quote" | "invoice" | "payment") {
  const s = String(status || "").toLowerCase();
  let bg = "#f1f5f9";
  let color = "#64748b";

  if (s === "accepted" || s === "paid" || s === "completed") {
    bg = "#ecfdf5"; color = "#065f46";
  } else if (s === "sent" || s === "issued" || s === "viewed") {
    bg = "#eff6ff"; color = "#1e40af";
  } else if (s === "rejected" || s === "overdue" || s === "failed") {
    bg = "#fef2f2"; color = "#991b1b";
  } else if (s === "draft" || s === "pending" || s === "partial") {
    bg = "#fffbeb"; color = "#92400e";
  }

  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {s || "—"}
    </span>
  );
}

/* ── Component ── */

export function ClientPortal({ token, contactName }: Props) {
  const [tab, setTab] = useState<Tab>("invoices");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/client/${token}`).then((r) => r.json()),
      fetch(`/api/client/${token}/messages`).then((r) => r.json()),
    ])
      .then(([data, msgData]) => {
        setQuotes(data.quotes || []);
        setInvoices(data.invoices || []);
        setPayments(data.payments || []);
        setMessages(msgData.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/client/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
      setNewMessage("");
    } catch {
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const brandColor = "#1B4F72";

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? brandColor : "#888",
    borderBottom: `2px solid ${active ? brandColor : "transparent"}`,
    background: "none",
    border: "none",
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: active ? brandColor : "transparent",
    cursor: "pointer",
    transition: "all 150ms ease",
  });

  const cardStyle: React.CSSProperties = {
    padding: "16px 20px",
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
    marginBottom: 10,
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#fafafa", display: "grid", placeItems: "center" }}>
        <div style={{ fontSize: 14, color: "#888" }}>Loading your portal...</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ padding: "20px 32px", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: brandColor, marginBottom: 2 }}>
          Client Portal
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>
          Welcome, {contactName}
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 32px", display: "flex", gap: 0 }}>
        {(
          [
            ["invoices", `Invoices (${invoices.length})`],
            ["quotes", `Quotes (${quotes.length})`],
            ["payments", `Payments (${payments.length})`],
            ["messages", `Messages (${messages.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 32px" }}>
        {/* Invoices Tab */}
        {tab === "invoices" && (
          <div>
            {invoices.length === 0 && (
              <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0" }}>No invoices yet.</div>
            )}
            {invoices.map((inv) => {
              const dueStr = inv.due_date || inv.due_at;
              return (
                <div key={inv.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{inv.invoice_number || `INV-${inv.id.slice(0, 8)}`}</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                        Due {formatDate(dueStr)} · {statusBadge(inv.payment_status, "invoice")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{formatMoney(inv.total)}</div>
                      {Number(inv.balance_due || 0) > 0 && Number(inv.balance_due) !== Number(inv.total) && (
                        <div style={{ fontSize: 11, color: "#888" }}>Balance: {formatMoney(inv.balance_due)}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <a
                      href={`/share/invoice/${inv.id}`}
                      style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${brandColor}`, color: brandColor, textDecoration: "none", background: "#fff" }}
                    >
                      View Invoice
                    </a>
                    {inv.stripe_payment_link && String(inv.payment_status || "").toLowerCase() !== "paid" && (
                      <a
                        href={inv.stripe_payment_link}
                        style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: brandColor, color: "#fff", textDecoration: "none" }}
                      >
                        Pay Now
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quotes Tab */}
        {tab === "quotes" && (
          <div>
            {quotes.length === 0 && (
              <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0" }}>No quotes yet.</div>
            )}
            {quotes.map((q) => (
              <div key={q.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{q.quote_number || `Q-${q.id.slice(0, 8)}`}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {formatDate(q.created_at)} · {statusBadge(q.client_status, "quote")}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{formatMoney(q.estimated_total)}</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <a
                    href={`/share/quote/${q.id}`}
                    style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${brandColor}`, color: brandColor, textDecoration: "none", background: "#fff" }}
                  >
                    View Quote
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payments Tab */}
        {tab === "payments" && (
          <div>
            {payments.length === 0 && (
              <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0" }}>No payments recorded yet.</div>
            )}
            {payments.map((p) => (
              <div key={p.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(p.amount_cents / 100)}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                      {formatDate(p.paid_at)} · {p.method} · {statusBadge(p.status, "payment")}
                    </div>
                  </div>
                  {p.reference_number && (
                    <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                      {p.reference_number.slice(0, 16)}...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Messages Tab */}
        {tab === "messages" && (
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Messages</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Communicate with our team about your quotes and invoices.</div>
            </div>
            <div style={{ padding: "16px 20px", minHeight: 200, maxHeight: 400, overflowY: "auto" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: "40px 0" }}>
                  No messages yet. Start a conversation below.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: m.sender === "client" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      maxWidth: "75%",
                      fontSize: 13,
                      lineHeight: 1.5,
                      background: m.sender === "client" ? brandColor : "#f1f5f9",
                      color: m.sender === "client" ? "#fff" : "#333",
                    }}
                  >
                    {m.body}
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 3, padding: "0 4px" }}>
                    {m.sender === "team" ? "Team" : "You"} · {formatDate(m.created_at)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Type a message..."
                style={{ flex: 1, padding: "10px 14px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db", outline: "none", fontFamily: "inherit" }}
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  background: !newMessage.trim() ? "#e2e8f0" : brandColor,
                  color: !newMessage.trim() ? "#94a3b8" : "#fff",
                  cursor: !newMessage.trim() ? "default" : "pointer",
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
