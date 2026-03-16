import { NextResponse } from "next/server";
import { getAutomationRuleById, updateAutomationRule } from "@/lib/root-automation-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAutomationRuleById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.rule) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = await updateAutomationRule(id, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
