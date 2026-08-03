import { NextResponse } from "next/server";
import { testAutomationRule } from "@/lib/os-automation-engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const result = await testAutomationRule(id, body.payload || body);
  return NextResponse.json(result);
}
