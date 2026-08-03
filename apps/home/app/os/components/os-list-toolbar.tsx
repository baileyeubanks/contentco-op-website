"use client";

import React, { useRef, useState } from "react";
import { DT } from "./dt";

const G    = DT.G;
const LINE = DT.line;
const HOVER = DT.hover;
const MONO = DT.font.mono;

export type StatusTab = {
  label: string;
  value: string;
  count?: number;
};

type Props = {
  statusTabs: StatusTab[];
  activeTab: string;
  onTabChange: (value: string) => void;

  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  buFilter?: boolean;
  buValue?: string;
  onBuChange?: (v: string) => void;

  dateFilter?: boolean;
  dateValue?: string;
  onDateChange?: (v: string) => void;

  rightSlot?: React.ReactNode;
};

const DATE_OPTIONS = [
  { label: "All time",      value: "all" },
  { label: "This month",    value: "this_month" },
  { label: "Last 30 days",  value: "30d" },
  { label: "Last 90 days",  value: "90d" },
  { label: "This year",     value: "this_year" },
];

export function RootListToolbar({
  statusTabs,
  activeTab,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  buFilter = true,
  buValue = "ALL",
  onBuChange,
  dateFilter = false,
  dateValue = "all",
  onDateChange,
  rightSlot,
}: Props) {
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const dateLabel = DATE_OPTIONS.find((o) => o.value === dateValue)?.label ?? "All time";

  return (
    <div style={{ borderBottom: `1px solid ${LINE}` }}>

      {/* ── Row 1: Status tabs ── */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        borderBottom: `1px solid rgba(255,255,255,0.04)`,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        {statusTabs.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 12px 6px",
                fontSize: "0.52rem",
                fontFamily: MONO,
                fontWeight: active ? 700 : 500,
                color: active ? "#4ade80" : "var(--muted)",
                background: active ? `${G}0.04)` : "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "#4ade80" : "transparent"}`,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "0.05em",
                transition: "color 80ms, border-color 80ms, background 80ms",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget.style.color = "var(--ink)"); }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget.style.color = "var(--muted)"); }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: "0.40rem",
                  fontFamily: MONO,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  color: active ? "#4ade80" : "var(--muted)",
                  opacity: active ? 0.9 : 0.45,
                  background: active ? `${G}0.12)` : "rgba(255,255,255,0.07)",
                  padding: "1px 5px",
                  borderRadius: 10,
                  minWidth: 14,
                  textAlign: "center",
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
        {/* right slot in tab row (e.g. aging toggle) */}
        {rightSlot && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8 }}>
            {rightSlot}
          </div>
        )}
      </div>

      {/* ── Row 2: Search + Filters ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        background: "rgba(0,0,0,0.10)",
      }}>
        {/* Search */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid rgba(255,255,255,0.07)`,
          borderRadius: 4,
          padding: "3px 8px",
          transition: "border-color 100ms",
        }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${G}0.25)`; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
        >
          <span style={{ fontSize: "0.55rem", opacity: 0.28, color: "var(--muted)", flexShrink: 0 }}>⌕</span>
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "0.58rem",
              color: "var(--ink)",
              fontFamily: MONO,
              letterSpacing: "0.01em",
              minWidth: 0,
            }}
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange("")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.42rem", color: "var(--muted)", opacity: 0.4, padding: 0, flexShrink: 0 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Date filter */}
        {dateFilter && (
          <div ref={dateRef} style={{ position: "relative" }}>
            <FilterPill onClick={() => setDateOpen((o) => !o)} active={dateValue !== "all"}>
              {dateLabel} ▾
            </FilterPill>
            {dateOpen && (
              <DropdownMenu onClose={() => setDateOpen(false)}>
                {DATE_OPTIONS.map((o) => (
                  <DropdownItem key={o.value} active={o.value === dateValue} onClick={() => { onDateChange?.(o.value); setDateOpen(false); }}>
                    {o.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            )}
          </div>
        )}

        {/* BU filter */}
        {buFilter && onBuChange && (
          <div style={{ display: "flex", gap: 1, background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "1px", border: `1px solid ${LINE}` }}>
            {(["ALL", "ACS", "CC"] as const).map((bu) => (
              <button
                key={bu}
                onClick={() => onBuChange(bu)}
                style={{
                  padding: "2px 7px",
                  fontSize: "0.46rem",
                  fontFamily: MONO,
                  fontWeight: buValue === bu ? 700 : 500,
                  letterSpacing: "0.08em",
                  color: buValue === bu ? "#4ade80" : "var(--muted)",
                  background: buValue === bu ? `${G}0.14)` : "transparent",
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "all 70ms ease",
                }}
              >
                {bu}
              </button>
            ))}
          </div>
        )}

        {/* Right slot (if separate from tab row) */}
        {!rightSlot && null}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function FilterPill({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 9px",
        fontSize: "0.46rem",
        fontFamily: MONO,
        color: active ? "#4ade80" : "var(--muted)",
        background: active ? `${G}0.08)` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? `${G}0.18)` : "rgba(255,255,255,0.08)"}`,
        borderRadius: 4,
        cursor: "pointer",
        whiteSpace: "nowrap",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </button>
  );
}

function DropdownMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 3px)",
        right: 0,
        zIndex: 60,
        background: "var(--surface)",
        border: `1px solid ${G}0.16)`,
        borderRadius: 6,
        boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
        minWidth: 148,
        padding: "3px 0",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function DropdownItem({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "5px 11px",
        fontSize: "0.52rem",
        fontFamily: MONO,
        textAlign: "left",
        color: active ? "#4ade80" : "var(--ink)",
        background: active ? `${G}0.08)` : "transparent",
        border: "none",
        cursor: "pointer",
        letterSpacing: "0.02em",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget.style.background = HOVER); }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget.style.background = "transparent"); }}
    >
      {active && <span style={{ marginRight: 5, fontSize: "0.42rem" }}>✓</span>}
      {children}
    </button>
  );
}
