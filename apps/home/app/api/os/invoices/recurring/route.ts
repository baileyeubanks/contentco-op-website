import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { processRecurringInvoices } from "@/lib/os-payments-engine";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.invoices.recurring.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["invoice_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, business_unit, client_name, total, recurrence_rule, next_recurrence_date, due_date, created_at")
    .not("recurrence_rule", "is", null)
    .order("next_recurrence_date", { ascending: true })
    .limit(100);

  return NextResponse.json({
    schedules: data || [],
    error: error?.message || null,
  });
}

export async function POST(request: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.invoices.recurring.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["invoice_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "generate_now";

  if (action === "configure") {
    if (!body?.invoice_id || !body?.recurrence_rule || !body?.next_recurrence_date) {
      return NextResponse.json(
        { error: "invoice_id, recurrence_rule, and next_recurrence_date are required" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("invoices")
      .update({
        recurrence_rule: String(body.recurrence_rule),
        next_recurrence_date: String(body.next_recurrence_date),
      })
      .eq("id", String(body.invoice_id))
      .select("id, invoice_number, recurrence_rule, next_recurrence_date")
      .single();

    return NextResponse.json(
      error ? { error: error.message } : { ok: true, schedule: data },
      { status: error ? 500 : 200 },
    );
  }

  const result = await processRecurringInvoices();
  return NextResponse.json({ ok: true, ...result });
}
