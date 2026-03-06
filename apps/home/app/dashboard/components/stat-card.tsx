"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
}

export function StatCard({ label, value, color, subtitle }: StatCardProps) {
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
      {subtitle && (
        <div style={{
          fontSize: "0.72rem",
          color: "var(--muted)",
          marginTop: 4,
        }}>{subtitle}</div>
      )}
    </div>
  );
}
