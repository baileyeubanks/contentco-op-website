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

type BizFilter = "ALL" | "ACS" | "CC";

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [biz, setBiz] = useState<BizFilter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/root/contacts")
      .then((res) => res.json())
      .then((data) => { setContacts(data.contacts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = contacts.filter((c) => {
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

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}>Contacts</h1>

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

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Contacts" value={filtered.length} />
        <StatCard label="ACS" value={filtered.filter(c => (c.business_unit || "ACS") === "ACS").length} color="#3d7dd8" />
        <StatCard label="Content Co-op" value={filtered.filter(c => (c.business_unit || "ACS") === "CC").length} color="#8ba4c4" />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search contacts..."
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
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>Loading contacts...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>No contacts found.</p>
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
              {filtered.slice(0, 100).map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={tdStyle}><strong>{c.full_name || "—"}</strong></td>
                  <td style={tdStyle}>{c.email || "—"}</td>
                  <td style={tdStyle}>{c.phone || "—"}</td>
                  <td style={tdStyle}>{c.company || "—"}</td>
                  <td style={tdStyle}><BuBadge bu={c.business_unit || "ACS"} /></td>
                  <td style={tdStyle}><StatusDot status={c.status || "active"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div style={{ padding: "12px 14px", fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>
              Showing 100 of {filtered.length} contacts
            </div>
          )}
        </div>
      )}
    </div>
  );
}
