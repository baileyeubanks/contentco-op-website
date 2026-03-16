"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Page } from "@contentco-op/ui/src/atlantis/Page";
import { DataTable } from "@contentco-op/ui/src/atlantis/DataTable";
import { StatusLabel } from "@contentco-op/ui/src/atlantis/StatusLabel";
import { Button } from "@contentco-op/ui/src/atlantis/Button";
import { Card } from "@contentco-op/ui/src/atlantis/Card";
import { Modal } from "@contentco-op/ui/src/atlantis/Modal";

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
  [key: string]: unknown;
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
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

/* ─── Status mapping to Atlantis StatusLabel ─── */
const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "critical",
  expired: "warning",
  converted: "success",
};

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

/* ─── 3-dot action menu ─── */
function ActionMenu({ row, onAction }: { row: Quote; onAction: (action: string, row: Quote) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const actions = [
    { key: "view", label: "View Details" },
    { key: "email", label: "Email Quote" },
    { key: "copy_link", label: "Copy Share Link" },
    { key: "duplicate", label: "Duplicate" },
    { key: "convert", label: "Convert to Invoice", divider: true },
    { key: "delete", label: "Delete", danger: true, divider: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-8 h-8 flex items-center justify-center rounded-[var(--at-radius-sm)] text-[var(--at-grey-500)] hover:text-[var(--at-grey-900)] hover:bg-[var(--at-grey-100)] transition-colors"
        aria-label="Actions"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[var(--at-border)] rounded-[var(--at-radius)] shadow-lg min-w-[180px] py-1 font-[var(--at-font)]">
          {actions.map((a) => (
            <React.Fragment key={a.key}>
              {a.divider && <div className="h-px bg-[var(--at-grey-200)] my-1" />}
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); onAction(a.key, row); }}
                className={[
                  "w-full text-left px-3 py-1.5 text-sm transition-colors",
                  a.danger
                    ? "text-[var(--at-red)] hover:bg-[var(--at-red-light)]"
                    : "text-[var(--at-text)] hover:bg-[var(--at-grey-100)]",
                ].join(" ")}
              >
                {a.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

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
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allQuotes, buFilter, activeTab, searchQ, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
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

  /* Row action handler */
  const handleRowAction = useCallback((action: string, row: Quote) => {
    switch (action) {
      case "view":
        router.push(`/root/quotes/${row.id}`);
        break;
      case "email":
        router.push(`/root/quotes/${row.id}`);
        break;
      case "copy_link":
        navigator.clipboard?.writeText(`${window.location.origin}/share/quote/${row.id}`);
        break;
      case "convert":
        fetch(`/api/quotes/${row.id}/convert`, { method: "POST" })
          .then((r) => r.json())
          .then((d) => d.invoice?.id && router.push(`/root/invoices/${d.invoice.id}`));
        break;
      case "duplicate":
        fetch(`/api/root/quotes/${row.id}/duplicate`, { method: "POST" })
          .then(() => { setLoading(true); return fetch("/api/root/quotes?limit=200"); })
          .then((r) => r.json())
          .then((d) => setAllQuotes((d.quotes ?? []).map((q: Quote) => ({ ...q, display_status: deriveStatus(q) }))));
        break;
      case "delete":
        if (confirm(`Delete quote ${row.quote_number}?`))
          fetch(`/api/root/quotes/${row.id}`, { method: "DELETE" })
            .then(() => setAllQuotes((q) => q.filter((x) => x.id !== row.id)));
        break;
    }
  }, [router]);

  /* DataTable columns */
  const columns = [
    {
      header: "Quote #",
      accessorKey: "quote_number" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="font-semibold text-[var(--at-green)]">
          {row.quote_number || <span className="opacity-30">{"\u2014"}</span>}
        </span>
      ),
    },
    {
      header: "Client",
      accessorKey: "client_name" as const,
      cell: (_: unknown, row: Quote) => (
        <div>
          <div className="font-medium text-[var(--at-text)]">{row.client_name || "\u2014"}</div>
          {row.client_email && (
            <div className="text-xs text-[var(--at-text-secondary)]">{row.client_email}</div>
          )}
        </div>
      ),
    },
    {
      header: "Date",
      accessorKey: "created_at" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="text-sm text-[var(--at-text-secondary)]">
          {fmtDate(row.issue_date ?? row.created_at)}
        </span>
      ),
    },
    {
      header: "Expires",
      accessorKey: "valid_until" as const,
      cell: (_: unknown, row: Quote) => {
        const expired = row.valid_until && new Date(row.valid_until) < new Date();
        return (
          <span className={`text-sm ${expired ? "text-[var(--at-red)]" : "text-[var(--at-text-secondary)]"}`}>
            {fmtDate(row.valid_until)}
          </span>
        );
      },
    },
    {
      header: "Amount",
      accessorKey: "estimated_total" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="font-medium text-[var(--at-text)]">
          {fmtAmount(row.estimated_total || row.total || 0)}
        </span>
      ),
    },
    {
      header: "BU",
      accessorKey: "business_unit" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="text-xs text-[var(--at-grey-400)] uppercase tracking-wide">
          {row.business_unit}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "display_status" as const,
      cell: (_: unknown, row: Quote) => {
        const status = row.display_status ?? "draft";
        return (
          <StatusLabel status={STATUS_VARIANT[status] ?? "neutral"}>
            {status.replace(/_/g, " ")}
          </StatusLabel>
        );
      },
    },
    {
      header: "",
      accessorKey: "id" as const,
      cell: (_: unknown, row: Quote) => (
        <ActionMenu row={row} onAction={handleRowAction} />
      ),
    },
  ];

  /* Metric cards data */
  const metrics = [
    { label: "Pipeline", value: fmtAmount(pipeline), color: "" },
    { label: "Accepted", value: fmtAmount(accepted), color: "var(--at-green)" },
    { label: "Sent", value: String(sentCount), color: "var(--at-blue)" },
    { label: "Drafts", value: String(draftCount), color: "" },
    { label: "Expiring Soon", value: String(expiring), color: expiring > 0 ? "var(--at-yellow)" : "" },
  ];

  return (
    <Page
      title="Quotes"
      subtitle={`${allQuotes.length} total quotes across all business units`}
      actions={
        <Link href="/root/quotes/new">
          <Button variant="primary">+ New Quote</Button>
        </Link>
      }
    >
      {/* Metric cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {metrics.map((m) => (
          <Card key={m.label}>
            <Card.Body>
              <div className="text-xs text-[var(--at-text-secondary)] uppercase tracking-wide font-medium mb-1">
                {m.label}
              </div>
              <div
                className="text-xl font-bold font-[var(--at-font-display)]"
                style={m.color ? { color: m.color } : undefined}
              >
                {m.value}
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--at-border)]">
        {tabsWithCounts.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              onClick={() => setParam("status", tab.value)}
              className={[
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-[var(--at-green)] text-[var(--at-green)]"
                  : "border-transparent text-[var(--at-text-secondary)] hover:text-[var(--at-text)] hover:border-[var(--at-grey-300)]",
              ].join(" ")}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={[
                    "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                    active
                      ? "bg-[var(--at-green-lightest)] text-[var(--at-green)]"
                      : "bg-[var(--at-grey-200)] text-[var(--at-grey-500)]",
                  ].join(" ")}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar: Search + BU filter */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--at-grey-400)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQ}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search quotes, clients..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--at-grey-300)] rounded-[var(--at-radius)] bg-white text-[var(--at-text)] placeholder:text-[var(--at-grey-400)] focus:outline-none focus:ring-2 focus:ring-[var(--at-green)] focus:border-[var(--at-green)] font-[var(--at-font)]"
          />
          {searchQ && (
            <button
              onClick={() => setParam("q", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--at-grey-400)] hover:text-[var(--at-grey-700)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* BU filter */}
        <div className="flex items-center border border-[var(--at-grey-300)] rounded-[var(--at-radius)] overflow-hidden">
          {(["ALL", "ACS", "CC"] as const).map((bu) => (
            <button
              key={bu}
              onClick={() => setParam("bu", bu)}
              className={[
                "px-3 py-2 text-xs font-semibold tracking-wide transition-colors",
                buFilter === bu
                  ? "bg-[var(--at-green-lightest)] text-[var(--at-green)]"
                  : "bg-white text-[var(--at-text-secondary)] hover:bg-[var(--at-grey-100)]",
                bu !== "ALL" ? "border-l border-[var(--at-grey-300)]" : "",
              ].join(" ")}
            >
              {bu}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const rows = filtered;
              const csv = ["Quote #,Client,Date,Amount,Status", ...rows.map((r) =>
                `${r.quote_number},${r.client_name},${fmtDate(r.created_at)},${r.estimated_total},${r.display_status}`
              )].join("\n");
              const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "quotes.csv" });
              a.click();
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Data table */}
      <Card>
        <DataTable<Quote>
          columns={columns}
          data={pageData}
          onRowClick={(row) => router.push(`/root/quotes/${row.id}`)}
          emptyMessage="No quotes match the current filters."
          loading={loading}
        />
      </Card>

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="flex items-center justify-between mt-4 text-sm text-[var(--at-text-secondary)] font-[var(--at-font)]">
          <span>
            {filtered.length > 0
              ? `${(page - 1) * perPage + 1}\u2013${Math.min(page * perPage, filtered.length)} of ${filtered.length}`
              : "0 records"}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
              className="px-3 py-1.5 border border-[var(--at-grey-300)] rounded-[var(--at-radius-sm)] disabled:opacity-30 hover:bg-[var(--at-grey-100)] transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setParam("page", String(p))}
                  className={[
                    "w-8 h-8 rounded-[var(--at-radius-sm)] text-sm font-medium transition-colors",
                    p === page
                      ? "bg-[var(--at-green)] text-white"
                      : "hover:bg-[var(--at-grey-100)] text-[var(--at-text-secondary)]",
                  ].join(" ")}
                >
                  {p}
                </button>
              );
            })}
            {totalPages > 7 && <span className="px-1 text-[var(--at-grey-400)]">...</span>}
            <button
              disabled={page >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
              className="px-3 py-1.5 border border-[var(--at-grey-300)] rounded-[var(--at-radius-sm)] disabled:opacity-30 hover:bg-[var(--at-grey-100)] transition-colors"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span>Per page:</span>
            <select
              value={perPage}
              onChange={(e) => { setParam("per", e.target.value); setParam("page", "1"); }}
              className="border border-[var(--at-grey-300)] rounded-[var(--at-radius-sm)] px-2 py-1 text-sm bg-white text-[var(--at-text)]"
            >
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* PDF preview modal */}
      <Modal
        open={!!pdpId}
        onClose={() => setPdpId(null)}
        title="PDF Preview"
        actions={
          <>
            <a
              href={pdpId ? `/api/root/quotes/${pdpId}/pdf` : "#"}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="primary" size="sm">Download PDF</Button>
            </a>
            <Button variant="secondary" size="sm" onClick={() => setPdpId(null)}>Close</Button>
          </>
        }
      >
        {pdpId && (
          <iframe
            src={`/api/root/quotes/${pdpId}/preview`}
            className="w-full border-0"
            style={{ height: "500px" }}
          />
        )}
      </Modal>
    </Page>
  );
}

export default function QuotesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--at-text-secondary)] font-[var(--at-font)]">
          Loading quotes...
        </div>
      }
    >
      <QuotesPageInner />
    </Suspense>
  );
}
