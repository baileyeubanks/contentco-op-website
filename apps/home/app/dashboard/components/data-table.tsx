"use client";

import React, { useState, useMemo } from "react";

export interface DataColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  pageSize = 50,
  loading,
  emptyMessage = "No records found.",
  onRowClick,
  selectedKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  if (loading) {
    return (
      <div className="root-table-shell">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {columns.map((col) => (
                <th key={col.key} className="root-table-head" style={{ width: col.width }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {columns.map((col) => (
                  <td key={col.key} style={cellStyle}>
                    <div className="root-skeleton" style={{ height: 16, width: "70%", borderRadius: 4 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="root-table-shell" style={{ padding: 48, textAlign: "center", color: "var(--root-muted, var(--muted))" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="root-table-shell">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className="root-table-head"
                style={{
                  width: col.width,
                  cursor: col.sortable ? "pointer" : undefined,
                  userSelect: col.sortable ? "none" : undefined,
                  textAlign: col.align || "left",
                }}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4, fontSize: "0.56rem", opacity: 0.7 }}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row) => {
            const key = keyExtractor(row);
            const isSelected = selectedKey === key;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: onRowClick ? "pointer" : undefined,
                  background: isSelected ? "rgba(62,201,131,0.08)" : undefined,
                  transition: "background 100ms ease",
                }}
                className="root-table-row"
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ ...cellStyle, textAlign: col.align || "left" }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {(sorted.length > pageSize || totalPages > 1) && (
        <div style={paginationStyle}>
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              style={pageBtnStyle(page === 0)}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={pageBtnStyle(page >= totalPages - 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "top",
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  fontSize: "0.78rem",
  color: "var(--root-muted, var(--muted))",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const pageBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "4px 12px",
  borderRadius: 6,
  border: "1px solid var(--root-line, rgba(74,222,128,0.12))",
  background: "rgba(255,255,255,0.03)",
  color: disabled ? "var(--root-muted, var(--muted))" : "var(--ink)",
  fontSize: "0.72rem",
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.4 : 1,
});
