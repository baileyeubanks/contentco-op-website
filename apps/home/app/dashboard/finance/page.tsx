"use client";

import { useState, useEffect } from "react";
import { StatCard } from "../components/stat-card";
import { BuBadge } from "../components/bu-badge";
import { StatusDot } from "../components/status-dot";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function sbFetch(table: string, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return [];
  return res.json();
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
  source?: string;
}

type BizFilter = "ALL" | "ACS" | "CC";
type TypeFilter = "ALL" | "invoice" | "quote";

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

export default function FinancePage() {
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [biz, setBiz] = useState<BizFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/root/finance")
      .then((res) => res.json())
      .then((data) => {
        setFinance(data.finance || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = finance.filter((f) => {
    if (biz !== "ALL" && (f.business_unit || "ACS").toUpperCase() !== biz) return false;
    if (typeFilter !== "ALL" && f.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return f.description.toLowerCase().includes(s) || (f.contact_name || "").toLowerCase().includes(s);
    }
    return true;
  });

  const totalRevenue = filtered
    .filter((f) => f.type === "invoice" && f.status === "paid")
    .reduce((sum, f) => sum + f.amount, 0);

  const totalOutstanding = filtered
    .filter((f) => f.type === "invoice" && ["sent", "overdue"].includes(f.status))
    .reduce((sum, f) => sum + f.amount, 0);

  const totalQuoted = filtered
    .filter((f) => f.type === "quote" && ["pending", "sent"].includes(f.status))
    .reduce((sum, f) => sum + f.amount, 0);

  const bankStatementCount = filtered.filter(f => f.source === "bank_statement").length;

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
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
            fontSize: "1.2rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}>Finance</h1>
          {bankStatementCount > 0 && (
            <p style={{ fontSize: "0.72rem", color: "#e4ad5b", marginTop: 4 }}>
              ⚠ {bankStatementCount} entries from parsed bank statements — review for accuracy
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {/* Type filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "invoice", "quote"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  background: typeFilter === t ? "rgba(139,164,196,0.15)" : "transparent",
                  border: `1px solid ${typeFilter === t ? "var(--accent, #8ba4c4)" : "rgba(255,255,255,0.07)"}`,
                  color: typeFilter === t ? "var(--ink)" : "var(--muted)",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >{t === "ALL" ? "ALL" : t === "invoice" ? "INV" : "QTE"}</button>
            ))}
          </div>

          {/* BU filter */}
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
              >{b}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Revenue (Paid)" value={`$${totalRevenue.toLocaleString()}`} color="#3ec983" />
        <StatCard label="Outstanding" value={`$${totalOutstanding.toLocaleString()}`} color="#e4ad5b" />
        <StatCard label="Quoted (Pipeline)" value={`$${totalQuoted.toLocaleString()}`} color="#8ba4c4" />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search finance records..."
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

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>Loading finance data...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>No finance records found.</p>
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
                <th style={thStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((f) => (
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
                  <td style={tdStyle}>
                    {f.type === "quote" ? (
                      <a href={`/root/quotes/${f.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>{f.description}</a>
                    ) : (
                      <strong>{f.description}</strong>
                    )}
                  </td>
                  <td style={tdStyle}>{f.contact_name || "—"}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    ${f.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={tdStyle}><BuBadge bu={f.business_unit || "ACS"} /></td>
                  <td style={tdStyle}><StatusDot status={f.status} /></td>
                  <td style={{ ...tdStyle, color: "var(--muted)" }}>
                    {new Date(f.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td style={tdStyle}>
                    {f.source === "bank_statement" && (
                      <span style={{
                        fontSize: "0.64rem",
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "rgba(228,173,91,0.15)",
                        color: "#e4ad5b",
                        fontWeight: 600,
                      }}>PARSED</span>
                    )}
                    {f.source === "auto" && (
                      <span style={{
                        fontSize: "0.64rem",
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: "rgba(139,164,196,0.15)",
                        color: "#8ba4c4",
                        fontWeight: 600,
                      }}>AUTO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div style={{ padding: "12px 14px", fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
              Showing 100 of {filtered.length} records
            </div>
          )}
        </div>
      )}
    </div>
  );
}
