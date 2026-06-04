"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@contentco-op/ui/src/atlantis/Page";
import { DataTable } from "@contentco-op/ui/src/atlantis/DataTable";
import { StatusLabel } from "@contentco-op/ui/src/atlantis/StatusLabel";
import { Button } from "@contentco-op/ui/src/atlantis/Button";
import { Card } from "@contentco-op/ui/src/atlantis/Card";

type WorkspaceCode = "ACS" | "CC";

type Contact = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status?: string | null;
  created_at: string;
  last_activity?: string | null;
  business_unit?: string | null;
  business_memberships?: Array<{ business_id: string; code: WorkspaceCode; name: string }>;
  workspace_memberships?: WorkspaceCode[];
  preferred_channel?: string | null;
  source?: string | null;
  orbit_tier?: string | null;
  tags?: string[];
  relationship_rank?: number;
  relationship_band?: "priority" | "active" | "warming" | "monitor";
  relationship_score?: number;
  lead_score?: number;
  lead_status?: string | null;
  priority_score?: number;
  open_invoice_count?: number;
  paid_invoice_count?: number;
  open_quote_count?: number;
  accepted_quotes?: number;
  quote_count?: number;
  total_revenue?: number;
  outstanding_balance?: number;
  total_jobs?: number;
  last_conversation_at?: string | null;
  open_conversation_count?: number;
  conversation_channels?: string[];
  sentiment_trend?: string | null;
  client_code?: string | null;
  account_code?: string | null;
  preferences_summary?: string | null;
  next_best_action?: string | null;
  [key: string]: unknown;
};

function normalizeBusinessUnit(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "ACS" || normalized === "CC" ? normalized : null;
}

