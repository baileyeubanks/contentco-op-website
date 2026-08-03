import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { recordPayment } from "@/lib/root-payments-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("payments")
    .select("*")
    .eq("invoice_id", id)
    .order("paid_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data || [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.amount_cents) return NextResponse.json({ error: "amount_cents required" }, { status: 400 });

  const result = await recordPayment({ ...body, invoice_id: id });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
