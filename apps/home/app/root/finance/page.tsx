"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Page } from "@contentco-op/ui/src/atlantis/Page";
import { DataTable } from "@contentco-op/ui/src/atlantis/DataTable";
import { StatusLabel } from "@contentco-op/ui/src/atlantis/StatusLabel";
import { Button } from "@contentco-op/ui/src/atlantis/Button";
import { Card } from "@contentco-op/ui/src/atlantis/Card";

/* ─── Types ─── */
interface FinanceRow {
  id: string;
  type: "invoice" | "payment" | "quote";
  description: string;
  amount: number;
  status: string;
  business_unit: string;
  date: string;
  contact_name?: string;
  source?: string;
  [key: string]: unknown;
}

type BizFilter = "ALL" | "ACS" | "CC";
type StatusTab = "all" | "revenue" | "expenses" | "pending";

/* ─── Helpers ─── */
function fmtAmount(n: number) {
  return "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

/* ─── Status mapping ─── */
const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  draft: "neutral",
  sent: "info",
  paid: "success",
  overdue: "critical",
  pending: "warning",
  partial: "warning",
  void: "neutral",
  cancelled: "neutral",
};

/* ─── Status tabs ─── */
const STATUS_TABS: { label: string; value: StatusTab }[] = [
  { label: "All", value: "all" },
  { label: "Revenue", value: "revenue" },
  { label: "Expenses", value: "expenses" },
  { label: "Pending", value: "pending" },
];

