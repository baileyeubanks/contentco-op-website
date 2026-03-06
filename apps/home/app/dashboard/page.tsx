"use client";

import { useState, useEffect } from "react";
import { Nav } from "@contentco-op/ui";

/* ─── Types ─── */
interface Contact {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  business_unit: string;
  status: string;
  created_at: string;
  last_activity?: string;
}

interface FinanceRow {
  id: string;
  type: "invoice" | "payment" | "quote";
  description: string;
  amount: number;
  status: string;
  business_unit: string;
  date: string;
  contact_name?: string;
}

type Tab = "contacts" | "finance";
type BizFilter = "ALL" | "ACS" | "CC";

/* ─── Supabase Helpers ─── */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function sbFetch(table: string, query = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return [];
  return res.json();
}

/* ─── Dashboard Page ─── */
export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("contacts");
  const [biz, setBiz] = useState<BizFilter>("ALL");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    if (tab === "contacts") {
      sbFetch("contacts", "select=*&order=created_at.desc&limit=200")
        .then((data) => { setContacts(data || []); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      Promise.all([
        sbFetch("invoices", "select=id,invoice_number,amount,tax,total,status,business_unit,created_at,contact_id&order=created_at.desc&limit=100"),
        sbFetch("quotes", "select=id,quote_number,total,status,business_unit,created_at,client_name&order=created_at.desc&limit=100"),
      ]).then(([inv, quo]) => {
        const rows: FinanceRow[] = [
          ...(inv || []).map((i: any) => ({
            id: i.id,
            type: "invoice" as const,
            description: i.invoice_number || `INV-${String(i.id).slice(0, 8)}`,
            amount: i.total || i.amount || 0,
            status: i.status || "draft",
            business_unit: i.business_unit || "ACS",
            date: i.created_at,
            contact_name: "",
          })),
          ...(quo || []).map((q: any) => ({
            id: q.id,
            type: "quote" as const,
            description: q.quote_number || `Q-${String(q.id).slice(0, 8)}`,
            amount: q.total || 0,
            status: q.status || "draft",
            business_unit: q.business_unit || "ACS",
            date: q.created_at,
            contact_name: q.client_name || "",
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setFinance(rows);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [tab]);

  const filteredContacts = contacts.filter((c) => {
    if (biz !== "ALL" && (c.business_unit || "ACS").toUpperCase() !== biz) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (c.full_name || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.company || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const filteredFinance = finance.filter((f) => {
    if (biz !== "ALL" && (f.business_unit || "ACS").toUpperCase() !== biz) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        f.description.toLowerCase().includes(s) ||
        (f.contact_name || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalRevenue = filteredFinance
    .filter((f) => f.type === "invoice" && f.status === "paid")
    .reduce((sum, f) => sum + f.amount, 0);

  const totalOutstanding = filteredFinance
    .filter((f) => f.type === "invoice" && ["sent", "overdue"].includes(f.status))
    .reduce((sum, f) => sum + f.amount, 0);

  const totalQuoted = filteredFinance
    .filter((f) => f.type === "quote" && ["pending", "sent"].includes(f.status))
    .reduce((sum, f) => sum + f.amount, 0);

  return (
    <div data-surface="product" style={{
      minHeight: "100vh",
      background: "var(--bg, #0c1322)",
      color: "var(--ink, #edf3ff)",
      fontFamily: "var(--font-body)",
    }}>
      <Nav surface="home" />

      {/* ─── Header ─── */}
      <header style={{
        padding: "16px 32px",
        borderBottom: "1px solid var(--line, #243248)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(12,19,34,0.92)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.1rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}>Dashboard</h1>

          {/* Tabs */}
          <nav style={{ display: "flex", gap: 4 }}>
            {(["contacts", "finance"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: tab === t ? "var(--cta, #102641)" : "transparent",
                  border: `1px solid ${tab === t ? "var(--cta-line, #3f618f)" : "transparent"}`,
                  color: tab === t ? "var(--cta-ink, #e8f1ff)" : "var(--muted, #9cadc8)",
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {/* Business Filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["ALL", "ACS", "CC"] as BizFilter[]).map((b) => (
            <button
              key={b}
              onClick={() => setBiz(b)}
              style={{
                background: biz === b ? "rgba(139,164,196,0.15)" : "transparent",
                border: `1px solid ${biz === b ? "var(--accent, #8ba4c4)" : "rgba(255,255,255,0.07)"}`,
                color: biz === b ? "var(--ink)" : "var(--muted)",
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: "0.72rem",
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px" }}>

        {/* ─── Search Bar ─── */}
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "10px 16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "var(--ink)",
              fontSize: "0.88rem",
              outline: "none",
            }}
          />
        </div>

        {/* ─── CONTACTS TAB ─── */}
        {tab === "contacts" && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 32,
            }}>
              <StatCard label="Total Contacts" value={filteredContacts.length} />
              <StatCard label="ACS" value={filteredContacts.filter(c => (c.business_unit || "ACS") === "ACS").length} color="#3d7dd8" />
              <StatCard label="Content Co-Op" value={filteredContacts.filter(c => (c.business_unit || "ACS") === "CC").length} color="#8ba4c4" />
            </div>

            {loading ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>Loading contacts...</p>
            ) : filteredContacts.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>
                {SUPABASE_URL ? "No contacts found." : "Connect Supabase to load contacts. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."}
              </p>
            ) : (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Phone</th>
                      <th style={thStyle}>Company</th>
                      <th style={thStyle}>BU</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.slice(0, 50).map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={tdStyle}><strong>{c.full_name || "—"}</strong></td>
                        <td style={tdStyle}>{c.email || "—"}</td>
                        <td style={tdStyle}>{c.phone || "—"}</td>
                        <td style={tdStyle}>{c.company || "—"}</td>
                        <td style={tdStyle}>
                          <BuBadge bu={c.business_unit || "ACS"} />
                        </td>
                        <td style={tdStyle}>
                          <StatusDot status={c.status || "active"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ─── FINANCE TAB ─── */}
        {tab === "finance" && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 32,
            }}>
              <StatCard label="Revenue (Paid)" value={`$${totalRevenue.toLocaleString()}`} color="#3ec983" />
              <StatCard label="Outstanding" value={`$${totalOutstanding.toLocaleString()}`} color="#e4ad5b" />
              <StatCard label="Quoted (Pipeline)" value={`$${totalQuoted.toLocaleString()}`} color="#8ba4c4" />
            </div>

            {loading ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>Loading finance data...</p>
            ) : filteredFinance.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>
                {SUPABASE_URL ? "No finance records found." : "Connect Supabase to load finance data."}
              </p>
            ) : (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Number</th>
                      <th style={thStyle}>Client</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>BU</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinance.slice(0, 50).map((f) => (
                      <tr key={`${f.type}-${f.id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: f.type === "invoice" ? "#3ec983" : "#8ba4c4",
                          }}>{f.type}</span>
                        </td>
                        <td style={tdStyle}><strong>{f.description}</strong></td>
                        <td style={tdStyle}>{f.contact_name || "—"}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          ${f.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={tdStyle}><BuBadge bu={f.business_unit || "ACS"} /></td>
                        <td style={tdStyle}><StatusDot status={f.status} /></td>
                        <td style={{ ...tdStyle, color: "var(--muted)" }}>
                          {new Date(f.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-Components ─── */
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted, #9cadc8)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <div style={{
        fontSize: "0.72rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: "1.8rem",
        fontWeight: 700,
        color: color || "var(--ink)",
        letterSpacing: "-0.02em",
      }}>{value}</div>
    </div>
  );
}

function BuBadge({ bu }: { bu: string }) {
  const isACS = bu.toUpperCase() === "ACS";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: "0.68rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: isACS ? "rgba(61,125,216,0.12)" : "rgba(139,164,196,0.12)",
      color: isACS ? "#3d7dd8" : "#8ba4c4",
      border: `1px solid ${isACS ? "rgba(61,125,216,0.2)" : "rgba(139,164,196,0.2)"}`,
    }}>
      {bu.toUpperCase()}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let color = "var(--muted)";
  if (["active", "paid", "confirmed", "completed"].includes(s)) color = "#3ec983";
  else if (["pending", "sent", "awaiting_approval"].includes(s)) color = "#e4ad5b";
  else if (["overdue", "cancelled", "declined", "failed"].includes(s)) color = "#de7676";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}40`,
      }} />
      {status}
    </span>
  );
}
