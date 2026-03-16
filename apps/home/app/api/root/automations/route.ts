import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getAutomationRules, createAutomationRule } from "@/lib/root-automation-engine";

export async function GET(req: Request) {
  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active_only") !== "false";

  const result = await getAutomationRules(scope, activeOnly);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || !body.trigger_event || !body.actions?.length) {
    return NextResponse.json({ error: "name, trigger_event, and actions required" }, { status: 400 });
  }

  const result = await createAutomationRule(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
