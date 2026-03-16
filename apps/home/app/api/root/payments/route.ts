import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getPaymentLedger, recordPayment } from "@/lib/root-payments-engine";

export async function GET(req: Request) {
  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
  const startDate = searchParams.get("start_date") || undefined;
  const endDate = searchParams.get("end_date") || undefined;

  const result = await getPaymentLedger(scope, { limit, startDate, endDate });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.amount_cents) return NextResponse.json({ error: "amount_cents required" }, { status: 400 });

  const result = await recordPayment(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
