"use client";

import React from "react";
import Link from "next/link";

type BizFilter = "ALL" | "ACS" | "CC";

interface PageHeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  biz?: BizFilter;
  onBizChange?: (value: BizFilter) => void;
  scopeOptions?: BizFilter[];
  actions?: PageHeaderAction[];
  refreshedAt?: Date | null;
  onRefresh?: () => void;
}

export function PageHeader({ title, subtitle, biz, onBizChange, scopeOptions = ["ALL", "ACS", "CC"], actions, refreshedAt, onRefresh }: PageHeaderProps) {
  return (
    <div style={headerStyle}>
      <div>
        <h1 style={titleStyle}>{title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={subtitleStyle}>{subtitle}</p>
          {refreshedAt && (
            <span style={freshStyle}>
              Updated {formatRelativeTime(refreshedAt)}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onRefresh && (
          <button type="button" onClick={onRefresh} style={refreshBtnStyle} title="Refresh data">
            ↻
          </button>
        )}
        {biz !== undefined && onBizChange && (
          scopeOptions.length === 1 ? (
            <div style={lockedScopeStyle}>
              workspace {scopeOptions[0].toLowerCase()}
            </div>
          ) : (
            <div style={scopeToggleStyle}>
              {scopeOptions.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onBizChange(entry)}
                  style={scopeBtnStyle(biz === entry)}
                >
                  {entry}
                </button>
              ))}
            </div>
          )
        )}
        {actions?.map((action) => {
          if (action.href) {
            return (
              <Link key={action.label} href={action.href} style={action.primary ? primaryBtnStyle : secondaryBtnStyle}>
                {action.label}
              </Link>
            );
          }
          return (
            <button key={action.label} type="button" onClick={action.onClick} style={action.primary ? primaryBtnStyle : secondaryBtnStyle}>
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 28,
  gap: 16,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: "1.5rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.2,
};

const subtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "0.88rem",
  color: "var(--root-muted, var(--muted))",
};

const freshStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: "0.68rem",
  fontFamily: "var(--font-mono)",
  color: "var(--root-muted, var(--muted))",
  opacity: 0.7,
  letterSpacing: "0.04em",
};

const scopeToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 8,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  overflow: "hidden",
};

const scopeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "7px 14px",
  fontSize: "0.78rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  border: "none",
  cursor: "pointer",
  color: active ? "var(--ink)" : "var(--root-muted, var(--muted))",
  background: active ? "rgba(74,222,128,0.12)" : "transparent",
  transition: "all 140ms ease",
});

const lockedScopeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(74,222,128,0.08)",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.72rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 18px",
  borderRadius: 8,
  background: "var(--root-accent, #4ade80)",
  color: "#0a1628",
  fontSize: "0.82rem",
  fontWeight: 700,
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 18px",
  borderRadius: 8,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.03)",
  color: "var(--root-muted, var(--muted))",
  fontSize: "0.82rem",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};

const refreshBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.03)",
  color: "var(--root-muted, var(--muted))",
  fontSize: "1rem",
  cursor: "pointer",
  transition: "all 140ms ease",
};
