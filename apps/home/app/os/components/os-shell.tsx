"use client";

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { OsBrandKey } from "@/lib/os-brand";
import {
  getRootModulesForWorkspace,
  type RootModuleDef,
} from "@/lib/os-module-registry";

/* ─── Constants ─── */
const SIDEBAR_W = 118;
const SIDEBAR_COLLAPSED_W = 30;
const TOPBAR_H = 26;

/* Pages that should NOT show the shell chrome */
const BARE_PATHS = ["/os", "/os/login", "/os/system/map"];

const LS_SIDEBAR = "os-sidebar-collapsed";
const LS_BU_SCOPE = "os-bu-scope";
const LEGACY_LS_SIDEBAR = "root-sidebar-collapsed";
const LEGACY_LS_BU_SCOPE = "root-bu-scope";

/* ─── Types ─── */
type BuScope = "ALL" | "ACS" | "CC";

function readMigratedLocalStorage(newKey: string, legacyKey: string): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(newKey);
  if (current !== null) return current;
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy === null) return null;
  window.localStorage.setItem(newKey, legacy);
  window.localStorage.removeItem(legacyKey);
  return legacy;
}

function getInitialCollapsed(): boolean {
  return readMigratedLocalStorage(LS_SIDEBAR, LEGACY_LS_SIDEBAR) === "1";
}

function getInitialBuScope(): BuScope {
  const saved = readMigratedLocalStorage(LS_BU_SCOPE, LEGACY_LS_BU_SCOPE);
  return saved === "ACS" || saved === "CC" || saved === "ALL" ? saved : "ALL";
}

function shellAccent(brandKey: OsBrandKey) {
  if (brandKey === "cc") {
    return {
      solid: "#0057FF",
      soft: "rgba(0,87,255,",
      line: "rgba(0,87,255,0.12)",
    };
  }
  return {
    solid: "#4ade80",
    soft: "rgba(74,222,128,",
    line: "rgba(74,222,128,0.10)",
  };
}

/* ─── Shell ─── */
export function OsShell({
  brandKey,
  children,
}: {
  brandKey: OsBrandKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => brandKey === "cc" ? false : getInitialCollapsed());
  const [buScope, setBuScope] = useState<BuScope>(() => brandKey === "cc" ? "ALL" : getInitialBuScope());
  const [storageReady, setStorageReady] = useState(brandKey !== "cc");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const cmdRef = useRef<HTMLInputElement>(null);

  // The CCO server render and first client render must agree before preferences load.
  useEffect(() => {
    if (brandKey !== "cc") return;
    // Browser-only preferences intentionally require one post-hydration update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(getInitialCollapsed());
    setBuScope(getInitialBuScope());
    setStorageReady(true);
  }, [brandKey]);

  useEffect(() => {
    if (brandKey === "cc" && !storageReady) return;
    localStorage.setItem(LS_SIDEBAR, collapsed ? "1" : "0");
    localStorage.removeItem(LEGACY_LS_SIDEBAR);
  }, [brandKey, collapsed, storageReady]);

  useEffect(() => {
    if (brandKey === "cc" && !storageReady) return;
    localStorage.setItem(LS_BU_SCOPE, buScope);
    localStorage.removeItem(LEGACY_LS_BU_SCOPE);
  }, [brandKey, buScope, storageReady]);

  /* Mobile: keep rail collapsed so sidebar + main never exceed viewport width */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => {
      if (mq.matches) setCollapsed(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
  const accent = shellAccent(brandKey);
  const LINE = accent.line;
  const G = accent.soft;
  const MONO = 'var(--font-os, var(--font-body)), Inter, sans-serif';
  const brandLabel = brandKey === "cc" ? "CCO OS" : "OS";

  if (brandKey === "cc") {
    return (
      <CcoShell
        pathname={pathname}
        collapsed={collapsed}
        preferencesReady={storageReady}
        buScope={buScope}
        setBuScope={setBuScope}
        onToggle={() => setCollapsed((value) => !value)}
        onCollapse={() => setCollapsed(true)}
        onOpenCommand={() => { setCmdOpen(true); setCmdQuery(""); }}
        commandBar={cmdOpen && (
          <CommandBar
            query={cmdQuery}
            setQuery={setCmdQuery}
            inputRef={cmdRef}
            brandKey={brandKey}
            onClose={() => setCmdOpen(false)}
          />
        )}
      >
        {children}
      </CcoShell>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        maxWidth: "100vw",
        overflowX: "hidden",
      }}
    >
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
              background: accent.solid,
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
              {brandLabel}
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
                  color: buScope === s ? accent.solid : "var(--muted)",
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
          {!collapsed && <div style={sectionLabelStyle(MONO)}>modules</div>}
          {coreModules.map((m) => (
            <NavItem
              key={m.id}
              mod={m}
              pathname={pathname}
              collapsed={collapsed}
              brandKey={brandKey}
            />
          ))}
        </div>

        {/* Advanced modules */}
        {advancedModules.length > 0 && (
          <div style={{ padding: "2px 0 0" }}>
            {!collapsed && <div style={sectionLabelStyle(MONO)}>advanced</div>}
            {advancedModules.map((m) => (
              <NavItem
                key={m.id}
                mod={m}
                pathname={pathname}
                collapsed={collapsed}
                brandKey={brandKey}
              />
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
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "hidden",
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
          <Breadcrumb pathname={pathname} brandKey={brandKey} />
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
                color: accent.solid,
              }}
            >
              B
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>{children}</main>
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
  brandKey,
}: {
  mod: RootModuleDef;
  pathname: string;
  collapsed: boolean;
  brandKey: OsBrandKey;
}) {
  const accent = shellAccent(brandKey);
  const G = accent.soft;
  const MONO = 'var(--font-os, var(--font-body)), Inter, sans-serif';
  const active =
    mod.href === "/os/overview"
      ? pathname === "/os/overview" || pathname === "/os"
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
          ? `2px solid ${accent.solid}`
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
            background: accent.solid,
          }}
        />
      )}
    </Link>
  );
}

