import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/root/invoices/[id]/reminders
 * Logs a reminder and updates last_reminder_at on the invoice.
 * In production: queue an email via Resend / SendGrid here.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sb = getSupabase();

  // Fetch invoice to confirm it exists
  const { data: invoice, error: fetchErr } = await sb
    .from("invoices")
    .select("id, invoice_number, contact_email, client_email, business_unit")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Update last_reminder_at on the invoice
  const { error: updateErr } = await sb
    .from("invoices")
    .update({ last_reminder_at: now })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Log to events table (non-fatal if it fails)
  try {
    await sb.from("events").insert({
      type: "invoice_reminder_sent",
      business_id: null,
      payload: {
        invoice_id: id,
        invoice_number: invoice.invoice_number,
        sent_to: invoice.contact_email || invoice.client_email,
        sent_at: now,
      },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, sent_at: now });
}
