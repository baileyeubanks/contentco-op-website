import { NextResponse } from "next/server";
import { getCcoOsDatabase } from "@/lib/cco-public-intake";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

type NotificationLogQuery = {
  select(columns: string): NotificationLogQuery;
  eq(column: string, value: unknown): NotificationLogQuery;
  order(column: string, options: { ascending: boolean }): NotificationLogQuery;
  limit(value: number): NotificationLogQuery;
};

type NotificationLogDatabase = {
  from(table: "notification_log"): NotificationLogQuery;
};

const OPERATOR_NOTIFICATION_FIELDS = [
  "id",
  "recipient",
  "channel",
  "status",
  "message_preview",
  "created_at",
  "template_key",
  "audience",
  "sent_at",
  "error_message",
  "related_entity_type",
  "related_entity_id",
].join(", ");

/**
 * GET /api/operations/notifications — Recent notification log.
 * Query params: channel, status, limit
 */
export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.notifications.operator.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const binding = getCcoOsDatabase();
  if (!binding.ok) {
    return NextResponse.json(
      { error: "cco_persistence_unavailable", code: binding.error, retryable: true },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");
  const requestedLimit = Number(searchParams.get("limit") || 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 200)
    : 50;

  // CCO public intake writes PII-bearing notification bodies. This endpoint is
  // intentionally operator-only, CCO-DB-bound, and selects only dashboard-safe
  // fields rather than exposing raw bodies or metadata through a service role.
  let query = (binding.db as unknown as NotificationLogDatabase)
    .from("notification_log")
    .select(OPERATOR_NOTIFICATION_FIELDS)
    .eq("business_unit", "CC");

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const result = await (query.order("created_at", { ascending: false }).limit(limit) as unknown as Promise<{
    data: Record<string, unknown>[] | null;
    error: { message?: string | null } | null;
  }>);
  const { data, error } = result;

  if (error) {
    return NextResponse.json({ error: "notification_lookup_failed", retryable: true }, { status: 503 });
  }

  return NextResponse.json({ notifications: data || [] });
}
