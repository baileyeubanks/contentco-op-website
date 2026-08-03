import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/root/invoices/[id]/split
 * Creates a split invoice linked to the parent.
 * Body: { split_label: string, split_percent: number }
 *
 * The new invoice inherits client info from the parent but
 * gets its own doc number and amount = parent.total * (split_percent / 100).
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: parentId } = await context.params;
  const sb = getSupabase();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { split_label = "2nd HALF", split_percent = 50 } = body as Record<string, unknown>;
  const pct = Number(split_percent);

  if (!pct || pct <= 0 || pct > 100) {
    return NextResponse.json({ error: "split_percent must be 1–100" }, { status: 400 });
  }

  // Fetch parent invoice
  const { data: parent, error: parentErr } = await sb
    .from("invoices")
    .select("*")
    .eq("id", parentId)
    .maybeSingle();

  if (parentErr || !parent) {
    return NextResponse.json({ error: "parent_invoice_not_found" }, { status: 404 });
  }

  const parentTotal = Number(parent.total || parent.amount || 0);
  const splitAmount = parseFloat((parentTotal * (pct / 100)).toFixed(2));
  const bu = String(parent.business_unit || "CC").toUpperCase();

  // Allocate doc number for split invoice
  let invoiceNumber: string | null = null;
  try {
    const { data: seqData } = await sb.rpc("next_doc_number", {
      p_business_unit: bu,
      p_doc_type: "invoice",
    });
    if (seqData) invoiceNumber = seqData;
  } catch { /* fallback to null */ }

  // Insert split invoice
  const { data: newInvoice, error: insertErr } = await sb
    .from("invoices")
    .insert({
      // Inherit client + BU from parent
      contact_id:       parent.contact_id       || null,
      business_id:      parent.business_id      || null,
      business_unit:    bu,
      invoice_number:   invoiceNumber,
      // Split-specific fields
      parent_invoice_id: parentId,
      split_label:      String(split_label),
      split_percent:    pct,
      // Financial
      total:            splitAmount,
      amount:           splitAmount,
      balance_due:      splitAmount,
      // Client info
      client_name:      parent.client_name       || null,
      client_email:     parent.client_email      || null,
      client_phone:     parent.client_phone      || null,
      // Status
      invoice_status:   "draft",
      payment_status:   "unpaid",
      status:           "draft",
      // Dates
      issue_date:       new Date().toISOString().slice(0, 10),
      due_date:         parent.due_date          || null,
      notes:            `Split from ${parent.invoice_number || parentId.slice(0, 8).toUpperCase()} — ${split_label} (${pct}%)`,
    })
    .select("id, invoice_number, total, invoice_status")
    .single();

  if (insertErr || !newInvoice) {
    return NextResponse.json({ error: insertErr?.message || "insert_failed" }, { status: 500 });
  }

  // Fire event (non-fatal)
  try {
    await sb.from("events").insert({
      type: "invoice_split_created",
      payload: {
        parent_invoice_id: parentId,
        split_invoice_id:  newInvoice.id,
        split_label,
        split_percent:     pct,
        split_amount:      splitAmount,
      },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, invoice: newInvoice });
}
