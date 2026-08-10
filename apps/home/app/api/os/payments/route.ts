import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { getPaymentLedger, recordPayment } from "@/lib/os-payments-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.payments.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["finance_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

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
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.payments.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["payment_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await req.json();
  if (!body.amount_cents) return NextResponse.json({ error: "amount_cents required" }, { status: 400 });

  const result = await recordPayment(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
