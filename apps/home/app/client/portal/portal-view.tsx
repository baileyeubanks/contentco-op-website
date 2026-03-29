"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@contentco-op/ui/src/atlantis/Card";
import { StatusLabel } from "@contentco-op/ui/src/atlantis/StatusLabel";
import { Button } from "@contentco-op/ui/src/atlantis/Button";

/* ---------- Types ---------- */

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  service_type: string;
  estimated_total: number;
  deposit_status: string;
  status: string;
  created_at: string;
}

export interface Job {
  id: string;
  service_address: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  crew_assigned: string;
  notes: string;
  total_amount_cents: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  payment_status: string;
  due_date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  quote_id: string;
  invoice_id: string;
  amount_cents: number;
  status: string;
  provider: string;
  created_at: string;
}

export interface PortalData {
  contact: Contact;
  quotes: Quote[];
  jobs: Job[];
  invoices: Invoice[];
  payments: Payment[];
}

/* ---------- Helpers ---------- */

function formatDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "$0.00";
  return formatCurrency(cents / 100);
}

type StatusType = "success" | "warning" | "critical" | "info" | "neutral";

function quoteStatusBadge(status: string): { label: string; variant: StatusType } {
  switch (status?.toLowerCase()) {
    case "accepted":
    case "approved":
      return { label: "Accepted", variant: "success" };
    case "pending":
    case "sent":
      return { label: "Pending", variant: "warning" };
    case "expired":
      return { label: "Expired", variant: "neutral" };
    case "declined":
    case "rejected":
      return { label: "Declined", variant: "critical" };
    default:
      return { label: status || "Unknown", variant: "neutral" };
  }
}

