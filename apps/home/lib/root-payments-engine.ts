/**
 * ROOT Payments Engine — FreshBooks-pattern payment ledger, reconciliation, recurring invoices.
 */

import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/root-event-log";
import type { RootBusinessScope } from "@/lib/root-request-scope";

// ─── Record Payment ───

export async function recordPayment(data: {
  invoice_id?: string;
  contact_id?: string;
  business_unit: string;
  amount_cents: number;
  currency?: string;
  method?: string;
  reference_number?: string;
  paid_at?: string;
}) {
  const sb = getSupabase();

  const { data: payment, error } = await sb
    .from("payments")
    .insert({
      business_unit: data.business_unit || "CC",
      invoice_id: data.invoice_id || null,
      contact_id: data.contact_id || null,
      amount_cents: data.amount_cents,
      currency: data.currency || "CAD",
      method: data.method || "manual",
      status: "completed",
      reference_number: data.reference_number || null,
      paid_at: data.paid_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { payment: null, error: error.message };

  // Also record in legacy invoice_payments table for backward compat
  if (data.invoice_id) {
    await sb.from("invoice_payments").insert({
      invoice_id: data.invoice_id,
      amount: data.amount_cents / 100,
      status: "completed",
      method: data.method || "manual",
      reference_number: data.reference_number || null,
    });

    // Update invoice balance
    await updateInvoiceBalance(data.invoice_id);
  }

  await emitTypedEvent({
    type: "payment.received",
    objectType: "payment",
    objectId: payment.id,
    businessUnit: (data.business_unit as "ACS" | "CC") || "CC",
    contactId: data.contact_id || null,
    text: `Payment of $${(data.amount_cents / 100).toFixed(2)} recorded`,
    payload: {
      amount_cents: data.amount_cents,
      method: data.method || "manual",
      invoice_id: data.invoice_id || null,
    },
  });

  return { payment, error: null };
}

// ─── Update Invoice Balance ───

async function updateInvoiceBalance(invoiceId: string) {
  const sb = getSupabase();

  const [{ data: invoice }, { data: payments }] = await Promise.all([
    sb.from("invoices").select("id, total, amount").eq("id", invoiceId).maybeSingle(),
    sb.from("payments").select("amount_cents").eq("invoice_id", invoiceId).eq("status", "completed"),
  ]);

  if (!invoice) return;

  const total = Number(invoice.total || invoice.amount || 0);
  const totalPaidCents = (payments || []).reduce((sum, p) => sum + Number(p.amount_cents || 0), 0);
  const totalPaid = totalPaidCents / 100;
  const balance = Math.max(total - totalPaid, 0);

  const paymentStatus = balance <= 0 && total > 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

  await sb.from("invoices").update({
    paid_amount: totalPaid,
    amount_paid: totalPaid,
    balance_due: balance,
    paid_amount_cents: totalPaidCents,
    balance_cents: Math.round(balance * 100),
    payment_status: paymentStatus,
    invoice_status: paymentStatus === "paid" ? "paid" : undefined,
  }).eq("id", invoiceId);

  if (paymentStatus === "paid") {
    await emitTypedEvent({
      type: "invoice.paid",
      objectType: "invoice",
      objectId: invoiceId,
      text: `Invoice fully paid — $${total.toFixed(2)}`,
      payload: { total, paid: totalPaid },
    });
  } else if (totalPaid > 0) {
    await emitTypedEvent({
      type: "invoice.partial_payment",
      objectType: "invoice",
      objectId: invoiceId,
      text: `Partial payment — $${totalPaid.toFixed(2)} of $${total.toFixed(2)}`,
      payload: { total, paid: totalPaid, balance },
    });
  }
}

// ─── Payment Ledger ───

export async function getPaymentLedger(
  scope: RootBusinessScope = null,
  options: { limit?: number; offset?: number; startDate?: string; endDate?: string } = {},
) {
  const sb = getSupabase();
  const { limit = 100, offset = 0, startDate, endDate } = options;

  let query = sb
    .from("payments")
    .select("*, contacts(id, full_name, name, email), invoices(id, invoice_number)")
    .order("paid_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (scope) query = query.eq("business_unit", scope);
  if (startDate) query = query.gte("paid_at", startDate);
  if (endDate) query = query.lte("paid_at", endDate);

  const { data, error, count } = await query;

  // Compute totals
  const payments = data || [];
  const totalCents = payments.reduce((sum, p) => sum + Number(p.amount_cents || 0), 0);

  return {
    payments,
    total_cents: totalCents,
    total_formatted: `$${(totalCents / 100).toFixed(2)}`,
    count: payments.length,
    error: error?.message || null,
  };
}

// ─── Payment Detail ───

export async function getPaymentById(id: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("payments")
    .select("*, contacts(id, full_name, name, email, phone), invoices(id, invoice_number, total, status)")
    .eq("id", id)
    .maybeSingle();

  return { payment: data, error: error?.message || null };
}

// ─── Recurring Invoice Processing ───

export async function processRecurringInvoices() {
  const sb = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data: dueInvoices } = await sb
    .from("invoices")
    .select("*")
    .not("recurrence_rule", "is", null)
    .lte("next_recurrence_date", today);

  if (!dueInvoices?.length) return { generated: 0 };

  let generated = 0;

  for (const invoice of dueInvoices) {
    // Clone invoice
    const { data: newInvoice } = await sb.from("invoices").insert({
      contact_id: invoice.contact_id,
      quote_id: invoice.quote_id,
      business_unit: invoice.business_unit,
      amount: invoice.amount,
      tax: invoice.tax,
      total: invoice.total,
      status: "draft",
      invoice_status: "draft",
      payment_status: "unpaid",
      client_name: invoice.client_name,
      client_email: invoice.client_email,
      client_phone: invoice.client_phone,
      notes: `Recurring from ${invoice.invoice_number || invoice.id.slice(0, 8)}`,
      line_items: invoice.line_items,
      recurrence_rule: invoice.recurrence_rule,
    }).select().single();

    if (newInvoice) {
      // Compute next recurrence date
      const nextDate = computeNextRecurrenceDate(invoice.next_recurrence_date, invoice.recurrence_rule);
      await sb.from("invoices").update({ next_recurrence_date: nextDate }).eq("id", invoice.id);

      await emitTypedEvent({
        type: "invoice.recurring_generated",
        objectType: "invoice",
        objectId: newInvoice.id,
        businessUnit: (invoice.business_unit as "ACS" | "CC") || "CC",
        text: `Recurring invoice generated from ${invoice.invoice_number || invoice.id.slice(0, 8)}`,
        payload: { source_invoice_id: invoice.id },
      });

      generated++;
    }
  }

  return { generated };
}

function computeNextRecurrenceDate(currentDate: string, rule: string): string {
  const date = new Date(currentDate);

  switch (rule) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "annually":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().split("T")[0];
}

// ─── Overdue Detection ───

export async function getOverdueInvoices(scope: RootBusinessScope = null) {
  const sb = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  let query = sb
    .from("invoices")
    .select("id, invoice_number, total, balance_due, due_date, due_at, payment_status, contact_id, client_name, client_email, business_unit")
    .neq("payment_status", "paid")
    .or(`due_date.lt.${today},due_at.lt.${new Date().toISOString()}`);

  if (scope) query = query.eq("business_unit", scope);

  const { data, error } = await query.order("due_date", { ascending: true });

  return { overdue: data || [], error: error?.message || null };
}

// ─── Catalog Items (DB-backed) ───

export async function getCatalogItems(scope: RootBusinessScope = null) {
  const sb = getSupabase();
  let query = sb.from("catalog_items").select("*").eq("is_active", true).order("name");

  if (scope) {
    query = query.or(`business_unit.eq.${scope},business_unit.eq.ALL`);
  }

  const { data, error } = await query;
  return { items: data || [], error: error?.message || null };
}

export async function upsertCatalogItem(data: {
  code: string;
  name: string;
  business_unit?: string;
  category?: string;
  unit_price_cents?: number;
  default_unit?: string;
  revenue_account_code?: string;
  cost_account_code?: string;
}) {
  const sb = getSupabase();
  const { data: item, error } = await sb
    .from("catalog_items")
    .upsert({
      code: data.code,
      name: data.name,
      business_unit: data.business_unit || "ALL",
      category: data.category || null,
      unit_price_cents: data.unit_price_cents || 0,
      default_unit: data.default_unit || "each",
      revenue_account_code: data.revenue_account_code || null,
      cost_account_code: data.cost_account_code || null,
      is_active: true,
    }, { onConflict: "code" })
    .select()
    .single();

  return { item, error: error?.message || null };
}
