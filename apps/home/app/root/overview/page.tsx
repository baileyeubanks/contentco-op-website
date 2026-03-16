"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Page } from "@contentco-op/ui/src/atlantis/Page";
import { Card } from "@contentco-op/ui/src/atlantis/Card";
import { Button } from "@contentco-op/ui/src/atlantis/Button";
import { StatusLabel } from "@contentco-op/ui/src/atlantis/StatusLabel";
import { DataTable } from "@contentco-op/ui/src/atlantis/DataTable";

/* ─── Types ─── */
interface Contact {
  id: string;
  name: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  business_unit: string[] | null;
  contact_type: string;
  status: string;
  total_revenue: number;
  total_jobs: number;
  last_contacted: string;
  priority_score: number;
  city: string;
  state: string;
  orbit_tier: string;
  tags: string[];
  created_at: string;
  [key: string]: unknown;
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  estimated_total: number;
  status: string;
  client_status: string;
  business_unit: string;
  service_type: string;
  frequency: string;
  booked_date: string;
  booked_slot: string;
  address: string;
  created_at: string;
  [key: string]: unknown;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduled_date: string;
  scheduled_start: string;
  total_price: number;
  total_amount_cents: number;
  estimated_duration_min: number;
  assigned_team: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  completed_at: string;
  notes: string;
  created_at: string;
  [key: string]: unknown;
}

interface Stats {
  contacts_total: number;
  contacts_loaded: number;
  contacts_with_email: number;
  contacts_with_bu: number;
  contacts_clients: number;
  contacts_leads: number;
  quotes_total: number;
  quotes_new: number;
  quotes_accepted: number;
  quotes_abandoned: number;
  quotes_pipeline: number;
  quotes_accepted_value: number;
  jobs_total: number;
  jobs_scheduled: number;
  jobs_completed: number;
  jobs_today: number;
}

/* ─── Helpers ─── */
function fmtMoney(v: number | null | undefined) {
  if (!v || v <= 0) return "$0";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateShort(iso: string | null) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  const today = new Date();
  const isThisYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
}

function isToday(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

const quoteStatusVariant: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  accepted: "success",
  new: "info",
  sent: "warning",
  pending: "warning",
  abandoned: "neutral",
  rejected: "critical",
  declined: "critical",
  expired: "critical",
  draft: "neutral",
};

const jobStatusVariant: Record<string, "neutral" | "info" | "success" | "critical" | "warning"> = {
  completed: "success",
  scheduled: "info",
  confirmed: "success",
  in_progress: "warning",
  cancelled: "critical",
};

