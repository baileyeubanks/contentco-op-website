import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRootInvoiceDetail } from "@/lib/root-data";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await getRootInvoiceDetail(id, getRootBusinessScopeFromRequest(req));
  if (result.error) {
    return NextResponse.json(result, { status: result.invoice ? 500 : 404 });
  }
  return NextResponse.json({
    ...result,
    invoice: result.invoice
      ? {
          ...result.invoice,
          document_readiness: result.invoice.line_items.length > 0 ? "preview_ready" : "not_ready",
          preview_url: `/api/root/invoices/${result.invoice.id}/preview`,
          pdf_url: `/api/root/invoices/${result.invoice.id}/pdf`,
          payment_link_url: result.invoice.stripe_payment_link || null,
          share_link_url: result.invoice.stripe_payment_link || `/share/invoice/${result.invoice.id}`,
          artifact_version: result.invoice.id.slice(0, 8).toUpperCase(),
        }
      : null,
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await sb
    .from("invoices")
    .select("id,business_unit")
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const invoiceScope = String(existing.business_unit || "").trim().toUpperCase();
  if (scope && invoiceScope !== scope) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (typeof body.due_date === "string") {
    patch.due_date = body.due_date;
    patch.due_at = body.due_date;
  }

  const { error } = await sb.from("invoices").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return GET(req, context);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();

  const { data: existing, error: existingError } = await sb
    .from("invoices")
    .select("id,business_unit")
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const invoiceScope = String(existing.business_unit || "").trim().toUpperCase();
  if (scope && invoiceScope !== scope) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const { error } = await sb.from("invoices").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
