"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@contentco-op/ui/src/atlantis/Page";
import { DataTable } from "@contentco-op/ui/src/atlantis/DataTable";
import { StatusLabel } from "@contentco-op/ui/src/atlantis/StatusLabel";
import { Button } from "@contentco-op/ui/src/atlantis/Button";
import { Card } from "@contentco-op/ui/src/atlantis/Card";

/* ─── Types ─── */
type Contact = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  business_unit: string;
  status: string;
  created_at: string;
  last_activity?: string;
  [key: string]: unknown;
};

function normalizeBusinessUnit(value: unknown) {
  const normalized = String(value || "ACS").trim().toUpperCase();
  return normalized || "ACS";
}

/* ─── Status mapping to Atlantis StatusLabel ─── */
const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  active: "success",
  inactive: "neutral",
  prospect: "info",
  lead: "warning",
};

/* ─── 3-dot action menu ─── */
function ActionMenu({ row, onAction }: { row: Contact; onAction: (action: string, row: Contact) => void }) {
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
    { key: "edit", label: "Edit" },
    { key: "send_message", label: "Send Message", divider: true },
    { key: "add_note", label: "Add Note" },
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
                className="w-full text-left px-3 py-1.5 text-sm transition-colors text-[var(--at-text)] hover:bg-[var(--at-grey-100)]"
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

function fmtDate(d: string | null | undefined) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

/* ─── Inner component (uses useSearchParams) ─── */
function ContactsPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  /* State from URL */
  const buFilter = params.get("bu") ?? "ALL";
  const searchQ  = params.get("q")  ?? "";
  const contactId = params.get("contact_id") ?? "";
  const page     = Number(params.get("page") ?? "1");
  const perPage  = Number(params.get("per")  ?? "25");

  /* Data */
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/root/contacts")
      .then((res) => res.json())
      .then((data) => { setAllContacts(data.contacts || []); })
      .catch(() => {})
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
    let c = allContacts;
    if (buFilter !== "ALL") c = c.filter((r) => normalizeBusinessUnit(r.business_unit) === buFilter);
    if (contactId) c = c.filter((r) => r.id === contactId);
    if (searchQ) {
      const lq = searchQ.toLowerCase();
      c = c.filter(
        (r) =>
          (r.full_name || "").toLowerCase().includes(lq) ||
          (r.email || "").toLowerCase().includes(lq) ||
          (r.company || "").toLowerCase().includes(lq) ||
          (r.phone || "").toLowerCase().includes(lq)
      );
    }
    return c;
  }, [allContacts, buFilter, contactId, searchQ]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  /* Metrics */
  const totalContacts = allContacts.length;
  const acsCount = allContacts.filter((c) => normalizeBusinessUnit(c.business_unit) === "ACS").length;
  const ccCount = allContacts.filter((c) => normalizeBusinessUnit(c.business_unit) === "CC").length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeThisMonth = allContacts.filter((c) => {
    const d = c.last_activity || c.created_at;
    return d && new Date(d) >= startOfMonth;
  }).length;

  /* Row action handler */
  const handleRowAction = useCallback((action: string, row: Contact) => {
    switch (action) {
      case "view":
        router.push(`/root/contacts/${row.id}`);
        break;
      case "edit":
        router.push(`/root/contacts/${row.id}?edit=true`);
        break;
      case "send_message":
        router.push(`/root/contacts/${row.id}?action=message`);
        break;
      case "add_note":
        router.push(`/root/contacts/${row.id}?action=note`);
        break;
    }
  }, [router]);

  /* DataTable columns */
  const columns = [
    {
      header: "Name",
      accessorKey: "full_name" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="font-medium text-[var(--at-text)]">
          {row.full_name || "\u2014"}
        </span>
      ),
    },
    {
      header: "Email",
      accessorKey: "email" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-sm text-[var(--at-text-secondary)]">
          {row.email || "\u2014"}
        </span>
      ),
    },
    {
      header: "Phone",
      accessorKey: "phone" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-sm text-[var(--at-text-secondary)]">
          {row.phone || "\u2014"}
        </span>
      ),
    },
    {
      header: "Company",
      accessorKey: "company" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-sm text-[var(--at-text)]">
          {row.company || "\u2014"}
        </span>
      ),
    },
    {
      header: "BU",
      accessorKey: "business_unit" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-xs text-[var(--at-grey-400)] uppercase tracking-wide">
          {normalizeBusinessUnit(row.business_unit)}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status" as const,
      cell: (_: unknown, row: Contact) => {
        const status = (row.status || "active").toLowerCase();
        return (
          <StatusLabel status={STATUS_VARIANT[status] ?? "neutral"}>
            {status}
          </StatusLabel>
        );
      },
    },
    {
      header: "Last Contact",
      accessorKey: "last_activity" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-sm text-[var(--at-text-secondary)]">
          {fmtDate(row.last_activity || row.created_at)}
        </span>
      ),
    },
    {
      header: "",
      accessorKey: "id" as const,
      cell: (_: unknown, row: Contact) => (
        <ActionMenu row={row} onAction={handleRowAction} />
      ),
    },
  ];

  /* Metric cards data */
  const metrics = [
    { label: "Total Contacts", value: String(totalContacts), color: "" },
    { label: "ACS", value: String(acsCount), color: "var(--at-blue)" },
    { label: "CC", value: String(ccCount), color: "var(--at-green)" },
    { label: "Active This Month", value: String(activeThisMonth), color: "" },
  ];

  return (
    <Page
      title="Contacts"
      subtitle={`${allContacts.length} total contacts across all business units`}
      actions={
        <Button variant="primary">+ Add Contact</Button>
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
            placeholder="Search contacts, companies..."
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
              const csv = ["Name,Email,Phone,Company,BU,Status", ...rows.map((r) =>
                `"${r.full_name || ""}","${r.email || ""}","${r.phone || ""}","${r.company || ""}","${r.business_unit || ""}","${r.status || ""}"`
              )].join("\n");
              const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "contacts.csv" });
              a.click();
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Data table */}
      <Card>
        <DataTable<Contact>
          columns={columns}
          data={pageData}
          onRowClick={(row) => router.push(`/root/contacts/${row.id}`)}
          emptyMessage="No contacts match the current filters."
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

export default function ContactsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--at-text-secondary)] font-[var(--at-font)]">
          Loading contacts...
        </div>
      }
    >
      <ContactsPageInner />
    </Suspense>
  );
}