/* ─── Page ─── */
export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeSection, setActiveSection] = useState<"quotes" | "jobs" | "contacts">("quotes");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/root/overview");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setQuotes(data.quotes || []);
      setJobs(data.jobs || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error("overview load:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ─── KPI Cards ─── */
  const kpiCards = stats
    ? [
        {
          label: "Pipeline Value",
          value: fmtMoney(stats.quotes_pipeline),
          sub: `${fmtMoney(stats.quotes_accepted_value)} accepted`,
          accent: "var(--at-green)",
          icon: "\uD83D\uDCC8",
        },
        {
          label: "Quotes Sent",
          value: String(stats.quotes_total),
          sub: `${stats.quotes_accepted} accepted \u00B7 ${stats.quotes_new} new`,
          accent: "var(--at-blue)",
          icon: "\uD83D\uDCCB",
        },
        {
          label: "Jobs Scheduled",
          value: String(stats.jobs_scheduled),
          sub: `${stats.jobs_completed} completed \u00B7 ${stats.jobs_total} total`,
          accent: "var(--at-blue)",
          icon: "\uD83D\uDCC5",
        },
        {
          label: "Active Contacts",
          value: stats.contacts_total.toLocaleString(),
          sub: `${stats.contacts_clients} clients \u00B7 ${stats.contacts_leads} leads`,
          accent: "var(--at-grey-500)",
          icon: "\uD83D\uDC65",
        },
        {
          label: "Today's Jobs",
          value: String(stats.jobs_today),
          sub: new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
          accent: stats.jobs_today > 0 ? "var(--at-green)" : "var(--at-grey-400)",
          icon: "\u2600\uFE0F",
        },
        {
          label: "Conversion Rate",
          value: stats.quotes_total > 0
            ? `${Math.round((stats.quotes_accepted / stats.quotes_total) * 100)}%`
            : "0%",
          sub: `${stats.quotes_accepted} of ${stats.quotes_total} quotes`,
          accent: stats.quotes_accepted > 0 ? "var(--at-green)" : "var(--at-yellow)",
          icon: "\uD83C\uDFAF",
        },
      ]
    : [];

  /* ─── Recent quotes (last 8) ─── */
  const recentQuotes = quotes.slice(0, 8);
  const recentJobs = jobs.slice(0, 8);
  const todaysJobs = jobs.filter((j) => isToday(j.scheduled_date));

  /* Quote columns */
  const quoteColumns = [
    {
      header: "Quote",
      accessorKey: "quote_number" as const,
      cell: (_: unknown, row: Quote) => (
        <Link href={`/root/quotes/${row.id}`} className="font-semibold text-[var(--at-green)] hover:underline">
          {row.quote_number || `Q-${String(row.id).slice(0, 6)}`}
        </Link>
      ),
    },
    {
      header: "Client",
      accessorKey: "client_name" as const,
      cell: (_: unknown, row: Quote) => (
        <div>
          <div className="font-medium text-[var(--at-text)]">{row.client_name || "\u2014"}</div>
          {row.service_type && (
            <div className="text-xs text-[var(--at-text-secondary)]">{row.service_type}</div>
          )}
        </div>
      ),
    },
    {
      header: "Amount",
      accessorKey: "estimated_total" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="font-semibold tabular-nums text-[var(--at-text)]">
          {fmtMoney(row.estimated_total)}
        </span>
      ),
    },
    {
      header: "BU",
      accessorKey: "business_unit" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="text-xs text-[var(--at-grey-500)] uppercase tracking-wide font-medium">
          {row.business_unit || "ACS"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status" as const,
      cell: (_: unknown, row: Quote) => {
        const s = row.status || "draft";
        return (
          <StatusLabel status={quoteStatusVariant[s] ?? "neutral"}>
            {s.replace(/_/g, " ")}
          </StatusLabel>
        );
      },
    },
    {
      header: "Created",
      accessorKey: "created_at" as const,
      cell: (_: unknown, row: Quote) => (
        <span className="text-sm text-[var(--at-text-secondary)]">{fmtDateShort(row.created_at)}</span>
      ),
    },
  ];

  /* Job columns */
  const jobColumns = [
    {
      header: "Client",
      accessorKey: "client_name" as const,
      cell: (_: unknown, row: Job) => (
        <div>
          <div className="font-medium text-[var(--at-text)]">
            {row.client_name || row.title || "Unassigned"}
            {isToday(row.scheduled_date) && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--at-green-lightest)] text-[var(--at-green)]">
                today
              </span>
            )}
          </div>
          {row.client_phone && (
            <div className="text-xs text-[var(--at-text-secondary)]">{row.client_phone}</div>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status" as const,
      cell: (_: unknown, row: Job) => {
        const s = row.status || "scheduled";
        return (
          <StatusLabel status={jobStatusVariant[s] ?? "neutral"}>
            {s.replace(/_/g, " ")}
          </StatusLabel>
        );
      },
    },
    {
      header: "Scheduled",
      accessorKey: "scheduled_date" as const,
      cell: (_: unknown, row: Job) => (
        <span className="text-sm text-[var(--at-text-secondary)] tabular-nums">
          {fmtDateShort(row.scheduled_date)}
        </span>
      ),
    },
    {
      header: "Team",
      accessorKey: "assigned_team" as const,
      cell: (_: unknown, row: Job) => (
        <span className="text-sm text-[var(--at-text-secondary)]">{row.assigned_team || "\u2014"}</span>
      ),
    },
    {
      header: "Amount",
      accessorKey: "total_price" as const,
      cell: (_: unknown, row: Job) => {
        const amt = Number(row.total_price) > 0
          ? fmtMoney(row.total_price)
          : row.total_amount_cents ? fmtMoney(row.total_amount_cents / 100) : "\u2014";
        return <span className="font-semibold tabular-nums text-[var(--at-text)]">{amt}</span>;
      },
    },
  ];

  /* Contact columns */
  const contactColumns = [
    {
      header: "Name",
      accessorKey: "full_name" as const,
      cell: (_: unknown, row: Contact) => (
        <div>
          <div className="font-medium text-[var(--at-text)]">{row.full_name || row.name || "\u2014"}</div>
          {row.contact_type && (
            <div className="text-xs text-[var(--at-text-secondary)]">
              {row.contact_type}{row.city ? ` \u00B7 ${row.city}` : ""}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Email",
      accessorKey: "email" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-sm text-[var(--at-text-secondary)]">{row.email || "\u2014"}</span>
      ),
    },
    {
      header: "Company",
      accessorKey: "company" as const,
      cell: (_: unknown, row: Contact) => (
        <span className="text-sm text-[var(--at-text)]">{row.company || "\u2014"}</span>
      ),
    },
    {
      header: "Priority",
      accessorKey: "priority_score" as const,
      cell: (_: unknown, row: Contact) => {
        const p = row.priority_score || 0;
        if (p <= 0) return <span className="text-[var(--at-text-secondary)]">{"\u2014"}</span>;
        const color =
          p >= 80 ? "var(--at-green)" :
          p >= 50 ? "var(--at-blue)" :
          p >= 20 ? "var(--at-yellow)" : "var(--at-grey-400)";
        return (
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
            {p}
          </span>
        );
      },
    },
  ];

  /* Section tabs for the data view */
  const sections = [
    { key: "quotes" as const, label: "Recent Quotes", count: quotes.length },
    { key: "jobs" as const, label: "Jobs", count: jobs.length },
    { key: "contacts" as const, label: "Top Contacts", count: contacts.length },
  ];

  return (
    <Page
      title="Dashboard"
      subtitle={
        stats
          ? `${stats.contacts_total.toLocaleString()} contacts \u00B7 ${stats.quotes_total} quotes \u00B7 ${stats.jobs_total} jobs`
          : "Loading overview..."
      }
      actions={
        <div className="flex items-center gap-2">
          <Link href="/root/quotes/new">
            <Button variant="primary" size="sm">+ New Quote</Button>
          </Link>
          <Link href="/root/invoices/new">
            <Button variant="secondary" size="sm">+ New Invoice</Button>
          </Link>
        </div>
      }
    >
      {/* KPI Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Card.Body>
                <div className="animate-pulse">
                  <div className="h-3 w-20 bg-[var(--at-grey-200)] rounded mb-2" />
                  <div className="h-7 w-16 bg-[var(--at-grey-200)] rounded mb-1" />
                  <div className="h-2.5 w-24 bg-[var(--at-grey-200)] rounded" />
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-4 mb-6">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} accent={kpi.accent}>
              <Card.Body>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-[var(--at-text-secondary)] uppercase tracking-wide font-medium">
                    {kpi.label}
                  </div>
                  <span className="text-sm">{kpi.icon}</span>
                </div>
                <div
                  className="text-2xl font-bold font-[var(--at-font-display)] tabular-nums leading-tight"
                  style={{ color: kpi.accent }}
                >
                  {kpi.value}
                </div>
                <div className="text-xs text-[var(--at-text-secondary)] mt-1">
                  {kpi.sub}
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {/* Today's Jobs callout */}
      {todaysJobs.length > 0 && (
        <Card accent="var(--at-green)" className="mb-6">
          <Card.Header
            title={`Today \u2014 ${todaysJobs.length} job${todaysJobs.length !== 1 ? "s" : ""} scheduled`}
            action={
              <Link href="/root/dispatch">
                <Button variant="secondary" size="sm">View Dispatch</Button>
              </Link>
            }
          />
          <DataTable<Job>
            columns={jobColumns}
            data={todaysJobs}
            emptyMessage="No jobs today."
          />
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/root/quotes/new">
          <Button variant="primary" size="sm">New Quote</Button>
        </Link>
        <Link href="/root/invoices/new">
          <Button variant="secondary" size="sm">New Invoice</Button>
        </Link>
        <Link href="/root/dispatch">
          <Button variant="secondary" size="sm">View Schedule</Button>
        </Link>
        <Link href="/root/contacts">
          <Button variant="secondary" size="sm">Contacts</Button>
        </Link>
        <Link href="/root/finance">
          <Button variant="secondary" size="sm">Finance</Button>
        </Link>
      </div>

      {/* Section tabs + data table */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--at-border)]">
        {sections.map((sec) => {
          const active = sec.key === activeSection;
          return (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={[
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-[var(--at-green)] text-[var(--at-green)]"
                  : "border-transparent text-[var(--at-text-secondary)] hover:text-[var(--at-text)] hover:border-[var(--at-grey-300)]",
              ].join(" ")}
            >
              {sec.label}
              <span
                className={[
                  "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                  active
                    ? "bg-[var(--at-green-lightest)] text-[var(--at-green)]"
                    : "bg-[var(--at-grey-200)] text-[var(--at-grey-500)]",
                ].join(" ")}
              >
                {sec.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        {activeSection === "quotes" && (
          <DataTable<Quote>
            columns={quoteColumns}
            data={recentQuotes}
            onRowClick={(row) => (window.location.href = `/root/quotes/${row.id}`)}
            emptyMessage="No quotes yet."
            loading={loading}
          />
        )}
        {activeSection === "jobs" && (
          <DataTable<Job>
            columns={jobColumns}
            data={recentJobs}
            emptyMessage="No jobs yet."
            loading={loading}
          />
        )}
        {activeSection === "contacts" && (
          <DataTable<Contact>
            columns={contactColumns}
            data={contacts.slice(0, 20)}
            emptyMessage="No contacts loaded."
            loading={loading}
          />
        )}
      </Card>

      {/* Footer count */}
      <div className="mt-3 text-xs text-[var(--at-text-secondary)] font-[var(--at-font)]">
        {activeSection === "quotes" && (
          <span>Showing {Math.min(recentQuotes.length, 8)} of {quotes.length} quotes</span>
        )}
        {activeSection === "jobs" && (
          <span>Showing {Math.min(recentJobs.length, 8)} of {jobs.length} jobs</span>
        )}
        {activeSection === "contacts" && (
          <span>Showing {Math.min(20, contacts.length)} of {contacts.length} contacts</span>
        )}
        {activeSection === "quotes" && quotes.length > 8 && (
          <Link href="/root/quotes" className="ml-3 text-[var(--at-green)] font-medium hover:underline">
            View all quotes
          </Link>
        )}
      </div>
    </Page>
  );
}
