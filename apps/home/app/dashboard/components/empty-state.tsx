"use client";

import React from "react";
import Link from "next/link";

interface EmptyStateProps {
  variant?: "empty" | "error" | "loading";
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
}

const icons: Record<string, string> = {
  empty: "◇",
  error: "⚠",
  loading: "◎",
};

export function EmptyState({ variant = "empty", title, description, action }: EmptyStateProps) {
  return (
    <div style={containerStyle}>
      <div style={iconStyle}>{icons[variant]}</div>
      <div style={titleStyle}>{title}</div>
      {description && <div style={descStyle}>{description}</div>}
      {action && (
        action.href ? (
          <Link href={action.href} style={actionStyle}>{action.label}</Link>
        ) : (
          <button type="button" onClick={action.onClick} style={actionStyle}>{action.label}</button>
        )
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 8,
  padding: "48px 24px",
  textAlign: "center",
};

const iconStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "var(--root-muted, var(--muted))",
  opacity: 0.5,
  marginBottom: 4,
};

const titleStyle: React.CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 600,
  color: "var(--root-muted, var(--muted))",
};

const descStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--root-muted, var(--muted))",
  opacity: 0.7,
  maxWidth: "36ch",
};

const actionStyle: React.CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  padding: "8px 18px",
  borderRadius: 8,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.03)",
  color: "var(--root-accent, #4ade80)",
  fontSize: "0.82rem",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};
