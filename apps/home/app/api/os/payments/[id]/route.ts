import { NextResponse } from "next/server";
import { getPaymentById } from "@/lib/os-payments-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.payment.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["finance_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await getPaymentById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.payment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}
