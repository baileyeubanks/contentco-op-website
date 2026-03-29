"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Overview", href: "/root/overview", icon: "◆" },
  { label: "Dispatch", href: "/root/dispatch", icon: "◉" },
  { label: "Quotes", href: "/root/quotes", icon: "◈" },
  { label: "Contacts", href: "/root/contacts", icon: "◎" },
  { label: "Finance", href: "/root/finance", icon: "◌" },
  { label: "System", href: "/root/system", icon: "◇" },
  { label: "Work Claims", href: "/root/work-claims", icon: "⋄" },
];

export function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/root/overview") return pathname === "/root/overview" || pathname === "/root";
    return pathname.startsWith(href);
  }

  return (
    <nav style={sidebar}>
      {/* Brand mark */}
      <div style={brandWrap}>
        <div style={brandMark}>
          <span style={brandDot} />
          <span style={brandName}>root</span>
        </div>
        <div style={brandSub}>standalone ops core</div>
      </div>

      {/* Nav section */}
      <div style={navSection}>
        <div style={sectionLabel}>navigate</div>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} style={navLink(active)}>
              <span style={navIcon(active)}>{item.icon}</span>
              <span>{item.label}</span>
              {active && <span style={activeIndicator} />}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div style={footer}>
        <div style={footerVersion}>v0.1</div>
      </div>
    </nav>
  );
}

/* ─── Styles ─── */

const sidebar: React.CSSProperties = {
  width: 180,
  minHeight: "100vh",
  background: "var(--surface)",
  borderRight: "1px solid var(--line)",
  padding: 0,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
};

const brandWrap: React.CSSProperties = {
  padding: "18px 16px 14px",
  borderBottom: "1px solid var(--line)",
};

const brandMark: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const brandDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "var(--accent)",
  boxShadow: "0 0 8px var(--accent)",
  flexShrink: 0,
};

const brandName: React.CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 740,
  letterSpacing: "-0.02em",
  color: "var(--ink)",
};

const brandSub: React.CSSProperties = {
  fontSize: "0.58rem",
  color: "var(--muted)",
  marginTop: 3,
  marginLeft: 14,
  letterSpacing: "0.06em",
  opacity: 0.6,
};

const navSection: React.CSSProperties = {
  padding: "12px 0 0",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "0.56rem",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--muted)",
  opacity: 0.4,
  padding: "0 16px 6px",
};

const navLink = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 16px",
  fontSize: "0.76rem",
  fontWeight: active ? 640 : 480,
  color: active ? "var(--ink)" : "var(--muted)",
  background: active ? "rgba(74,222,128,0.06)" : "transparent",
  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
  textDecoration: "none",
  transition: "all 140ms ease",
  letterSpacing: "0.01em",
  position: "relative",
});

const navIcon = (active: boolean): React.CSSProperties => ({
  fontSize: "0.68rem",
  opacity: active ? 0.8 : 0.3,
  transition: "opacity 140ms ease",
});

const activeIndicator: React.CSSProperties = {
  position: "absolute",
  right: 12,
  width: 4,
  height: 4,
  borderRadius: "50%",
  background: "var(--accent)",
  boxShadow: "0 0 6px var(--accent)",
};

const footer: React.CSSProperties = {
  padding: "12px 16px",
  borderTop: "1px solid var(--line)",
};

const footerVersion: React.CSSProperties = {
  fontSize: "0.56rem",
  color: "var(--muted)",
  opacity: 0.35,
  letterSpacing: "0.06em",
};