function jobStatusBadge(status: string): { label: string; variant: StatusType } {
  switch (status?.toLowerCase()) {
    case "completed":
      return { label: "Completed", variant: "success" };
    case "scheduled":
    case "confirmed":
      return { label: "Scheduled", variant: "info" };
    case "in_progress":
    case "in progress":
      return { label: "In Progress", variant: "warning" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelled", variant: "critical" };
    default:
      return { label: status || "Scheduled", variant: "info" };
  }
}

function invoiceStatusBadge(status: string): { label: string; variant: StatusType } {
  switch (status?.toLowerCase()) {
    case "paid":
      return { label: "Paid", variant: "success" };
    case "partial":
    case "partially_paid":
      return { label: "Partial", variant: "warning" };
    case "overdue":
    case "past_due":
      return { label: "Overdue", variant: "critical" };
    case "sent":
    case "pending":
    case "unpaid":
      return { label: "Unpaid", variant: "warning" };
    case "void":
      return { label: "Void", variant: "neutral" };
    default:
      return { label: status || "Pending", variant: "neutral" };
  }
}

/* ---------- Sub-components ---------- */

function EmailLookup({
  initialEmail,
}: {
  initialEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    router.push(`/client/portal?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <Card.Header title="Client Portal" />
          <Card.Body>
            <p className="text-sm text-gray-600 mb-4">
              Enter the email address associated with your account to view your
              quotes, appointments, and invoices.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="portal-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="portal-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <Button
                type="submit"
                fullWidth
                loading={loading}
              >
                View My Portal
              </Button>
            </form>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

function NotFound({ email }: { email: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Card>
          <Card.Body>
            <div className="py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                No account found
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                We couldn&apos;t find an account for <strong>{email}</strong>.
                Please check the email or contact us.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="secondary"
                  onClick={() => window.location.href = "/client/portal"}
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.href = "tel:+17275985314"}
                >
                  Call Us
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

function UpcomingAppointments({ jobs }: { jobs: Job[] }) {
  const now = new Date();
  const upcoming = jobs.filter(
    (j) =>
      j.scheduled_start &&
      new Date(j.scheduled_start) >= now &&
      j.status?.toLowerCase() !== "cancelled" &&
      j.status?.toLowerCase() !== "canceled",
  );

  return (
    <Card accent="var(--at-blue, #3B82F6)">
      <Card.Header
        title="Upcoming Appointments"
        action={
          <span className="text-xs text-gray-500">
            {upcoming.length} scheduled
          </span>
        }
      />
      <Card.Body className="p-0">
        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No upcoming appointments</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.slice(0, 5).map((job) => {
              const badge = jobStatusBadge(job.status);
              return (
                <li key={job.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {job.service_address || "Service appointment"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateTime(job.scheduled_start)}
                        {job.scheduled_end && (
                          <>
                            {" - "}
                            {new Date(job.scheduled_end).toLocaleTimeString(
                              "en-US",
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </>
                        )}
                      </p>
                      {job.crew_assigned && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Crew: {job.crew_assigned}
                        </p>
                      )}
                    </div>
                    <StatusLabel status={badge.variant}>{badge.label}</StatusLabel>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function RecentQuotes({ quotes }: { quotes: Quote[] }) {
  return (
    <Card>
      <Card.Header
        title="Recent Quotes"
        action={
          <span className="text-xs text-gray-500">
            {quotes.length} total
          </span>
        }
      />
      <Card.Body className="p-0">
        {quotes.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No quotes yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Quote #
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Service
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Total
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.slice(0, 10).map((q) => {
                  const badge = quoteStatusBadge(q.status);
                  return (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 font-medium">
                        {q.quote_number || "--"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {q.service_type || "--"}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-900">
                        {formatCurrency(q.estimated_total)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <StatusLabel status={badge.variant}>
                          {badge.label}
                        </StatusLabel>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

function InvoicesAndPayments({
  invoices,
  payments,
}: {
  invoices: Invoice[];
  payments: Payment[];
}) {
  const outstanding = invoices.filter(
    (i) =>
      i.payment_status?.toLowerCase() !== "paid" &&
      i.status?.toLowerCase() !== "void",
  );
  const totalOwed = outstanding.reduce(
    (sum, i) => sum + (i.balance_due ?? i.total ?? 0),
    0,
  );

  return (
    <Card accent={totalOwed > 0 ? "var(--at-yellow, #F59E0B)" : "var(--at-green, #10B981)"}>
      <Card.Header
        title="Invoices & Payments"
        action={
          totalOwed > 0 ? (
            <span className="text-xs font-semibold text-amber-600">
              {formatCurrency(totalOwed)} due
            </span>
          ) : (
            <span className="text-xs text-green-600 font-medium">All paid</span>
          )
        }
      />
      <Card.Body className="p-0">
        {invoices.length === 0 && payments.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No invoices or payments</p>
          </div>
        ) : (
          <>
            {/* Outstanding invoices */}
            {outstanding.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Outstanding
                </p>
                <ul className="space-y-2">
                  {outstanding.map((inv) => {
                    const badge = invoiceStatusBadge(
                      inv.payment_status || inv.status,
                    );
                    return (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {inv.invoice_number || "Invoice"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due {formatDate(inv.due_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(inv.balance_due ?? inv.total)}
                          </span>
                          <StatusLabel status={badge.variant}>
                            {badge.label}
                          </StatusLabel>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* All invoices table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Invoice
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Total
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Paid
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.slice(0, 10).map((inv) => {
                    const badge = invoiceStatusBadge(
                      inv.payment_status || inv.status,
                    );
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <p className="text-gray-900 font-medium">
                            {inv.invoice_number || "--"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(inv.created_at)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-900">
                          {formatCurrency(inv.total ?? inv.amount)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600">
                          {formatCurrency(inv.paid_amount)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <StatusLabel status={badge.variant}>
                            {badge.label}
                          </StatusLabel>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Payment History
                </p>
                <ul className="space-y-1.5">
                  {payments.slice(0, 8).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-gray-600">
                          {formatDate(p.created_at)}
                        </span>
                        {p.provider && (
                          <span className="text-xs text-gray-400 capitalize">
                            via {p.provider}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCents(p.amount_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card>
      <Card.Header title="Quick Actions" />
      <Card.Body>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="/client/quote"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-green-700">
                Request Quote
              </p>
              <p className="text-xs text-gray-500">Get a free estimate</p>
            </div>
          </a>

          <a
            href="tel:+17275985314"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                Contact Us
              </p>
              <p className="text-xs text-gray-500">Call or text</p>
            </div>
          </a>

          <a
            href="mailto:caio@astrocleanings.com?subject=Reschedule%20Request"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700">
                Reschedule
              </p>
              <p className="text-xs text-gray-500">Change appointment</p>
            </div>
          </a>
        </div>
      </Card.Body>
    </Card>
  );
}

/* ---------- Main Component ---------- */

interface PortalViewProps {
  data: PortalData | null;
  initialEmail: string;
}

export function PortalView({ data, initialEmail }: PortalViewProps) {
  // No data and no email = show lookup form
  if (!data && !initialEmail) {
    return <EmailLookup initialEmail="" />;
  }

  // Email was provided but no data found = not found
  if (!data && initialEmail) {
    return <NotFound email={initialEmail} />;
  }

  // We have data — show the dashboard
  const { contact, quotes, jobs, invoices, payments } = data!;
  const firstName = (contact.name || "").split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s an overview of your account with Astro Cleaning Services.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{quotes.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Quotes</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {jobs.filter(
              (j) =>
                j.scheduled_start &&
                new Date(j.scheduled_start) >= new Date() &&
                j.status?.toLowerCase() !== "cancelled",
            ).length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Upcoming</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Invoices</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Payments</p>
        </div>
      </div>

      {/* Upcoming appointments */}
      <UpcomingAppointments jobs={jobs} />

      {/* Recent quotes */}
      <RecentQuotes quotes={quotes} />

      {/* Invoices & payments */}
      <InvoicesAndPayments invoices={invoices} payments={payments} />

      {/* Quick actions */}
      <QuickActions />

      {/* Account info footer */}
      <div className="text-center text-xs text-gray-400 pt-4">
        <p>
          Logged in as <strong>{contact.email}</strong>
        </p>
        <button
          onClick={() => window.location.href = "/client/portal"}
          className="text-gray-400 hover:text-gray-600 underline mt-1"
        >
          Switch account
        </button>
      </div>
    </div>
  );
}
