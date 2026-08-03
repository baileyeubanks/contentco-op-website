import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

interface Props {
  params: Promise<{ id: string }>;
}

function addDays(input: string | null | undefined, days: number) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();

  const { data: invoice, error } = await sb
    .from("invoices")
    .select("id,invoice_number,business_unit,business_id,quote_id,contact_id,amount,tax,total,status,due_at,due_date,notes,line_items")
    .eq("id", id)
    .maybeSingle();

  if (error || !invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const invoiceScope = String(invoice.business_unit || "").trim().toUpperCase();
  if (scope && invoiceScope !== scope) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const { data: duplicated, error: insertError } = await sb
    .from("invoices")
    .insert({
      business_unit: scope || invoice.business_unit,
      business_id: invoice.business_id,
      quote_id: invoice.quote_id,
      contact_id: invoice.contact_id,
      amount: invoice.amount,
      tax: invoice.tax,
      total: invoice.total,
      status: "draft",
      due_at: addDays(String(invoice.due_at || invoice.due_date || ""), 7),
      due_date: addDays(String(invoice.due_date || invoice.due_at || ""), 7),
      notes: invoice.notes ? `Copy of ${invoice.invoice_number || id.slice(0, 8)}. ${invoice.notes}` : `Copy of ${invoice.invoice_number || id.slice(0, 8)}`,
      line_items: Array.isArray(invoice.line_items) ? invoice.line_items : [],
      stripe_payment_link: null,
      reminder_count: 0,
    })
    .select("id,invoice_number")
    .single();

  if (insertError || !duplicated) {
    return NextResponse.json({ error: insertError?.message || "duplicate_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoice: duplicated });
}
