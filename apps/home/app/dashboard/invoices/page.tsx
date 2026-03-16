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
type Invoice = {
  id: string;
  invoice_number: string;
  business_unit: string;
  client_name: string;
  client_email: string;
  total: number;
  amount: number;
  amount_paid: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  invoice_status: string;
  payment_status: string;
  due_date: string | null;
  due_at: string | null;
  created_at: string;
  stripe_payment_link: string | null;
  display_status?: string;
  [key: string]: unknown;
};

/* ─── Derive display status ─── */
function deriveStatus(inv: Invoice): string {
  const st = inv.invoice_status || inv.status || "draft";
  if (["paid", "overdue", "awaiting_payment", "void", "draft", "reconciled"].includes(st)) return st;
  const total = inv.total || inv.amount || 0;
  const paid = inv.amount_paid || inv.paid_amount || 0;
  const due = inv.due_date ?? inv.due_at;
  if (paid >= total && total > 0) return "paid";
  if (due && new Date(due) < new Date() && paid < total) return "overdue";
  if (paid > 0 && paid < total) return "awaiting_payment";
  if (total > 0) return "awaiting_payment";
  return st;
}

function fmtAmount(n: number | undefined | null) {
  return "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

/* ─── Status mapping to Atlantis StatusLabel ─── */
const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  draft: "neutral",
  awaiting_payment: "info",
  overdue: "critical",
  paid: "success",
  void: "warning",
  reconciled: "success",
};

/* ─── Status tabs ─── */
const STATUS_TABS = [
  { label: "All",              value: "all" },
  { label: "Draft",            value: "draft" },
  { label: "Issued",           value: "awaiting_payment" },
  { label: "Overdue",          value: "overdue" },
  { label: "Paid",             value: "paid" },
  { label: "Reconciled",       value: "reconciled" },
];

