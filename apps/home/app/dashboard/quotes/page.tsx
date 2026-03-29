"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DT } from "@/app/root/components/dt";
import { RootTable, StatusPill, type ColumnDef, type RowAction, type BulkAction } from "@/app/root/components/root-table";
import { RootListToolbar } from "@/app/root/components/root-list-toolbar";
import { RootMetricStrip } from "@/app/root/components/root-metric-strip";

/* ─── Types ─── */
type Quote = {
  id: string;
  quote_number: string;
  business_unit: string;
  client_name: string;
  client_email: string;
  estimated_total: number;
  total: number;
  internal_status: string;
  client_status: string;
  valid_until: string | null;
  created_at: string;
  contact_id: string | null;
  issue_date: string | null;
  display_status?: string;
};

/* ─── Derive unified display status ─── */
function deriveStatus(q: Quote): string {
  const now = new Date();
  if (q.valid_until && new Date(q.valid_until) < now && q.client_status !== "accepted") return "expired";
  if (q.client_status === "accepted") return "accepted";
  if (q.client_status === "declined") return "declined";
  if (q.internal_status === "converted_to_invoice") return "converted";
  if (q.client_status === "sent" || q.internal_status === "sent") return "sent";
  return q.internal_status || "draft";
}

function fmtAmount(n: number) {
  return "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

/* ─── Status tabs ─── */
const STATUS_TABS = [
  { label: "All",       value: "all" },
  { label: "Draft",     value: "draft" },
  { label: "Sent",      value: "sent" },
  { label: "Accepted",  value: "accepted" },
  { label: "Converted", value: "converted" },
  { label: "Rejected",  value: "declined" },
  { label: "Expired",   value: "expired" },
];

/* ─── Inner component (uses useSearchParams) ─── */
function QuotesPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  /* State from URL */
  const activeTab  = params.get("status")  ?? "all";
  const buFilter   = params.get("bu")      ?? "ALL";
  const searchQ    = params.get("q")       ?? "";
  const sortKey    = params.get("sort")    ?? "created_at";
  const sortDir    = (params.get("dir")    ?? "desc") as "asc" | "desc";
  const page       = Number(params.get("page") ?? "1");
  const perPage    = Number(params.get("per") ?? "25");

  /* Data */
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdpId, setPdpId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/root/quotes?limit=200")
      .then((r) => r.json())
      .then((d) => {
        const raw: Quote[] = d.quotes ?? [];
        setAllQuotes(raw.map((q) => ({ ...q, display_status: deriveStatus(q) })));
      })
      .finally(() => setLoading(false));
  }, []);

  /* URL param updater */
  function setParam(key: string, val: string) {
    const p = new URLSearchParams(params.toString());
    p.set(key, val);
    if (key !== "page") p.set("page", "1");
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  /* Filtered + sorted data */
  const filtered = useMemo(() => {
    let q = allQuotes;
    if (buFilter !== "ALL") q = q.filter((r) => r.business_unit === buFilter);
    if (activeTab !== "all") q = q.filter((r) => r.display_status === activeTab);
    if (searchQ) {
      const lq = searchQ.toLowerCase();
      q = q.filter(
        (r) =>
          (r.client_name ?? "").toLowerCase().includes(lq) ||
          (r.quote_number ?? "").toLowerCase().includes(lq) ||
          (r.client_email ?? "").toLowerCase().includes(lq)
      );
    }
    return [...q].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allQuotes, buFilter, activeTab, searchQ, sortKey, sortDir]);

  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  /* Metrics */
  const pipeline   = allQuotes.filter((q) => !["accepted","converted","expired","declined"].includes(q.display_status ?? "")).reduce((s, q) => s + (q.estimated_total || 0), 0);
  const accepted   = allQuotes.filter((q) => q.display_status === "accepted").reduce((s, q) => s + (q.estimated_total || 0), 0);
  const sentCount  = allQuotes.filter((q) => q.display_status === "sent").length;
  const draftCount = allQuotes.filter((q) => q.display_status === "draft").length;
  const expiring   = allQuotes.filter((q) => {
    if (!q.valid_until) return false;
    const d = new Date(q.valid_until);
    const now = new Date();
    return d > now && d < new Date(now.getTime() + 7 * 86400000);
  }).length;

  /* Tab counts */
  const tabsWithCounts = STATUS_TABS.map((t) => ({
    ...t,
    count: t.value === "all"
      ? allQuotes.length
      : allQuotes.filter((q) => q.display_status === t.value).length,
  }));

  /* Columns */
  const columns: ColumnDef<Quote>[] = [
    {
      key: "quote_number",
      label: "Quote #",
      width: 120,
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.sm, color: "#4ade80", fontWeight: 600 }}>
          {r.quote_number || <span style={{ opacity: 0.3 }}>—</span>}
        </span>
      ),
    },
    {
      key: "client_name",
      label: "Client",
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontSize: DT.font.md, fontWeight: 500 }}>{r.client_name || "—"}</div>
          {r.client_email && (
            <div style={{ fontSize: DT.font.xs, color: "var(--muted)", opacity: 0.45 }}>{r.client_email}</div>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      width: 88,
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.sm }}>
          {fmtDate(r.issue_date ?? r.created_at)}
        </span>
      ),
    },
    {
      key: "valid_until",
      label: "Expires",
      width: 88,
      sortable: true,
      render: (r) => {
        const expired = r.valid_until && new Date(r.valid_until) < new Date();
        return (
          <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.sm, color: expired ? "#f87171" : "inherit" }}>
            {fmtDate(r.valid_until)}
          </span>
        );
      },
    },
    {
      key: "estimated_total",
      label: "Amount",
      width: 100,
      sortable: true,
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.md, fontWeight: 500 }}>
          {fmtAmount(r.estimated_total || r.total || 0)}
        </span>
      ),
    },
    {
      key: "business_unit",
      label: "BU",
      width: 44,
      render: (r) => (
        <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.xs, opacity: 0.4 }}>
          {r.business_unit}
        </span>
      ),
    },
    {
      key: "display_status",
      label: "Status",
      width: 110,
      sortable: true,
      render: (r) => <StatusPill status={r.display_status ?? "draft"} />,
    },
  ];

  /* Row actions */
  const rowActions = useCallback(
    (row: Quote): RowAction<Quote>[] => [
      { label: "Preview PDF",         icon: "👁", onClick: () => setPdpId(row.id) },
      { label: "Email Quote",          icon: "✉", onClick: () => router.push(`/root/quotes/${row.id}`) },
      { label: "Copy Share Link",      icon: "🔗", onClick: () => navigator.clipboard?.writeText(`${window.location.origin}/share/quote/${row.id}`) },
      { label: "Convert to Invoice",   icon: "🔄", dividerBefore: true, onClick: () => {
          fetch(`/api/quotes/${row.id}/convert`, { method: "POST" })
            .then((r) => r.json())
            .then((d) => d.invoice?.id && router.push(`/root/invoices/${d.invoice.id}`));
        }
      },
      { label: "Duplicate",            icon: "📋", onClick: () => {
          fetch(`/api/root/quotes/${row.id}/duplicate`, { method: "POST" })
            .then(() => { setLoading(true); return fetch("/api/root/quotes?limit=200"); })
            .then((r) => r.json())
            .then((d) => setAllQuotes((d.quotes ?? []).map((q: Quote) => ({ ...q, display_status: deriveStatus(q) }))));
        }
      },
      { label: "Delete",               icon: "🗑", danger: true, dividerBefore: true, onClick: () => {
          if (confirm(`Delete quote ${row.quote_number}?`))
            fetch(`/api/root/quotes/${row.id}`, { method: "DELETE" })
              .then(() => setAllQuotes((q) => q.filter((x) => x.id !== row.id)));
        }
      },
    ],
    [router]
  );

  /* Bulk actions */
  const bulkActions: BulkAction[] = [
    {
      label: "Export CSV",
      onClick: (ids) => {
        const rows = allQuotes.filter((q) => ids.includes(q.id));
        const csv = ["Quote #,Client,Date,Amount,Status", ...rows.map((r) =>
          `${r.quote_number},${r.client_name},${fmtDate(r.created_at)},${r.estimated_total},${r.display_status}`
        )].join("\n");
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "quotes.csv" });
        a.click();
      },
    },
    {
      label: "Mark as Sent",
      onClick: (ids) =>
        Promise.all(ids.map((id) =>
          fetch(`/api/root/quotes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_status: "sent" }) })
        )).then(() =>
          setAllQuotes((prev) => prev.map((q) => ids.includes(q.id) ? { ...q, client_status: "sent", display_status: "sent" } : q))
        ),
    },
  ];

  const LINE = DT.line;
  const G = DT.G;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.label, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4ade80", opacity: 0.6 }}>
            Proposal Engine
          </span>
          <span style={{ fontSize: "0.88rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", fontFamily: DT.font.body }}>
            Quotes
          </span>
        </div>
        <Link
          href="/root/quotes/new"
          style={{ padding: DT.btn.primary.pad, fontSize: DT.btn.primary.font, fontFamily: DT.font.mono, fontWeight: 700, letterSpacing: "0.06em", color: "#0d1109", background: "#4ade80", borderRadius: DT.btn.primary.radius, textDecoration: "none" }}
        >
          + New Quote
        </Link>
      </div>

      {/* Toolbar */}
      <RootListToolbar
        statusTabs={tabsWithCounts}
        activeTab={activeTab}
        onTabChange={(v) => setParam("status", v)}
        searchValue={searchQ}
        onSearchChange={(v) => setParam("q", v)}
        searchPlaceholder="Search quotes, clients…"
        buFilter buValue={buFilter} onBuChange={(v) => setParam("bu", v)}
        dateFilter onDateChange={(v) => setParam("date", v)}
      />

      {/* Metric strip */}
      <RootMetricStrip
        metrics={[
          { label: "Pipeline",      value: fmtAmount(pipeline) },
          { label: "Accepted",      value: fmtAmount(accepted), accent: accepted > 0 },
          { label: "Sent",          value: String(sentCount) },
          { label: "Drafts",        value: String(draftCount) },
          { label: "Expiring Soon", value: String(expiring), warn: expiring > 0 },
          { label: "Total",         value: String(allQuotes.length) },
        ]}
      />

      {/* Table */}
      <RootTable<Quote>
        columns={columns}
        data={pageData}
        keyField="id"
        rowActions={rowActions}
        bulkActions={bulkActions}
        sort={{ key: sortKey, dir: sortDir }}
        onSortChange={(s) => { setParam("sort", s.key); setParam("dir", s.dir); }}
        pagination={{ page, perPage, total: filtered.length, onPageChange: (p) => setParam("page", String(p)), onPerPageChange: (pp) => setParam("per", String(pp)) }}
        onRowClick={(row) => router.push(`/root/quotes/${row.id}`)}
        loading={loading}
        emptyMessage="No quotes match the current filters."
      />

      {/* PDF preview modal */}
      {pdpId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPdpId(null)}>
          <div style={{ width: "min(860px,92vw)", height: "min(680px,90vh)", background: "var(--bg)", border: `1px solid ${G}0.18)`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ fontFamily: DT.font.mono, fontSize: DT.font.sm, opacity: 0.5 }}>PDF Preview</span>
              <div style={{ display: "flex", gap: 6 }}>
                <a href={`/api/root/quotes/${pdpId}/pdf`} target="_blank" rel="noreferrer" style={{ padding: DT.btn.ghost.pad, fontSize: DT.btn.ghost.font, fontFamily: DT.font.mono, color: "#4ade80", border: `1px solid ${G}0.22)`, borderRadius: DT.btn.ghost.radius, textDecoration: "none" }}>⬇ Download</a>
                <button onClick={() => setPdpId(null)} style={{ padding: DT.btn.ghost.pad, fontSize: DT.btn.ghost.font, fontFamily: DT.font.mono, color: "var(--muted)", border: `1px solid ${LINE}`, borderRadius: DT.btn.ghost.radius, background: "transparent", cursor: "pointer" }}>✕ Close</button>
              </div>
            </div>
            <iframe src={`/api/root/quotes/${pdpId}/preview`} style={{ flex: 1, border: "none", width: "100%" }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, fontFamily: DT.font.mono, fontSize: DT.font.sm, opacity: 0.4 }}>Loading…</div>}>
      <QuotesPageInner />
    </Suspense>
  );
}
