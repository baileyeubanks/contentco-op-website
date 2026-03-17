"use client";

import React, { useState, useRef, useEffect } from "react";
import { DT } from "./dt";

/* ─── Types ─── */
export type ColumnDef<T> = {
  key: string;
  label: string;
  width?: number | string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  type?: "status" | "amount" | "date" | "text";
  render?: (row: T, index: number) => React.ReactNode;
};

export type RowAction<T> = {
  label: string;
  icon?: string;
  onClick: (row: T) => void;
  danger?: boolean;
  dividerBefore?: boolean;
};

export type BulkAction = {
  label: string;
  onClick: (selectedKeys: string[]) => void;
  danger?: boolean;
};

export type SortState = { key: string; dir: "asc" | "desc" };

export type PaginationState = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (pp: number) => void;
};

export type RootTableProps<T extends Record<string, unknown>> = {
  columns: ColumnDef<T>[];
  data: T[];
  keyField: keyof T;
  rowActions?: (row: T) => RowAction<T>[];
  bulkActions?: BulkAction[];
  sort: SortState;
  onSortChange: (s: SortState) => void;
  pagination: PaginationState;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
};

const G    = DT.G;
const LINE = DT.line;
const HOVER= DT.hover;
const MONO = DT.font.mono;

/* ─── Status Pill ─── */
export function StatusPill({ status }: { status: string }) {
  const key = (status || "").toLowerCase().replace(/[\s-]/g, "_");
  const s = DT.status[key] ?? DT.status.draft;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        fontSize: "0.44rem",
        fontFamily: MONO,
        fontWeight: 700,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ─── Root Table ─── */
export function RootTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  rowActions,
  bulkActions,
  sort,
  onSortChange,
  pagination,
  onRowClick,
  loading = false,
  emptyMessage = "No records found.",
}: RootTableProps<T>) {
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey]  = useState<string | null>(null);

  /* Close menu on outside click */
  useEffect(() => {
    if (!openMenuKey) return;
    const handler = () => setOpenMenuKey(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenuKey]);

  const pageData  = data;
  const allKeys   = pageData.map((r) => String(r[keyField]));
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = allKeys.some((k) => selected.has(k));

  function toggleAll() {
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); allKeys.forEach((k) => n.delete(k)); return n; });
    } else {
      setSelected((s) => new Set([...s, ...allKeys]));
    }
  }

  function toggleRow(key: string) {
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function handleSort(key: string) {
    if (sort.key === key) {
      onSortChange({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ key, dir: "asc" });
    }
  }

  const selectedArr = Array.from(selected);

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>

      {/* ── Bulk action bar ── */}
      {someSelected && bulkActions && bulkActions.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            background: `${G}0.07)`,
            borderBottom: `1px solid ${G}0.15)`,
            fontSize: DT.font.sm,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: DT.font.xs, color: "#4ade80", opacity: 0.7 }}>
            {selectedArr.length} selected
          </span>
          <div style={{ width: 1, height: 10, background: LINE, margin: "0 2px" }} />
          {bulkActions.map((a) => (
            <button
              key={a.label}
              onClick={() => { a.onClick(selectedArr); setSelected(new Set()); }}
              style={{
                padding: DT.btn.ghost.pad,
                fontSize: DT.btn.ghost.font,
                fontFamily: MONO,
                letterSpacing: "0.04em",
                color: a.danger ? "#f87171" : "#4ade80",
                background: "transparent",
                border: `1px solid ${a.danger ? "rgba(239,68,68,0.22)" : `${G}0.18)`}`,
                borderRadius: DT.btn.ghost.radius,
                cursor: "pointer",
                transition: "all 80ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = a.danger
                  ? "rgba(239,68,68,0.06)"
                  : HOVER;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            style={{
              marginLeft: "auto",
              padding: "2px 5px",
              fontSize: DT.font.xs,
              fontFamily: MONO,
              color: "var(--muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              opacity: 0.4,
              letterSpacing: "0.02em",
            }}
          >
            ✕ clear
          </button>
        </div>
      )}

      {/* ── Table scroll wrapper ── */}
      <div style={{ overflowX: "auto", flex: 1 }}>
        <table
          style={{
            width: "100%",
            minWidth: 820,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          {/* ── Header ── */}
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.22)" }}>
              {/* Checkbox col */}
              <th
                style={{
                  width: 32,
                  padding: DT.thPad,
                  textAlign: "center",
                  borderBottom: `1px solid ${LINE}`,
                  borderTop: `1px solid rgba(255,255,255,0.03)`,
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  style={{ width: 11, height: 11, accentColor: "#4ade80", cursor: "pointer" }}
                />
              </th>
              {columns.map((col) => {
                const isActive = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      padding: DT.thPad,
                      textAlign: (col.align ?? "left") as React.CSSProperties["textAlign"],
                      fontFamily: MONO,
                      fontSize: DT.font.label,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: isActive ? "#4ade80" : "var(--muted)",
                      opacity: isActive ? 0.85 : 0.48,
                      borderBottom: `1px solid ${isActive ? `${G}0.20)` : LINE}`,
                      borderTop: `1px solid rgba(255,255,255,0.03)`,
                      whiteSpace: "nowrap",
                      userSelect: "none",
                      cursor: col.sortable ? "pointer" : "default",
                      transition: "color 100ms, opacity 100ms",
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                    onMouseEnter={(e) => {
                      if (col.sortable && !isActive) {
                        (e.currentTarget as HTMLElement).style.opacity = "0.7";
                        (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.opacity = "0.48";
                        (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                      }
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {col.label}
                      {col.sortable && (
                        <span
                          style={{
                            fontSize: "0.40rem",
                            opacity: isActive ? 1 : 0.3,
                            color: isActive ? "#4ade80" : "inherit",
                            fontWeight: 700,
                          }}
                        >
                          {isActive ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
              {/* Actions col */}
              {rowActions && (
                <th
                  style={{
                    width: 36,
                    padding: DT.thPad,
                    borderBottom: `1px solid ${LINE}`,
                    borderTop: `1px solid rgba(255,255,255,0.03)`,
                  }}
                />
              )}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                    <td style={{ padding: DT.cellPad, width: 32 }} />
                    {columns.map((col, ci) => (
                      <td key={col.key} style={{ padding: "6px 10px" }}>
                        <div
                          style={{
                            height: 8,
                            width: `${[70, 55, 45, 80, 60, 35, 50][( ci + i) % 7]}%`,
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 3,
                            animation: "root-shimmer 1.6s ease-in-out infinite",
                            animationDelay: `${i * 60}ms`,
                          }}
                        />
                      </td>
                    ))}
                    {rowActions && <td style={{ padding: DT.cellPad, width: 36 }} />}
                  </tr>
                ))
              : pageData.length === 0
              ? (
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      style={{
                        padding: "40px 10px",
                        textAlign: "center",
                        fontSize: DT.font.sm,
                        color: "var(--muted)",
                        opacity: 0.35,
                        fontFamily: MONO,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )
              : pageData.map((row, idx) => {
                  const key        = String(row[keyField]);
                  const isSelected = selected.has(key);
                  const isHovered  = hoveredKey === key;
                  const actions    = rowActions?.(row) ?? [];

                  return (
                    <tr
                      key={key}
                      onClick={() => onRowClick?.(row)}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={{
                        height: DT.rowH,
                        background: isSelected
                          ? `${G}0.07)`
                          : isHovered
                          ? HOVER
                          : idx % 2 === 1
                          ? "rgba(255,255,255,0.012)"
                          : "transparent",
                        cursor: onRowClick ? "pointer" : "default",
                        borderBottom: `1px solid rgba(255,255,255,0.035)`,
                        transition: "background 60ms ease",
                        boxShadow: isHovered || isSelected
                          ? `inset 2px 0 0 ${isSelected ? "#4ade80" : `${G}0.5)`}`
                          : "none",
                      }}
                    >
                      {/* Checkbox */}
                      <td
                        style={{ width: 32, padding: DT.cellPad, textAlign: "center" }}
                        onClick={(e) => { e.stopPropagation(); toggleRow(key); }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          style={{ width: 11, height: 11, accentColor: "#4ade80", cursor: "pointer" }}
                        />
                      </td>

                      {/* Data cells */}
                      {columns.map((col) => {
                        const val = row[col.key];
                        return (
                          <td
                            key={col.key}
                            style={{
                              padding: DT.cellPad,
                              fontSize: DT.font.md,
                              fontFamily: col.type === "amount" || col.type === "date" ? MONO : "inherit",
                              textAlign: (col.align ?? "left") as React.CSSProperties["textAlign"],
                              color: "var(--ink)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 0,
                            }}
                          >
                            {col.render
                              ? col.render(row, idx)
                              : col.type === "status"
                              ? <StatusPill status={String(val ?? "")} />
                              : String(val ?? "—")}
                          </td>
                        );
                      })}

                      {/* Kebab */}
                      {rowActions && (
                        <td
                          style={{ width: 36, padding: "0 4px", textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ position: "relative" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuKey(openMenuKey === key ? null : key);
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                display: "grid",
                                placeItems: "center",
                                background: openMenuKey === key ? `${G}0.10)` : "transparent",
                                border: `1px solid ${openMenuKey === key ? `${G}0.22)` : "transparent"}`,
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: "0.65rem",
                                color: openMenuKey === key ? "#4ade80" : "var(--muted)",
                                opacity: isHovered || openMenuKey === key ? 1 : 0,
                                transition: "all 80ms ease",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.opacity = "1";
                                if (openMenuKey !== key) {
                                  (e.currentTarget as HTMLElement).style.borderColor = LINE;
                                  (e.currentTarget as HTMLElement).style.background = HOVER;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (openMenuKey !== key) {
                                  (e.currentTarget as HTMLElement).style.opacity = isHovered ? "1" : "0";
                                  (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                                  (e.currentTarget as HTMLElement).style.background = "transparent";
                                }
                              }}
                            >
                              ···
                            </button>

                            {/* Dropdown */}
                            {openMenuKey === key && actions.length > 0 && (
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "calc(100% + 2px)",
                                  zIndex: 50,
                                  background: "color-mix(in srgb, var(--bg, #0d1109) 96%, transparent)",
                                  backdropFilter: "blur(8px)",
                                  border: `1px solid ${G}0.18)`,
                                  borderRadius: 7,
                                  boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(74,222,128,0.05)",
                                  minWidth: 168,
                                  padding: "4px 0",
                                  overflow: "hidden",
                                }}
                              >
                                {actions.map((action, ai) => (
                                  <React.Fragment key={ai}>
                                    {action.dividerBefore && (
                                      <div style={{ height: 1, background: `${G}0.08)`, margin: "3px 0" }} />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuKey(null);
                                        action.onClick(row);
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 7,
                                        width: "100%",
                                        padding: "5px 12px",
                                        fontSize: DT.font.sm,
                                        fontFamily: MONO,
                                        color: action.danger ? "#f87171" : "var(--ink)",
                                        background: "transparent",
                                        border: "none",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                        letterSpacing: "0.01em",
                                        transition: "background 60ms",
                                      }}
                                      onMouseEnter={(e) =>
                                        ((e.currentTarget as HTMLElement).style.background = action.danger
                                          ? "rgba(239,68,68,0.09)"
                                          : HOVER)
                                      }
                                      onMouseLeave={(e) =>
                                        ((e.currentTarget as HTMLElement).style.background = "transparent")
                                      }
                                    >
                                      {action.icon && (
                                        <span style={{ fontSize: DT.font.xs, opacity: 0.55, width: 14, textAlign: "center" }}>
                                          {action.icon}
                                        </span>
                                      )}
                                      {action.label}
                                    </button>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <PaginationBar pagination={pagination} total={data.length} loading={loading} />

      {/* ── Shimmer keyframe ── */}
      <style>{`
        @keyframes root-shimmer {
          0%   { opacity: 0.5; }
          50%  { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/* ─── Pagination Bar ─── */
function PaginationBar({
  pagination,
  total,
  loading,
}: {
  pagination: PaginationState;
  total: number;
  loading: boolean;
}) {
  const { page, perPage, total: totalRecords, onPageChange, onPerPageChange } = pagination;
  const totalPages = Math.ceil(totalRecords / perPage);
  const start      = (page - 1) * perPage + 1;
  const end        = Math.min(page * perPage, totalRecords);

  function pageNumbers() {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 10px",
        borderTop: `1px solid ${LINE}`,
        background: "rgba(0,0,0,0.12)",
        fontSize: DT.font.xs,
        fontFamily: DT.font.mono,
        color: "var(--muted)",
        flexShrink: 0,
      }}
    >
      {/* Count */}
      <span style={{ opacity: loading ? 0.3 : 0.5, letterSpacing: "0.03em" }}>
        {totalRecords > 0 ? `${start}–${end} of ${totalRecords}` : "0 records"}
      </span>

      {/* Page buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <PageBtn disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</PageBtn>
        {pageNumbers().map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} style={{ padding: "0 3px", opacity: 0.25, fontSize: "0.44rem" }}>…</span>
          ) : (
            <PageBtn key={p} active={p === page} onClick={() => onPageChange(p as number)}>
              {p}
            </PageBtn>
          )
        )}
        <PageBtn disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</PageBtn>
      </div>

      {/* Per page */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: 0.45 }}>
        <span style={{ letterSpacing: "0.04em" }}>per page</span>
        <select
          value={perPage}
          onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1); }}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${LINE}`,
            color: "var(--muted)",
            fontSize: DT.font.xs,
            fontFamily: DT.font.mono,
            padding: "1px 4px",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        minWidth: 22,
        height: 22,
        padding: "0 5px",
        fontSize: DT.font.xs,
        fontFamily: DT.font.mono,
        color: active ? "#4ade80" : "var(--muted)",
        background: active ? `${DT.G}0.14)` : "transparent",
        border: `1px solid ${active ? `${DT.G}0.28)` : "transparent"}`,
        borderRadius: 4,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.25 : 1,
        transition: "all 80ms ease",
        fontWeight: active ? 700 : 500,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active)
          (e.currentTarget as HTMLElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