/* ─── 3-dot action menu ─── */
function ActionMenu({ row, onAction }: { row: Invoice; onAction: (action: string, row: Invoice) => void }) {
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
    { key: "view", label: "View" },
    { key: "send_reminder", label: "Send Reminder" },
    { key: "record_payment", label: "Record Payment" },
    { key: "duplicate", label: "Duplicate", divider: true },
    { key: "mark_paid", label: "Mark as Paid" },
    { key: "void", label: "Void", danger: true, divider: true },
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
function InvoicesPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  /* State from URL */
  const activeTab = params.get("status") ?? "all";
  const buFilter  = params.get("bu")     ?? "ALL";
  const searchQ   = params.get("q")      ?? "";
  const sortKey   = params.get("sort")   ?? "created_at";
  const sortDir   = (params.get("dir")   ?? "desc") as "asc" | "desc";
  const page      = Number(params.get("page") ?? "1");
  const perPage   = Number(params.get("per")  ?? "25");

  /* Data */
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdpId, setPdpId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/root/invoices?limit=200")
      .then((r) => r.json())
      .then((d) => {
        const raw: Invoice[] = d.invoices ?? [];
        setAllInvoices(raw.map((inv) => ({ ...inv, display_status: deriveStatus(inv) })));
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
    let inv = allInvoices;
    if (buFilter !== "ALL") inv = inv.filter((r) => r.business_unit === buFilter);
    if (activeTab !== "all") inv = inv.filter((r) => r.display_status === activeTab);
    if (searchQ) {
      const lq = searchQ.toLowerCase();
      inv = inv.filter(
        (r) =>
          (r.client_name ?? "").toLowerCase().includes(lq) ||
          (r.invoice_number ?? "").toLowerCase().includes(lq) ||
          (r.client_email ?? "").toLowerCase().includes(lq)
      );
    }
    return [...inv].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allInvoices, buFilter, activeTab, searchQ, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  /* Metrics */
  const openBalance = allInvoices.reduce((s, i) => s + (i.balance_due || (i.total || i.amount || 0) - (i.amount_paid || i.paid_amount || 0)), 0);
  const overdueAmt  = allInvoices.filter((i) => i.display_status === "overdue").reduce((s, i) => s + Math.max(0, (i.total || i.amount || 0) - (i.amount_paid || i.paid_amount || 0)), 0);
  const overdueCount = allInvoices.filter((i) => i.display_status === "overdue").length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = allInvoices
    .filter((i) => i.display_status === "paid" && i.created_at && new Date(i.created_at) >= startOfMonth)
    .reduce((s, i) => s + (i.total || i.amount || 0), 0);
  const avgInvoice = allInvoices.length > 0
    ? allInvoices.reduce((s, i) => s + (i.total || i.amount || 0), 0) / allInvoices.length
    : 0;

  /* Tab counts */
  const tabsWithCounts = STATUS_TABS.map((t) => ({
    ...t,
    count: t.value === "all"
      ? allInvoices.length
      : allInvoices.filter((i) => i.display_status === t.value).length,
  }));

  /* Row action handler */
  const handleRowAction = useCallback((action: string, row: Invoice) => {
    switch (action) {
      case "view":
        router.push(`/root/invoices/${row.id}`);
        break;
      case "send_reminder":
        fetch(`/api/root/invoices/${row.id}/reminders`, { method: "POST" })
          .then(() => alert("Reminder sent."));
        break;
      case "record_payment":
        router.push(`/root/invoices/${row.id}?action=payment`);
        break;
      case "duplicate":
        fetch(`/api/root/invoices/${row.id}/duplicate`, { method: "POST" })
          .then(() => { setLoading(true); return fetch("/api/root/invoices?limit=200"); })
          .then((r) => r.json())
          .then((d) => setAllInvoices((d.invoices ?? []).map((inv: Invoice) => ({ ...inv, display_status: deriveStatus(inv) }))));
        break;
      case "mark_paid":
        fetch(`/api/root/invoices/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_status: "paid" }),
        }).then(() => setAllInvoices((prev) => prev.map((i) =>
          i.id === row.id ? { ...i, display_status: "paid", invoice_status: "paid" } : i
        )));
        break;
      case "void":
        if (confirm(`Void invoice ${row.invoice_number}?`))
          fetch(`/api/root/invoices/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice_status: "void" }),
          }).then(() => setAllInvoices((prev) => prev.map((i) =>
            i.id === row.id ? { ...i, display_status: "void", invoice_status: "void" } : i
          )));
        break;
    }
  }, [router]);

  /* DataTable columns */
  const columns = [
    {
      header: "Invoice #",
      accessorKey: "invoice_number" as const,
      cell: (_: unknown, row: Invoice) => (
        <span className="font-semibold text-[var(--at-green)]">
          {row.invoice_number || <span className="opacity-30">{"\u2014"}</span>}
        </span>
      ),
    },
    {
      header: "Client",
      accessorKey: "client_name" as const,
      cell: (_: unknown, row: Invoice) => (
        <div>
          <div className="font-medium text-[var(--at-text)]">{row.client_name || "\u2014"}</div>
          {row.client_email && (
            <div className="text-xs text-[var(--at-text-secondary)]">{row.client_email}</div>
          )}
        </div>
      ),
    },
    {
      header: "Amount",
      accessorKey: "total" as const,
      cell: (_: unknown, row: Invoice) => (
        <span className="font-medium text-[var(--at-text)]">
          {fmtAmount(row.total || row.amount)}
        </span>
      ),
    },
    {
      header: "Paid",
      accessorKey: "amount_paid" as const,
      cell: (_: unknown, row: Invoice) => {
        const paid = row.amount_paid || row.paid_amount || 0;
        return (
          <span className={paid > 0 ? "text-[var(--at-green)] font-medium" : "text-[var(--at-grey-400)]"}>
            {paid > 0 ? fmtAmount(paid) : "\u2014"}
          </span>
        );
      },
    },
    {
      header: "Balance",
      accessorKey: "balance_due" as const,
      cell: (_: unknown, row: Invoice) => {
        const total = row.total || row.amount || 0;
        const paid = row.amount_paid || row.paid_amount || 0;
        const balance = Math.max(0, total - paid);
        return (
          <span className={balance > 0 && row.display_status !== "paid" ? "font-semibold text-[color:hsl(35,80%,30%)]" : "text-[var(--at-grey-400)]"}>
            {balance > 0 ? fmtAmount(balance) : "\u2014"}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "display_status" as const,
      cell: (_: unknown, row: Invoice) => {
        const status = row.display_status ?? "draft";
        return (
          <StatusLabel status={STATUS_VARIANT[status] ?? "neutral"}>
            {status.replace(/_/g, " ")}
          </StatusLabel>
        );
      },
    },
    {
      header: "Due Date",
      accessorKey: "due_date" as const,
      cell: (_: unknown, row: Invoice) => {
        const due = row.due_date ?? row.due_at;
        const overdue = due && new Date(due) < new Date() && row.display_status !== "paid";
        return (
          <span className={`text-sm ${overdue ? "text-[var(--at-red)] font-semibold" : "text-[var(--at-text-secondary)]"}`}>
            {fmtDate(due)}
          </span>
        );
      },
    },
    {
      header: "",
      accessorKey: "id" as const,
      cell: (_: unknown, row: Invoice) => (
        <ActionMenu row={row} onAction={handleRowAction} />
      ),
    },
  ];

  /* Metric cards data */
  const metrics = [
    { label: "Total Outstanding", value: fmtAmount(openBalance), color: "" },
    { label: "Overdue", value: `${fmtAmount(overdueAmt)} (${overdueCount})`, color: overdueCount > 0 ? "var(--at-red)" : "" },
    { label: "Paid This Month", value: fmtAmount(paidThisMonth), color: "var(--at-green)" },
    { label: "Average Invoice", value: fmtAmount(avgInvoice), color: "" },
  ];

  return (
    <Page
      title="Invoices"
      subtitle={`${allInvoices.length} total invoices across all business units`}
      actions={
        <Link href="/root/invoices/new">
          <Button variant="primary">+ New Invoice</Button>
        </Link>
      }
    >
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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
            placeholder="Search invoices, clients..."
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

        {/* Export CSV */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const rows = filtered;
              const csv = ["Invoice #,Client,Due,Amount,Paid,Balance,Status", ...rows.map((r) =>
                `${r.invoice_number},${r.client_name},${fmtDate(r.due_date)},${r.total || r.amount},${r.amount_paid || 0},${Math.max(0,(r.total||0)-(r.amount_paid||0))},${r.display_status}`
              )].join("\n");
              const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "invoices.csv" });
              a.click();
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Data table */}
      <Card>
        <DataTable<Invoice>
          columns={columns}
          data={pageData}
          onRowClick={(row) => router.push(`/root/invoices/${row.id}`)}
          emptyMessage="No invoices match the current filters."
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
              href={pdpId ? `/api/root/invoices/${pdpId}/pdf` : "#"}
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
            src={`/api/root/invoices/${pdpId}/preview`}
            className="w-full border-0"
            style={{ height: "500px" }}
          />
        )}
      </Modal>
    </Page>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--at-text-secondary)] font-[var(--at-font)]">
          Loading invoices...
        </div>
      }
    >
      <InvoicesPageInner />
    </Suspense>
  );
}