/* ─── Inner component ─── */
function FinancePageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const activeTab = (params.get("tab") ?? "all") as StatusTab;
  const buFilter = (params.get("bu") ?? "ALL") as BizFilter;
  const searchQ = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");
  const perPage = Number(params.get("per") ?? "25");

  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/root/finance")
      .then((res) => res.json())
      .then((data) => {
        setFinance(data.finance || []);
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

  /* Filtered data */
  const filtered = useMemo(() => {
    let rows = finance;

    // BU filter
    if (buFilter !== "ALL") {
      rows = rows.filter((f) => (f.business_unit || "ACS").toUpperCase() === buFilter);
    }

    // Tab filter
    if (activeTab === "revenue") {
      rows = rows.filter((f) => f.type === "invoice" && f.status === "paid");
    } else if (activeTab === "expenses") {
      rows = rows.filter((f) => f.type === "payment" || f.source === "bank_statement");
    } else if (activeTab === "pending") {
      rows = rows.filter((f) => ["sent", "pending", "overdue", "draft"].includes(f.status));
    }

    // Search
    if (searchQ) {
      const lq = searchQ.toLowerCase();
      rows = rows.filter(
        (f) =>
          f.description.toLowerCase().includes(lq) ||
          (f.contact_name || "").toLowerCase().includes(lq) ||
          f.type.toLowerCase().includes(lq)
      );
    }

    return rows;
  }, [finance, buFilter, activeTab, searchQ]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  /* Metrics */
  const totalRevenue = finance
    .filter((f) => f.type === "invoice" && f.status === "paid")
    .reduce((sum, f) => sum + f.amount, 0);

  const totalOutstanding = finance
    .filter((f) => f.type === "invoice" && ["sent", "overdue"].includes(f.status))
    .reduce((sum, f) => sum + f.amount, 0);

  const totalQuoted = finance
    .filter((f) => f.type === "quote" && ["pending", "sent"].includes(f.status))
    .reduce((sum, f) => sum + f.amount, 0);

  const totalOverdue = finance
    .filter((f) => f.type === "invoice" && f.status === "overdue")
    .reduce((sum, f) => sum + f.amount, 0);

  const bankStatementCount = finance.filter((f) => f.source === "bank_statement").length;

  /* Tab counts */
  const tabCounts: Record<StatusTab, number> = {
    all: finance.length,
    revenue: finance.filter((f) => f.type === "invoice" && f.status === "paid").length,
    expenses: finance.filter((f) => f.type === "payment" || f.source === "bank_statement").length,
    pending: finance.filter((f) => ["sent", "pending", "overdue", "draft"].includes(f.status)).length,
  };

  /* Metric cards */
  const metrics = [
    { label: "Revenue", value: fmtAmount(totalRevenue), accent: "var(--at-green)", icon: "\u2191" },
    { label: "Outstanding", value: fmtAmount(totalOutstanding), accent: "var(--at-yellow)", icon: "\u231B" },
    { label: "Quoted Pipeline", value: fmtAmount(totalQuoted), accent: "var(--at-blue)", icon: "\u2192" },
    { label: "Overdue", value: fmtAmount(totalOverdue), accent: "var(--at-red)", icon: "\u26A0" },
  ];

  /* DataTable columns */
  const columns = [
    {
      header: "Type",
      accessorKey: "type" as const,
      cell: (_: unknown, row: FinanceRow) => (
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: row.type === "invoice" ? "var(--at-green)" : row.type === "quote" ? "var(--at-blue)" : "var(--at-grey-500)" }}
        >
          {row.type}
        </span>
      ),
    },
    {
      header: "Number",
      accessorKey: "description" as const,
      cell: (_: unknown, row: FinanceRow) => (
        <span className="font-semibold text-[var(--at-text)]">
          {row.type === "quote" ? (
            <Link href={`/root/quotes/${row.id}`} className="text-[var(--at-green)] hover:underline">
              {row.description}
            </Link>
          ) : (
            row.description
          )}
        </span>
      ),
    },
    {
      header: "Client",
      accessorKey: "contact_name" as const,
      cell: (_: unknown, row: FinanceRow) => (
        <span className="text-sm text-[var(--at-text)]">
          {row.contact_name || "\u2014"}
        </span>
      ),
    },
    {
      header: "Amount",
      accessorKey: "amount" as const,
      cell: (_: unknown, row: FinanceRow) => (
        <span className="font-semibold tabular-nums text-[var(--at-text)]">
          {fmtAmount(row.amount)}
        </span>
      ),
    },
    {
      header: "BU",
      accessorKey: "business_unit" as const,
      cell: (_: unknown, row: FinanceRow) => (
        <span className="text-xs text-[var(--at-grey-500)] uppercase tracking-wide font-medium">
          {row.business_unit || "ACS"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status" as const,
      cell: (_: unknown, row: FinanceRow) => {
        const status = row.status || "draft";
        return (
          <StatusLabel status={STATUS_VARIANT[status] ?? "neutral"}>
            {status.replace(/_/g, " ")}
          </StatusLabel>
        );
      },
    },
    {
      header: "Date",
      accessorKey: "date" as const,
      cell: (_: unknown, row: FinanceRow) => (
        <span className="text-sm text-[var(--at-text-secondary)]">{fmtDate(row.date)}</span>
      ),
    },
    {
      header: "Source",
      accessorKey: "source" as const,
      cell: (_: unknown, row: FinanceRow) => {
        if (row.source === "bank_statement") {
          return <StatusLabel status="warning">Parsed</StatusLabel>;
        }
        if (row.source === "auto") {
          return <StatusLabel status="info">Auto</StatusLabel>;
        }
        return <span className="text-[var(--at-text-secondary)]">{"\u2014"}</span>;
      },
    },
  ];

  return (
    <Page
      title="Finance"
      subtitle={
        bankStatementCount > 0
          ? `${finance.length} records \u00B7 ${bankStatementCount} from parsed bank statements`
          : `${finance.length} total finance records`
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const rows = filtered;
              const csv = [
                "Type,Number,Client,Amount,BU,Status,Date,Source",
                ...rows.map((r) =>
                  `${r.type},${r.description},${r.contact_name || ""},${r.amount},${r.business_unit},${r.status},${fmtDate(r.date)},${r.source || ""}`
                ),
              ].join("\n");
              const a = Object.assign(document.createElement("a"), {
                href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
                download: "finance.csv",
              });
              a.click();
            }}
          >
            Export CSV
          </Button>
          <Link href="/root/invoices/new">
            <Button variant="primary">+ New Invoice</Button>
          </Link>
        </div>
      }
    >
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <Card key={m.label} accent={m.accent}>
            <Card.Body>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-[var(--at-text-secondary)] uppercase tracking-wide font-medium">
                  {m.label}
                </div>
                <span className="text-base opacity-60">{m.icon}</span>
              </div>
              <div
                className="text-2xl font-bold font-[var(--at-font-display)] tabular-nums"
                style={{ color: m.accent }}
              >
                {m.value}
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--at-border)]">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              onClick={() => setParam("tab", tab.value)}
              className={[
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-[var(--at-green)] text-[var(--at-green)]"
                  : "border-transparent text-[var(--at-text-secondary)] hover:text-[var(--at-text)] hover:border-[var(--at-grey-300)]",
              ].join(" ")}
            >
              {tab.label}
              <span
                className={[
                  "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                  active
                    ? "bg-[var(--at-green-lightest)] text-[var(--at-green)]"
                    : "bg-[var(--at-grey-200)] text-[var(--at-grey-500)]",
                ].join(" ")}
              >
                {tabCounts[tab.value]}
              </span>
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
            placeholder="Search finance records..."
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
          {(["ALL", "ACS", "CC"] as BizFilter[]).map((bu) => (
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
      </div>

      {/* Data table */}
      <Card>
        <DataTable<FinanceRow>
          columns={columns}
          data={pageData}
          emptyMessage="No finance records match the current filters."
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
    </Page>
  );
}

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--at-text-secondary)] font-[var(--at-font)]">
          Loading finance data...
        </div>
      }
    >
      <FinancePageInner />
    </Suspense>
  );
}
