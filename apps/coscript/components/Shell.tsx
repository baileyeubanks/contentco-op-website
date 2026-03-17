"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  PenTool,
  Search,
  Archive,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const NAV = [
  { href: "/", label: "Studio", icon: LayoutDashboard },
  { href: "/scripts", label: "Scripts", icon: FileText },
  { href: "/editor", label: "New Script", icon: PenTool },
  { href: "/research", label: "Research", icon: Search },
  { href: "/vault", label: "Vault", icon: Archive },
  { href: "/frameworks", label: "Frameworks", icon: BookOpen },
];

const PRODUCT_LINKS = [
  {
    href: process.env.NEXT_PUBLIC_MONOREPO_URL ?? "https://github.com/baileyeubanks/blaze-v4",
    label: "Monorepo",
    external: true,
  },
  {
    href: process.env.NEXT_PUBLIC_COCUT_URL ?? "http://localhost:5173",
    label: "co-cut",
    external: false,
  },
  {
    href: process.env.NEXT_PUBLIC_COSCRIPT_URL ?? "http://localhost:4102",
    label: "co-script",
    external: false,
  },
  {
    href: process.env.NEXT_PUBLIC_CODELIVER_URL ?? "http://localhost:4103",
    label: "co-deliver",
    external: false,
  },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: collapsed ? 64 : 220,
          background: "var(--surface)",
          borderRight: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: collapsed ? "1.25rem 0.5rem" : "1.25rem 1rem",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 0 4px var(--accent-dim)",
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>co-script</span>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => router.push("/editor")}
            className="btn btn-primary btn-sm"
            style={{ margin: "0.75rem 1rem 0" }}
          >
            <Plus size={14} /> New Script
          </button>
        )}

        <nav style={{ flex: 1, padding: "0.75rem 0.5rem" }}>
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: collapsed ? "0.5rem" : "0.5rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "0.125rem",
                  fontSize: "0.85rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--accent)" : "var(--muted)",
                  background: active ? "var(--accent-dim)" : "transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                  transition: "all 0.15s",
                }}
              >
                <item.icon size={18} />
                {!collapsed && item.label}
              </a>
            );
          })}
        </nav>

        <div style={{ padding: "0.75rem 0.5rem", borderTop: "1px solid var(--line)" }}>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: collapsed ? "0.5rem" : "0.5rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              color: "var(--muted)",
              background: "transparent",
              width: "100%",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <LogOut size={18} />
            {!collapsed && "Log out"}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--muted)",
              background: "transparent",
              width: "100%",
              marginTop: "0.25rem",
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            borderBottom: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "0.75rem 1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Monorepo Apps
            </span>
            {PRODUCT_LINKS.map((item) => {
              const active = item.label === "co-script";
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  style={{
                    border: "1px solid var(--line)",
                    borderColor: active ? "var(--accent)" : "var(--line)",
                    background: active ? "var(--accent-dim)" : "transparent",
                    color: active ? "var(--accent)" : "var(--muted)",
                    borderRadius: 999,
                    padding: "0.35rem 0.7rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </header>
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
