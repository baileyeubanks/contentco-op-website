"use client";

import React, { useState, useEffect } from "react";

export interface BuyerInfo {
  name: string;
  email: string;
  phone: string;
  company: string;
  address?: string;
}

interface BuyerFormProps {
  buyer: BuyerInfo;
  onChange: (buyer: BuyerInfo) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "var(--ink)",
  fontSize: "0.82rem",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.64rem",
  fontWeight: 600,
  color: "var(--muted)",
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export function BuyerForm({ buyer, onChange }: BuyerFormProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<any>(null);

  function handleNameChange(value: string) {
    onChange({ ...buyer, name: value });

    // Debounced contact search
    if (searchTimeout) clearTimeout(searchTimeout);
    if (value.length >= 2) {
      const timeout = setTimeout(async () => {
        try {
          const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
          const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/contacts?full_name=ilike.*${encodeURIComponent(value)}*&select=id,full_name,email,phone,company&limit=5`,
            {
              headers: {
                apikey: SUPABASE_ANON,
                Authorization: `Bearer ${SUPABASE_ANON}`,
              },
            }
          );
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data || []);
            setShowSuggestions(data.length > 0);
          }
        } catch {
          // silent
        }
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function selectContact(contact: any) {
    onChange({
      name: contact.full_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      address: buyer.address,
    });
    setShowSuggestions(false);
  }

  return (
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
        marginBottom: 14,
        color: "var(--muted)",
      }}>Client Information</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <label style={labelStyle}>Client Name</label>
          <input
            type="text"
            value={buyer.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Start typing to search contacts..."
            style={inputStyle}
          />
          {showSuggestions && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 100,
              background: "rgba(12,19,34,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              marginTop: 4,
              overflow: "hidden",
            }}>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  onMouseDown={() => selectContact(s)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontSize: "0.78rem",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                    {[s.company, s.email].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Company</label>
          <input
            type="text"
            value={buyer.company}
            onChange={(e) => onChange({ ...buyer, company: e.target.value })}
            placeholder="Company name"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={buyer.email}
            onChange={(e) => onChange({ ...buyer, email: e.target.value })}
            placeholder="client@example.com"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Phone</label>
          <input
            type="tel"
            value={buyer.phone}
            onChange={(e) => onChange({ ...buyer, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
            style={inputStyle}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Address (Optional)</label>
          <input
            type="text"
            value={buyer.address || ""}
            onChange={(e) => onChange({ ...buyer, address: e.target.value })}
            placeholder="Street, City, State ZIP"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
