"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { RootBrandKey } from "@/lib/root-brand";
import {
  getRootModulesForWorkspace,
  type RootModuleDef,
} from "@/lib/root-module-registry";

/* ─── Constants ─── */
const G = "rgba(74,222,128,";
const LINE = `${G}0.10)`;
const MONO = "var(--font-mono), monospace";

const SIDEBAR_W = 118;
const SIDEBAR_COLLAPSED_W = 30;
const TOPBAR_H = 26;

/* Pages that should NOT show the shell chrome */
const BARE_PATHS = ["/root", "/root/login"];

/* ─── Types ─── */
type BuScope = "ALL" | "ACS" | "CC";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("root-sidebar-collapsed") === "1";
}

function getInitialBuScope(): BuScope {
  if (typeof window === "undefined") return "ALL";
  const saved = window.localStorage.getItem("root-bu-scope");
  return saved === "ACS" || saved === "CC" || saved === "ALL" ? saved : "ALL";
}

/* ─── Shell ─── */
export function RootShell({
  brandKey,
  children,
}: {
  brandKey: RootBrandKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [buScope, setBuScope] = useState<BuScope>(getInitialBuScope);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const cmdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("root-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem("root-bu-scope", buScope);
  }, [buScope]);

  /* Keyboard shortcuts */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        setCmdQuery("");
        return;
      }
      if (e.key === "Escape" && cmdOpen) {
        setCmdOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const modules = getRootModulesForWorkspace(brandKey);
      const match = modules.find(
        (m) => m.shortcut?.toLowerCase() === e.key.toLowerCase()
      );
      if (match) window.location.href = match.href;
      if (e.key === "[") setCollapsed((c) => !c);
    },
    [brandKey, cmdOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (cmdOpen && cmdRef.current) cmdRef.current.focus();
  }, [cmdOpen]);

  /* Bare pages — no shell chrome */
  if (BARE_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  const coreModules = getRootModulesForWorkspace(brandKey, "core");
  const advancedModules = getRootModulesForWorkspace(brandKey, "advanced");
  const sideW = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ─── Sidebar ─── */}
      <nav
        style={{
          width: sideW,
          minHeight: "100vh",
          background: "var(--surface, rgba(255,255,255,0.02))",
          borderRight: `1px solid ${LINE}`,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          transition: "width 160ms ease",
          overflow: "hidden",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            padding: collapsed ? "5px 4px" : "5px 8px",
            borderBottom: `1px solid ${LINE}`,
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            minHeight: TOPBAR_H,
          }}
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand [" : "Collapse ["}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: "0.48rem",
                fontWeight: 740,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                whiteSpace: "nowrap",
              }}
            >
              root
            </span>
          )}
        </div>

        {/* BU Scope Toggle */}
        {!collapsed && (
          <div
            style={{
              padding: "3px 6px 2px",
              display: "flex",
              gap: 1,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            {(["ALL", "ACS", "CC"] as BuScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setBuScope(s)}
                style={{
                  flex: 1,
                  padding: "1px 0",
                  fontSize: "0.34rem",
                  fontFamily: MONO,
                  fontWeight: buScope === s ? 700 : 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: buScope === s ? "#4ade80" : "var(--muted)",
                  background: buScope === s ? `${G}0.08)` : "transparent",
                  border: `1px solid ${buScope === s ? `${G}0.18)` : "transparent"}`,
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "all 100ms ease",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Core modules */}
        <div style={{ padding: "3px 0 0" }}>
          {!collapsed && <div style={sectionLabelStyle}>modules</div>}
          {coreModules.map((m) => (
            <NavItem key={m.id} mod={m} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>

        {/* Advanced modules */}
        {advancedModules.length > 0 && (
          <div style={{ padding: "2px 0 0" }}>
            {!collapsed && <div style={sectionLabelStyle}>advanced</div>}
            {advancedModules.map((m) => (
              <NavItem key={m.id} mod={m} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div
          style={{
            padding: collapsed ? "4px 2px" : "4px 8px",
            borderTop: `1px solid ${LINE}`,
          }}
        >
          {!collapsed && (
            <div
              style={{
                fontSize: "0.32rem",
                color: "var(--muted)",
                opacity: 0.25,
                fontFamily: MONO,
                letterSpacing: "0.06em",
              }}
            >
              v0.2 · ⌘K · [ toggle
            </div>
          )}
        </div>
      </nav>

      {/* ─── Main area ─── */}
      <div
        style={{
          flex: 1,
          marginLeft: sideW,
          transition: "margin-left 160ms ease",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: TOPBAR_H,
            borderBottom: `1px solid ${LINE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            background: "var(--surface, rgba(255,255,255,0.02))",
            position: "sticky",
            top: 0,
            zIndex: 90,
            backdropFilter: "blur(12px)",
          }}
        >
          <Breadcrumb pathname={pathname} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => { setCmdOpen(true); setCmdQuery(""); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 5px",
                fontSize: "0.36rem",
                fontFamily: MONO,
                letterSpacing: "0.06em",
                color: "var(--muted)",
                background: `${G}0.04)`,
                border: `1px solid ${LINE}`,
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <span>⌘K</span>
            </button>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: `${G}0.10)`,
                border: `1px solid ${LINE}`,
                display: "grid",
                placeItems: "center",
                fontSize: "0.34rem",
                fontWeight: 700,
                color: "#4ade80",
              }}
            >
              B
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1 }}>{children}</main>
      </div>

      {/* ─── Command Bar Overlay ─── */}
      {cmdOpen && (
        <CommandBar
          query={cmdQuery}
          setQuery={setCmdQuery}
          inputRef={cmdRef}
          brandKey={brandKey}
          onClose={() => setCmdOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── NavItem ─── */
function NavItem({
  mod,
  pathname,
  collapsed,
}: {
  mod: RootModuleDef;
  pathname: string;
  collapsed: boolean;
}) {
  const active =
    mod.href === "/root/overview"
      ? pathname === "/root/overview" || pathname === "/root"
      : pathname.startsWith(mod.href);

  return (
    <Link
      href={mod.href}
      title={collapsed ? `${mod.label} (${mod.shortcut})` : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: collapsed ? "3px 0" : "2px 8px",
        justifyContent: collapsed ? "center" : "flex-start",
        fontSize: "0.44rem",
        fontWeight: active ? 640 : 480,
        color: active ? "var(--ink)" : "var(--muted)",
        background: active ? `${G}0.06)` : "transparent",
        borderLeft: collapsed
          ? "none"
          : active
          ? "2px solid #4ade80"
          : "2px solid transparent",
        textDecoration: "none",
        transition: "all 100ms ease",
        letterSpacing: "0.01em",
        position: "relative",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontSize: collapsed ? "0.46rem" : "0.4rem",
          opacity: active ? 0.9 : 0.3,
          flexShrink: 0,
        }}
      >
        {mod.icon}
      </span>
      {!collapsed && <span>{mod.label}</span>}
      {!collapsed && mod.shortcut && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.3rem",
            fontFamily: MONO,
            opacity: 0.2,
            fontWeight: 600,
          }}
        >
          {mod.shortcut}
        </span>
      )}
      {active && collapsed && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2,
            height: 10,
            borderRadius: 1,
            background: "#4ade80",
            boxShadow: "0 0 4px #4ade80",
          }}
        />
      )}
    </Link>
  );
}

/* ─── Breadcrumb ─── */
function Breadcrumb({ pathname }: { pathname: string }) {
  const parts = pathname.replace("/root/", "").split("/").filter(Boolean);
  if (parts.length === 0) parts.push("overview");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        fontFamily: MONO,
        fontSize: "0.36rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      <span style={{ color: "#4ade80", opacity: 0.5 }}>root</span>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <span style={{ color: "var(--muted)", opacity: 0.2 }}>/</span>
          <span
            style={{
              color: i === parts.length - 1 ? "var(--ink)" : "var(--muted)",
              fontWeight: i === parts.length - 1 ? 640 : 480,
            }}
          >
            {p}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── Command Bar ─── */
function CommandBar({
  query,
  setQuery,
  inputRef,
  brandKey,
  onClose,
}: {
  query: string;
  setQuery: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  brandKey: RootBrandKey;
  onClose: () => void;
}) {
  const modules = getRootModulesForWorkspace(brandKey);
  const q = query.toLowerCase().trim();
  const results = q
    ? modules.filter(
        (m) => m.label.includes(q) || m.description.includes(q) || m.id.includes(q)
      )
    : modules;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(3px)",
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "16%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(360px, 88vw)",
          background: "var(--bg, #0c0f0a)",
          border: `1px solid ${G}0.16)`,
          borderRadius: 8,
          boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
          zIndex: 201,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "5px 8px",
            borderBottom: `1px solid ${LINE}`,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: "0.4rem", opacity: 0.35 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) {
                window.location.href = results[0].href;
                onClose();
              }
            }}
            placeholder="Search modules, actions…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ink)",
              fontSize: "0.48rem",
              fontFamily: MONO,
              letterSpacing: "0.02em",
            }}
          />
          <kbd
            style={{
              fontSize: "0.3rem",
              fontFamily: MONO,
              color: "var(--muted)",
              opacity: 0.35,
              padding: "1px 3px",
              border: `1px solid ${LINE}`,
              borderRadius: 2,
            }}
          >
            ESC
          </kbd>
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", padding: "2px 0" }}>
          {results.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                textDecoration: "none",
                color: "var(--ink)",
                transition: "background 80ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = `${G}0.06)`)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.4rem", opacity: 0.45, width: 12, textAlign: "center" }}>
                {m.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.44rem", fontWeight: 600 }}>{m.label}</div>
                <div
                  style={{
                    fontSize: "0.34rem",
                    color: "var(--muted)",
                    opacity: 0.5,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.description}
                </div>
              </div>
              {m.shortcut && (
                <kbd
                  style={{
                    fontSize: "0.3rem",
                    fontFamily: MONO,
                    color: "var(--muted)",
                    opacity: 0.3,
                    padding: "1px 3px",
                    border: `1px solid ${LINE}`,
                    borderRadius: 2,
                  }}
                >
                  {m.shortcut}
                </kbd>
              )}
            </Link>
          ))}
          {results.length === 0 && (
            <div
              style={{
                padding: "10px 8px",
                textAlign: "center",
                fontSize: "0.4rem",
                color: "var(--muted)",
                opacity: 0.4,
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Shared styles ─── */
const sectionLabelStyle: React.CSSProperties = {
  fontSize: "0.3rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--muted)",
  opacity: 0.3,
  padding: "0 8px 2px",
  fontFamily: MONO,
};
