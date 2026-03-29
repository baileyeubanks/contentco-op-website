/**
 * Invoice Reminder Engine
 *
 * Evaluates all outstanding invoices and determines which need reminders.
 * Cadence follows HouseCall Pro pattern:
 *   - 3 days before due (pre_due)
 *   - Due day (due)
 *   - 7 days overdue (overdue_7)
 *   - 14 days overdue (overdue_14)
 *   - 30 days overdue (overdue_30)
 *   - 60 days overdue (overdue_60)
 */

import { getSupabase } from "@/lib/supabase";
import { sendInvoiceReminder } from "@/lib/email-sender";

export type ReminderStage = "pre_due" | "due" | "overdue_7" | "overdue_14" | "overdue_30" | "overdue_60";

interface InvoiceForReminder {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  total: number;
  balance_due: number;
  due_date: string;
  business_unit: string;
  reminder_count: number;
  last_reminder_at: string | null;
}

/**
 * Determine which reminder stage an invoice is in based on days relative to due date.
 */
function getReminderStage(daysSinceDue: number): ReminderStage | null {
  if (daysSinceDue >= 60) return "overdue_60";
  if (daysSinceDue >= 30) return "overdue_30";
  if (daysSinceDue >= 14) return "overdue_14";
  if (daysSinceDue >= 7) return "overdue_7";
  if (daysSinceDue >= 0) return "due";
  if (daysSinceDue >= -3) return "pre_due";
  return null; // Too early for any reminder
}

/**
 * Check if enough time has passed since the last reminder to send another.
 * Minimum gap: 3 days between reminders.
 */
function shouldSendReminder(lastReminderAt: string | null): boolean {
  if (!lastReminderAt) return true;
  const last = new Date(lastReminderAt).getTime();
  const daysSinceLastReminder = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return daysSinceLastReminder >= 3;
}

/**
 * Evaluate all outstanding invoices and send reminders where needed.
 * Returns a summary of actions taken.
 */
export async function evaluateAndSendReminders(): Promise<{
  evaluated: number;
  sent: number;
  skipped: number;
  errors: number;
  details: { invoice_id: string; stage: string; result: string }[];
}> {
  const sb = getSupabase();
  const now = new Date();
  const summary = { evaluated: 0, sent: 0, skipped: 0, errors: 0, details: [] as any[] };

  /* Fetch all issued/sent invoices that aren't fully paid */
  const { data: invoices, error } = await sb
    .from("invoices")
    .select("id, invoice_number, client_name, client_email, total, balance_due, due_date, due_at, business_unit, reminder_count, last_reminder_at, payment_status, status")
    .not("payment_status", "eq", "paid")
    .in("status", ["issued", "sent", "draft"]);

  if (error || !invoices) {
    console.error("[reminder-engine] Failed to fetch invoices:", error);
    return summary;
  }

  for (const inv of invoices) {
    summary.evaluated++;

    /* Skip if no email */
    if (!inv.client_email) {
      summary.skipped++;
      summary.details.push({ invoice_id: inv.id, stage: "n/a", result: "no_email" });
      continue;
    }

    /* Calculate days since due */
    const dueStr = inv.due_date || inv.due_at;
    if (!dueStr) {
      summary.skipped++;
      continue;
    }

    const dueDate = new Date(dueStr);
    const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const stage = getReminderStage(daysSinceDue);

    if (!stage) {
      summary.skipped++;
      continue;
    }

    /* Check cooldown */
    if (!shouldSendReminder(inv.last_reminder_at)) {
      summary.skipped++;
      summary.details.push({ invoice_id: inv.id, stage, result: "cooldown" });
      continue;
    }

    /* Send reminder */
    const result = await sendInvoiceReminder(
      {
        id: inv.id,
        invoice_number: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
        client_name: inv.client_name || "Client",
        client_email: inv.client_email,
        total: Number(inv.total || 0),
        balance_due: Number(inv.balance_due || inv.total || 0),
        due_date: dueStr,
        business_unit: inv.business_unit || "ACS",
      },
      stage,
    );

    if (result.ok) {
      summary.sent++;
      summary.details.push({ invoice_id: inv.id, stage, result: "sent" });

      /* Update invoice reminder tracking */
      await sb
        .from("invoices")
        .update({
          reminder_count: (inv.reminder_count || 0) + 1,
          last_reminder_at: now.toISOString(),
          reminder_status: "sent",
        })
        .eq("id", inv.id);
    } else {
      summary.errors++;
      summary.details.push({ invoice_id: inv.id, stage, result: `error: ${result.error}` });
    }
  }

  return summary;
}