/* ─── Breadcrumb ─── */
function Breadcrumb({
  pathname,
  brandKey,
}: {
  pathname: string;
  brandKey: OsBrandKey;
}) {
  const accent = shellAccent(brandKey);
  const MONO = 'var(--font-os, var(--font-body)), Inter, sans-serif';
  const parts = pathname.replace("/os/", "").split("/").filter(Boolean);
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
      <span style={{ color: accent.solid, opacity: 0.7 }}>
        {brandKey === "cc" ? "CCO OS" : "OS"}
      </span>
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
  brandKey: OsBrandKey;
  onClose: () => void;
}) {
  const accent = shellAccent(brandKey);
  const G = accent.soft;
  const LINE = accent.line;
  const MONO = 'var(--font-os, var(--font-body)), Inter, sans-serif';
  const modules = getRootModulesForWorkspace(brandKey);
  const q = query.toLowerCase().trim();
  const results = q
    ? modules.filter(
        (m) => m.label.includes(q) || m.description.includes(q) || m.id.includes(q)
      )
    : modules;

  if (brandKey === "cc") {
    return (
      <CcoCommandBar
        query={query}
        setQuery={setQuery}
        inputRef={inputRef}
        results={results}
        onClose={onClose}
      />
    );
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(4, 15, 28, 0.36)",
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
          background: "var(--surface, #FFFFFF)",
          border: `1px solid ${LINE}`,
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(4, 15, 28, 0.16)",
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

/* CCO chrome is isolated so the ACS shell keeps its existing layout. */
const CCO_MOBILE_QUERY = "(max-width: 720px)";

function subscribeToCcoViewport(onChange: () => void) {
  const media = window.matchMedia(CCO_MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getCcoMobileViewport() {
  return window.matchMedia(CCO_MOBILE_QUERY).matches;
}

function getCcoServerViewport() {
  return false;
}

function CcoShell({
  pathname,
  collapsed,
  preferencesReady,
  buScope,
  setBuScope,
  onToggle,
  onCollapse,
  onOpenCommand,
  commandBar,
  children,
}: {
  pathname: string;
  collapsed: boolean;
  preferencesReady: boolean;
  buScope: BuScope;
  setBuScope: (scope: BuScope) => void;
  onToggle: () => void;
  onCollapse: () => void;
  onOpenCommand: () => void;
  commandBar: React.ReactNode;
  children: React.ReactNode;
}) {
  const parts = pathname.replace("/os/", "").split("/").filter(Boolean);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef(onCollapse);
  const previousCollapsedRef = useRef(collapsed);
  const isMobile = useSyncExternalStore(subscribeToCcoViewport, getCcoMobileViewport, getCcoServerViewport);
  const mobileOpen = isMobile && preferencesReady && !collapsed;

  useEffect(() => {
    collapseRef.current = onCollapse;
  }, [onCollapse]);

  useEffect(() => {
    const openedFromRail = previousCollapsedRef.current && !collapsed;
    previousCollapsedRef.current = collapsed;
    const narrowViewport = window.matchMedia(CCO_MOBILE_QUERY);
    // Initial preference restoration must not take focus from the page.
    if (!openedFromRail || !narrowViewport.matches) return;
    const toggleButton = toggleRef.current;
    const menuButton = menuRef.current;
    const shellElement = sidebarRef.current?.parentElement;
    if (!shellElement?.querySelector(".cco-shell-command") && !sidebarRef.current?.contains(document.activeElement)) {
      toggleButton?.focus();
    }
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !narrowViewport.matches) return;
      // Command search owns focus while it is open above the navigation drawer.
      if (sidebarRef.current?.parentElement?.querySelector(".cco-shell-command")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        collapseRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = sidebarRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!sidebarRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDrawerKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDrawerKeyDown);
      if (shellElement?.querySelector(".cco-shell-command")) return;
      const returnTarget = narrowViewport.matches ? menuButton : toggleButton;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [collapsed]);

  const navigateFromRail = () => {
    if (window.matchMedia("(max-width: 720px)").matches) onCollapse();
  };

  return (
    <div className="cco-shell" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
      <style>{CCO_SHELL_STYLES}</style>
      {!collapsed && (
        <button
          type="button"
          className="cco-shell-scrim"
          aria-label="Collapse navigation"
          onClick={onCollapse}
          tabIndex={-1}
        />
      )}
      <aside
        ref={sidebarRef}
        id="cco-shell-sidebar"
        className="cco-shell-sidebar"
        inert={isMobile && !mobileOpen}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Navigation" : undefined}
      >
        <button
          ref={toggleRef}
          type="button"
          className="cco-shell-brand cco-shell-control"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="cco-shell-navigation"
          aria-label={isMobile ? "Close navigation" : collapsed ? "Expand navigation" : "Collapse navigation"}
          title={`${collapsed ? "Expand" : "Collapse"} navigation ([)`}
        >
          <Image
            src="/brand/assets/cco/logos/optimized/spiral-hq-400.png"
            width={32}
            height={32}
            alt=""
            unoptimized
          />
          {!collapsed && <span className="cco-shell-brand-name">CCO OS</span>}
          {!collapsed && <span className="cco-shell-collapse-icon" aria-hidden="true">{isMobile ? "×" : "‹"}</span>}
        </button>
        {!collapsed && (
          <div className="cco-shell-scope" role="group" aria-label="Business unit scope">
            <span className="cco-shell-section-label">Business unit</span>
            <div className="cco-shell-scope-options">
              {(["ALL", "ACS", "CC"] as BuScope[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className="cco-shell-scope-button cco-shell-control"
                  aria-pressed={buScope === scope}
                  onClick={() => setBuScope(scope)}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
        )}
        <nav id="cco-shell-navigation" className="cco-shell-navigation" aria-label="CCO OS modules">
          {(["core", "advanced"] as const).map((tier) => {
            const modules = getRootModulesForWorkspace("cc", tier);
            if (!modules.length) return null;
            return (
              <div className="cco-shell-nav-section" key={tier}>
                {!collapsed && (
                  <div className="cco-shell-section-label">{tier === "core" ? "Modules" : "Advanced"}</div>
                )}
                {modules.map((mod) => {
                  const active = mod.href === "/os/overview"
                    ? pathname === "/os/overview" || pathname === "/os"
                    : pathname.startsWith(mod.href);
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      className="cco-shell-nav-item cco-shell-control"
                      aria-current={active ? "page" : undefined}
                      aria-label={mod.label}
                      title={collapsed ? `${mod.label}${mod.shortcut ? ` (${mod.shortcut})` : ""}` : undefined}
                      onClick={navigateFromRail}
                    >
                      <span className="cco-shell-nav-icon" aria-hidden="true">{mod.icon}</span>
                      {!collapsed && <span className="cco-shell-nav-label">{mod.label}</span>}
                      {!collapsed && mod.shortcut && <kbd className="cco-shell-shortcut">{mod.shortcut}</kbd>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <footer className="cco-shell-footer">
          {!collapsed && <span>v0.2 <span aria-hidden="true">·</span> ⌘K search <span aria-hidden="true">·</span> [ toggle</span>}
        </footer>
      </aside>
      <div className="cco-shell-body" inert={mobileOpen}>
        <header className="cco-shell-topbar">
          <button
            ref={menuRef}
            type="button"
            className="cco-shell-menu cco-shell-control"
            onClick={onToggle}
            aria-expanded={mobileOpen}
            aria-controls="cco-shell-sidebar"
            aria-label="Menu"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>Menu</span>
          </button>
          <div className="cco-shell-breadcrumb" aria-label="Current location">
            <span className="cco-shell-breadcrumb-brand">CCO OS</span>
            <span className="cco-shell-breadcrumb-divider" aria-hidden="true">/</span>
            <span className="cco-shell-breadcrumb-page" title={parts.join(" / ")}>{parts.join(" / ") || "overview"}</span>
          </div>
          <div className="cco-shell-topbar-actions">
            <button
              type="button"
              className="cco-shell-search cco-shell-control"
              onClick={onOpenCommand}
              aria-label="Search modules"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="cco-shell-search-label">Search</span>
              <kbd className="cco-shell-search-shortcut">⌘K</kbd>
            </button>
            <div className="cco-shell-avatar">B</div>
          </div>
        </header>
        <main className="cco-shell-main">{children}</main>
      </div>
      {commandBar}
    </div>
  );
}

function CcoCommandBar({
  query,
  setQuery,
  inputRef,
  results,
  onClose,
}: {
  query: string;
  setQuery: (query: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  results: RootModuleDef[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const shellElement = dialogRef.current?.closest(".cco-shell");
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>("input, button, a[href]");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      const targets = [
        previousFocus,
        shellElement?.querySelector(".cco-shell-menu"),
        shellElement?.querySelector(".cco-shell-search"),
        shellElement?.querySelector(".cco-shell-brand"),
      ];
      const returnTarget = targets.find((target) =>
        target instanceof HTMLElement && target.isConnected && !target.closest("[inert]") &&
        target.getClientRects().length > 0 && getComputedStyle(target).visibility !== "hidden"
      );
      if (returnTarget instanceof HTMLElement) returnTarget.focus();
    };
  }, []);

  return (
    <div className="cco-shell-command-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="cco-shell-command"
        role="dialog"
        aria-modal="true"
        aria-label="Search modules"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cco-shell-command-header">
          <span className="cco-shell-command-symbol" aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            className="cco-shell-command-input cco-shell-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results.length > 0) {
                window.location.href = results[0].href;
                onClose();
              }
            }}
            aria-label="Search modules"
            placeholder="Search modules…"
          />
          <button type="button" className="cco-shell-command-close cco-shell-control" onClick={onClose} aria-label="Close search">Esc</button>
        </div>
        <div className="cco-shell-command-results">
          {results.map((mod) => (
            <Link key={mod.id} href={mod.href} className="cco-shell-command-result cco-shell-control" onClick={onClose}>
              <span className="cco-shell-nav-icon" aria-hidden="true">{mod.icon}</span>
              <div className="cco-shell-command-result-copy">
                <div className="cco-shell-command-result-label">{mod.label}</div>
                <div className="cco-shell-command-description">{mod.description}</div>
              </div>
              {mod.shortcut && <kbd className="cco-shell-shortcut">{mod.shortcut}</kbd>}
            </Link>
          ))}
          {results.length === 0 && <div className="cco-shell-command-empty" role="status">No results for &ldquo;{query}&rdquo;</div>}
        </div>
      </div>
    </div>
  );
}

const CCO_SHELL_STYLES = `
  .cco-shell { --cco-shell-width: 208px; display: flex; min-height: 100vh; min-height: 100dvh; width: 100%; max-width: 100vw; color: #172b4d; font-family: var(--font-os, var(--font-body)), Inter, sans-serif; }
  .cco-shell[data-collapsed="true"] { --cco-shell-width: 60px; }
  .cco-shell .cco-shell-control { -webkit-tap-highlight-color: transparent; }
  .cco-shell .cco-shell-control:focus-visible { outline: 2px solid #0057ff; outline-offset: -3px; }
  .cco-shell-sidebar { width: var(--cco-shell-width); position: fixed; inset: 0 auto 0 0; z-index: 100; display: flex; flex-direction: column; background: #fbfcff; border-right: 1px solid #e0e7f0; transition: width 160ms ease; }
  .cco-shell-brand { display: flex; align-items: center; gap: 10px; width: 100%; height: 60px; min-height: 60px; padding: 8px 16px; border: 0; border-bottom: 1px solid #e0e7f0; background: transparent; color: #172b4d; cursor: pointer; text-align: left; }
  .cco-shell-brand img { flex-shrink: 0; object-fit: contain; }
  .cco-shell-brand-name { font-size: 14px; font-weight: 700; letter-spacing: -0.025em; white-space: nowrap; }
  .cco-shell-collapse-icon { margin-left: auto; font-size: 24px; font-weight: 400; color: #63748b; }
  .cco-shell-scope { padding: 16px 12px 12px; border-bottom: 1px solid #e0e7f0; }
  .cco-shell-section-label { display: block; padding: 0 10px 8px; color: #63748b; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; line-height: 16px; text-transform: uppercase; }
  .cco-shell-scope-options { display: flex; gap: 4px; }
  .cco-shell-scope-button { flex: 1; min-width: 44px; min-height: 44px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: #53657e; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  .cco-shell-scope-button[aria-pressed="true"] { border-color: #d4e2ff; background: #eaf1ff; color: #004bdc; }
  .cco-shell-navigation { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; padding: 16px 8px; }
  .cco-shell-nav-section + .cco-shell-nav-section { margin-top: 24px; }
  .cco-shell-nav-item { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 10px; border-radius: 7px; color: #53657e; text-decoration: none; font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; }
  .cco-shell-nav-item:hover, .cco-shell-scope-button:hover, .cco-shell-brand:hover { background: #f0f4fa; }
  .cco-shell-nav-item[aria-current="page"] { background: #e9f0ff; color: #004bdc; font-weight: 650; box-shadow: inset 3px 0 #0057ff; }
  .cco-shell-nav-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 20px; font-size: 17px; line-height: 20px; color: currentColor; }
  .cco-shell-nav-label { text-transform: capitalize; }
  .cco-shell-shortcut { margin-left: auto; color: #63748b; font-family: inherit; font-size: 11px; font-weight: 500; }
  .cco-shell-footer { flex-shrink: 0; min-height: 48px; display: flex; align-items: center; padding: 12px 16px; border-top: 1px solid #e0e7f0; font-size: 11px; line-height: 18px; white-space: nowrap; color: #63748b; }
  .cco-shell[data-collapsed="true"] .cco-shell-brand { justify-content: center; padding: 8px; }
  .cco-shell[data-collapsed="true"] .cco-shell-navigation { padding: 12px 8px; }
  .cco-shell[data-collapsed="true"] .cco-shell-nav-item { justify-content: center; padding: 8px; }
  .cco-shell[data-collapsed="true"] .cco-shell-nav-section + .cco-shell-nav-section { padding-top: 12px; margin-top: 12px; border-top: 1px solid #e0e7f0; }
  .cco-shell-body { display: flex; flex: 1; flex-direction: column; min-width: 0; margin-left: var(--cco-shell-width); transition: margin-left 160ms ease; }
  .cco-shell-topbar { position: sticky; top: 0; z-index: 90; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 16px; height: 60px; padding: 0 24px; border-bottom: 1px solid #e0e7f0; background: rgba(255,255,255,0.96); backdrop-filter: blur(12px); }
  .cco-shell-menu { display: none; }
  .cco-shell-breadcrumb { display: flex; align-items: center; gap: 12px; min-width: 0; font-size: 13px; line-height: 20px; }
  .cco-shell-breadcrumb-brand { flex-shrink: 0; color: #63748b; }
  .cco-shell-breadcrumb-divider { color: #96a4b7; }
  .cco-shell-breadcrumb-page { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; text-transform: capitalize; }
  .cco-shell-topbar-actions { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
  .cco-shell-search { display: flex; align-items: center; justify-content: center; gap: 10px; min-width: 44px; min-height: 44px; padding: 0 12px; border: 1px solid #e0e7f0; border-radius: 8px; background: #fff; color: #53657e; font: inherit; font-size: 14px; cursor: pointer; }
  .cco-shell-search:hover, .cco-shell-command-close:hover { background: #f3f6fb; }
  .cco-shell-search-shortcut { margin-left: 12px; font: inherit; font-size: 11px; color: #63748b; }
  .cco-shell-avatar { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid #d4e2ff; border-radius: 50%; background: #eaf1ff; color: #004bdc; font-size: 12px; font-weight: 650; }
  .cco-shell-main { flex: 1; min-width: 0; }
  .cco-shell-scrim { display: none; }
  .cco-shell-command-overlay { position: fixed; inset: 0; z-index: 200; display: flex; justify-content: center; align-items: flex-start; padding: min(16vh, 120px) 16px 24px; background: rgba(15, 31, 54, 0.32); backdrop-filter: blur(3px); }
  .cco-shell-command { display: flex; flex-direction: column; width: min(540px, 100%); max-height: 100%; overflow: hidden; border: 1px solid #e0e7f0; border-radius: 14px; background: #fff; box-shadow: 0 24px 64px rgba(15,31,54,0.2); }
  .cco-shell-command-header { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid #e0e7f0; }
  .cco-shell-command-symbol { font-size: 18px; color: #63748b; }
  .cco-shell-command-input { flex: 1; min-width: 0; min-height: 44px; padding: 0 4px; border: 0; border-radius: 4px; background: transparent; color: #172b4d; font: inherit; font-size: 14px; }
  .cco-shell-command-input::placeholder { color: #63748b; }
  .cco-shell-command-close { min-width: 44px; min-height: 44px; padding: 0 8px; border: 1px solid #e0e7f0; border-radius: 6px; background: #fff; color: #53657e; font: inherit; font-size: 12px; cursor: pointer; }
  .cco-shell-command-results { min-height: 0; max-height: 440px; overflow-y: auto; overscroll-behavior: contain; padding: 8px; }
  .cco-shell-command-result { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 12px; border-radius: 8px; color: #172b4d; text-decoration: none; }
  .cco-shell-command-result:hover { background: #edf3ff; }
  .cco-shell-command-result-copy { flex: 1; min-width: 0; }
  .cco-shell-command-result-label { font-size: 14px; font-weight: 600; line-height: 20px; text-transform: capitalize; }
  .cco-shell-command-description { margin-top: 2px; color: #63748b; font-size: 12px; line-height: 18px; }
  .cco-shell-command-empty { padding: 28px 16px; font-size: 14px; color: #53657e; text-align: center; overflow-wrap: anywhere; }
  @media (max-width: 720px) {
    .cco-shell-body { margin-left: 0; }
    .cco-shell-sidebar { width: min(288px, calc(100vw - 48px)); visibility: hidden; transform: translateX(-100%); pointer-events: none; transition: transform 160ms ease; }
    .cco-shell[data-mobile-open="true"] .cco-shell-sidebar { visibility: visible; transform: translateX(0); pointer-events: auto; box-shadow: 12px 0 40px rgba(15,31,54,0.14); }
    .cco-shell[data-mobile-open="true"] .cco-shell-scrim { display: block; position: fixed; inset: 0; z-index: 99; border: 0; background: rgba(15,31,54,0.24); }
    .cco-shell-topbar { gap: 8px; padding: 0 12px; }
    .cco-shell-menu { display: flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 8px; min-height: 44px; padding: 0 10px; border: 1px solid #e0e7f0; border-radius: 8px; background: #fff; color: #53657e; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
    .cco-shell-menu:hover { background: #f3f6fb; }
    .cco-shell-breadcrumb { flex: 1; }
    .cco-shell-topbar-actions { gap: 8px; }
    .cco-shell-breadcrumb-brand, .cco-shell-breadcrumb-divider, .cco-shell-search-shortcut { display: none; }
    .cco-shell-search { padding: 0 12px; }
    .cco-shell-command-header { gap: 8px; padding: 10px; }
    .cco-shell-command-symbol { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cco-shell-sidebar, .cco-shell-body { transition: none; }
  }
`;

/* ─── Shared styles ─── */
function sectionLabelStyle(fontFamily: string): React.CSSProperties {
  return {
    fontSize: "0.3rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--muted)",
    opacity: 0.3,
    padding: "0 8px 2px",
    fontFamily,
  };
}