function getWorkspaces(contact: Contact) {
  const explicit = Array.isArray(contact.workspace_memberships)
    ? contact.workspace_memberships.filter((value): value is WorkspaceCode => value === "ACS" || value === "CC")
    : [];
  if (explicit.length) return explicit as WorkspaceCode[];
  const fallback = normalizeBusinessUnit(contact.business_unit);
  return fallback ? ([fallback] as WorkspaceCode[]) : [];
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "\u2014";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "\u2014";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtMoney(value: number | null | undefined) {
  return (value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function workspaceTone(code: WorkspaceCode) {
  return code === "ACS" ? "var(--at-blue)" : "var(--at-green)";
}

const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  active: "success",
  inactive: "neutral",
  prospect: "info",
  lead: "warning",
  qualified: "success",
  nurturing: "warning",
  merged: "neutral",
};

const RELATIONSHIP_VARIANT: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  priority: "success",
  active: "info",
  warming: "warning",
  monitor: "neutral",
};

function ActionMenu({ row, onAction }: { row: Contact; onAction: (action: string, row: Contact) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const actions = [
    { key: "view", label: "Open dossier" },
    { key: "quotes", label: "View quotes" },
    { key: "invoices", label: "View invoices" },
    { key: "send_message", label: "Send message", divider: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--at-radius-sm)] text-[var(--at-grey-500)] transition-colors hover:bg-[var(--at-grey-100)] hover:text-[var(--at-grey-900)]"
        aria-label="Actions"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-[var(--at-radius)] border border-[var(--at-border)] bg-white py-1 font-[var(--at-font)] shadow-lg">
          {actions.map((action) => (
            <React.Fragment key={action.key}>
              {action.divider ? <div className="my-1 h-px bg-[var(--at-grey-200)]" /> : null}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  onAction(action.key, row);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-[var(--at-text)] transition-colors hover:bg-[var(--at-grey-100)]"
              >
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContactsPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const buFilter = params.get("bu") ?? "ALL";
  const searchQ = params.get("q") ?? "";
  const contactId = params.get("contact_id") ?? "";
  const page = Number(params.get("page") ?? "1");
  const perPage = Number(params.get("per") ?? "50");

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importingGoogle, setImportingGoogle] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadContacts = useCallback(() => {
    setLoading(true);
    return fetch("/api/root/contacts?limit=750&ranked=1")
      .then((response) => response.json())
      .then((data) => {
        setAllContacts(data.contacts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key !== "page") next.set("page", "1");
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    let contacts = allContacts;

    if (buFilter === "ACS" || buFilter === "CC") {
      contacts = contacts.filter((contact) => getWorkspaces(contact).includes(buFilter as WorkspaceCode));
    } else if (buFilter === "CROSS") {
      contacts = contacts.filter((contact) => getWorkspaces(contact).length > 1);
    }

    if (contactId) contacts = contacts.filter((contact) => contact.id === contactId);

    if (searchQ) {
      const query = searchQ.toLowerCase();
      contacts = contacts.filter((contact) => {
        const haystack = [
          contact.full_name,
          contact.email,
          contact.phone,
          contact.company,
          contact.client_code,
          contact.account_code,
          contact.source,
          contact.preferences_summary,
          ...(contact.tags || []),
          ...(contact.business_memberships || []).map((entry) => entry.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return contacts;
  }, [allContacts, buFilter, contactId, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  const totalContacts = allContacts.length;
  const acsCount = allContacts.filter((contact) => getWorkspaces(contact).includes("ACS")).length;
  const ccCount = allContacts.filter((contact) => getWorkspaces(contact).includes("CC")).length;
  const crossBusinessCount = allContacts.filter((contact) => getWorkspaces(contact).length > 1).length;
  const priorityCount = allContacts.filter((contact) => Number(contact.relationship_rank || 0) >= 80).length;

  const handleRowAction = useCallback(
    (action: string, row: Contact) => {
      switch (action) {
        case "view":
          router.push(`/root/contacts/${row.id}`);
          break;
        case "quotes":
          router.push(`/root/quotes?contact_id=${row.id}`);
          break;
        case "invoices":
          router.push(`/root/invoices?contact_id=${row.id}`);
          break;
        case "send_message":
          router.push(`/root/contacts/${row.id}?action=message`);
          break;
      }
    },
    [router],
  );

  async function importGoogleContacts() {
    setImportingGoogle(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await fetch("/api/root/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "google_contacts", scope: buFilter === "ACS" ? "ACS" : buFilter === "CC" ? "CCO" : "CROSS", limit: 250 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data.error || "google_contact_import_failed"));
      setActionNotice(
        `${Number(data.created_count || 0)} created · ${Number(data.updated_count || 0)} updated · ${Number(data.duplicate_count || 0)} matched`,
      );
      await loadContacts();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "google_contact_import_failed");
    } finally {
      setImportingGoogle(false);
    }
  }

  async function importCsvFile(file: File) {
    setImportingCsv(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const csv = await file.text();
      const response = await fetch("/api/root/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "csv",
          csv,
          scope: buFilter === "ACS" ? "ACS" : buFilter === "CC" ? "CCO" : "CROSS",
          source_ref: file.name,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data.error || "csv_import_failed"));
      setActionNotice(
        `${Number(data.created_count || 0)} created · ${Number(data.updated_count || 0)} updated · ${Number(data.duplicate_count || 0)} matched from ${file.name}`,
      );
      await loadContacts();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "csv_import_failed");
    } finally {
      setImportingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function enrichContacts() {
    setEnriching(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await fetch("/api/root/contacts/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: buFilter === "ACS" ? "ACS" : buFilter === "CC" ? "CCO" : "CROSS",
          limit: 200,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(data.error || "contact_enrichment_failed"));
      setActionNotice(`Enrichment refreshed for ${Number(data.updated || 0)} contacts.`);
      await loadContacts();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "contact_enrichment_failed");
    } finally {
      setEnriching(false);
    }
  }

  const columns = [
    {
      header: "Rank",
      accessorKey: "relationship_rank" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="text-lg font-semibold text-[var(--at-text)]">{Number(row.relationship_rank || 0)}</div>
          <StatusLabel status={RELATIONSHIP_VARIANT[String(row.relationship_band || "monitor")] || "neutral"}>
            {String(row.relationship_band || "monitor")}
          </StatusLabel>
        </div>
      ),
    },
    {
      header: "Contact",
      accessorKey: "full_name" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="font-medium text-[var(--at-text)]">{row.full_name || "\u2014"}</div>
          <div className="text-sm text-[var(--at-text-secondary)]">{row.email || row.phone || "\u2014"}</div>
          <div className="text-xs uppercase tracking-wide text-[var(--at-grey-500)]">
            {String(row.status || row.lead_status || row.contact_type || "stewarded")}
          </div>
        </div>
      ),
    },
    {
      header: "Workspaces",
      accessorKey: "workspace_memberships" as const,
      cell: (_: unknown, row: Contact) => {
        const workspaces = getWorkspaces(row);
        return (
          <div className="grid gap-1">
            <div className="flex flex-wrap gap-1.5">
              {workspaces.length ? (
                workspaces.map((workspace) => (
                  <span
                    key={workspace}
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ background: `${workspaceTone(workspace)}1A`, color: workspaceTone(workspace) }}
                  >
                    {workspace}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--at-text-secondary)]">\u2014</span>
              )}
            </div>
            <div className="text-xs text-[var(--at-grey-500)]">
              {(row.business_memberships || []).map((entry) => entry.name).join(" · ") || "single-business"}
            </div>
          </div>
        );
      },
    },
    {
      header: "Client Intel",
      accessorKey: "company" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="font-medium text-[var(--at-text)]">{row.company || "\u2014"}</div>
          <div className="text-sm text-[var(--at-text-secondary)]">
            {row.client_code || row.account_code ? [row.client_code, row.account_code].filter(Boolean).join(" · ") : row.source || "\u2014"}
          </div>
          <div className="text-xs text-[var(--at-grey-500)]">
            {(row.tags || []).slice(0, 3).join(" · ") || row.orbit_tier || "no tags"}
          </div>
        </div>
      ),
    },
    {
      header: "Relationship",
      accessorKey: "preferred_channel" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="text-sm font-medium text-[var(--at-text)]">
            {row.preferred_channel || "channel unassigned"}{row.sentiment_trend ? ` · ${row.sentiment_trend}` : ""}
          </div>
          <div className="text-sm text-[var(--at-text-secondary)]">
            lead {Number(row.lead_score || 0)} · priority {Number(row.priority_score || 0)}
          </div>
          <div className="text-xs text-[var(--at-grey-500)]">{row.preferences_summary || "no preference memory yet"}</div>
        </div>
      ),
    },
    {
      header: "Commercial",
      accessorKey: "total_revenue" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="font-medium text-[var(--at-text)]">{fmtMoney(Number(row.total_revenue || 0))}</div>
          <div className="text-sm text-[var(--at-text-secondary)]">
            {Number(row.quote_count || 0)} quotes · {Number(row.accepted_quotes || 0)} accepted
          </div>
          <div className="text-xs text-[var(--at-grey-500)]">
            {Number(row.open_invoice_count || 0)} open invoices · {fmtMoney(Number(row.outstanding_balance || 0))} due
          </div>
        </div>
      ),
    },
    {
      header: "Conversation",
      accessorKey: "last_conversation_at" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="font-medium text-[var(--at-text)]">{fmtDate(row.last_conversation_at)}</div>
          <div className="text-sm text-[var(--at-text-secondary)]">
            {Number(row.open_conversation_count || 0)} active lanes
          </div>
          <div className="text-xs text-[var(--at-grey-500)]">
            {(row.conversation_channels || []).join(" · ") || "no recent conversation log"}
          </div>
        </div>
      ),
    },
    {
      header: "Next",
      accessorKey: "next_best_action" as const,
      cell: (_: unknown, row: Contact) => (
        <div className="grid gap-1">
          <div className="font-medium text-[var(--at-text)]">{row.next_best_action || "review dossier"}</div>
          <div className="text-xs text-[var(--at-grey-500)]">Last activity {fmtDate(row.last_activity || row.created_at)}</div>
        </div>
      ),
    },
    {
      header: "",
      accessorKey: "id" as const,
      cell: (_: unknown, row: Contact) => <ActionMenu row={row} onAction={handleRowAction} />,
    },
  ];

  const metrics = [
    { label: "Stewarded Contacts", value: String(totalContacts), color: "" },
    { label: "ACS", value: String(acsCount), color: "var(--at-blue)" },
    { label: "CCO", value: String(ccCount), color: "var(--at-green)" },
    { label: "Cross-Business", value: String(crossBusinessCount), color: "" },
    { label: "Priority 80+", value: String(priorityCount), color: "var(--at-green)" },
  ];

  return (
    <Page
      title="Contacts"
      subtitle="Ranked ROOT contact brain across ACS and Content Co-op. Fresh relationship, finance, and conversation state capped to 750 operators-first records."
      actions={<Button variant="primary">+ Add Contact</Button>}
    >
      <div className="mb-6 grid grid-cols-5 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <Card.Body>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--at-text-secondary)]">{metric.label}</div>
              <div
                className="text-xl font-bold font-[var(--at-font-display)]"
                style={metric.color ? { color: metric.color } : undefined}
              >
                {metric.value}
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--at-grey-400)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQ}
            onChange={(event) => setParam("q", event.target.value)}
            placeholder="Search name, company, code, source, preferences..."
            className="w-full rounded-[var(--at-radius)] border border-[var(--at-grey-300)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--at-text)] placeholder:text-[var(--at-grey-400)] focus:border-[var(--at-green)] focus:outline-none focus:ring-2 focus:ring-[var(--at-green)]"
          />
        </div>

        <div className="flex items-center overflow-hidden rounded-[var(--at-radius)] border border-[var(--at-grey-300)]">
          {(["ALL", "ACS", "CC", "CROSS"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setParam("bu", value)}
              className={[
                "px-3 py-2 text-xs font-semibold tracking-wide transition-colors",
                buFilter === value
                  ? "bg-[var(--at-green-lightest)] text-[var(--at-green)]"
                  : "bg-white text-[var(--at-text-secondary)] hover:bg-[var(--at-grey-100)]",
                value !== "ALL" ? "border-l border-[var(--at-grey-300)]" : "",
              ].join(" ")}
            >
              {value === "CROSS" ? "Cross" : value}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCsvFile(file);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importingCsv}
          >
            {importingCsv ? "Importing CSV..." : "Import CSV"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void importGoogleContacts()}
            disabled={importingGoogle}
          >
            {importingGoogle ? "Importing Google..." : "Google import"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void enrichContacts()}
            disabled={enriching}
          >
            {enriching ? "Enriching..." : "Enrich top 200"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const rows = filtered;
              const csv = [
                "Rank,Name,Email,Phone,Company,Workspaces,Client Code,Account Code,Preferred Channel,Revenue,Outstanding,Quotes,Accepted Quotes,Open Invoices,Open Conversations,Next Action",
                ...rows.map((row) =>
                  [
                    Number(row.relationship_rank || 0),
                    row.full_name || "",
                    row.email || "",
                    row.phone || "",
                    row.company || "",
                    getWorkspaces(row).join("|"),
                    row.client_code || "",
                    row.account_code || "",
                    row.preferred_channel || "",
                    Number(row.total_revenue || 0),
                    Number(row.outstanding_balance || 0),
                    Number(row.quote_count || 0),
                    Number(row.accepted_quotes || 0),
                    Number(row.open_invoice_count || 0),
                    Number(row.open_conversation_count || 0),
                    row.next_best_action || "",
                  ]
                    .map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`)
                    .join(","),
                ),
              ].join("\n");
              const link = Object.assign(document.createElement("a"), {
                href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
                download: "root-ranked-contacts.csv",
              });
              link.click();
            }}
          >
            Export ranked CSV
          </Button>
        </div>
      </div>

      {actionNotice ? (
        <div className="mb-4">
        <Card>
          <Card.Body>
            <div className="text-sm font-medium text-[var(--at-green)]">{actionNotice}</div>
          </Card.Body>
        </Card>
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
        <Card>
          <Card.Body>
            <div className="text-sm font-medium text-[var(--at-red)]">{actionError}</div>
          </Card.Body>
        </Card>
        </div>
      ) : null}

      <Card>
        <DataTable<Contact>
          columns={columns}
          data={pageData}
          onRowClick={(row) => router.push(`/root/contacts/${row.id}`)}
          emptyMessage="No contacts match the current filters."
          loading={loading}
        />
      </Card>

      {filtered.length > perPage ? (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--at-text-secondary)]">
          <span>
            {filtered.length > 0
              ? `${(page - 1) * perPage + 1}\u2013${Math.min(page * perPage, filtered.length)} of ${filtered.length}`
              : "0 records"}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
              className="rounded-[var(--at-radius-sm)] border border-[var(--at-grey-300)] px-3 py-1.5 transition-colors hover:bg-[var(--at-grey-100)] disabled:opacity-30"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setParam("page", String(pageNumber))}
                  className={[
                    "h-8 w-8 rounded-[var(--at-radius-sm)] text-sm font-medium transition-colors",
                    pageNumber === page
                      ? "bg-[var(--at-green)] text-white"
                      : "text-[var(--at-text-secondary)] hover:bg-[var(--at-grey-100)]",
                  ].join(" ")}
                >
                  {pageNumber}
                </button>
              );
            })}
            {totalPages > 7 ? <span className="px-1 text-[var(--at-grey-400)]">...</span> : null}
            <button
              disabled={page >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
              className="rounded-[var(--at-radius-sm)] border border-[var(--at-grey-300)] px-3 py-1.5 transition-colors hover:bg-[var(--at-grey-100)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span>Per page:</span>
            <select
              value={perPage}
              onChange={(event) => {
                setParam("per", event.target.value);
                setParam("page", "1");
              }}
              className="rounded-[var(--at-radius-sm)] border border-[var(--at-grey-300)] bg-white px-2 py-1 text-sm text-[var(--at-text)]"
            >
              {[25, 50, 100, 250].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

export default function ContactsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--at-text-secondary)]">
          Loading contacts...
        </div>
      }
    >
      <ContactsPageInner />
    </Suspense>
  );
}
