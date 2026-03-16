import { NextResponse } from "next/server";
import { getPaymentById } from "@/lib/root-payments-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPaymentById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.payment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}
