import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getSupabase } from "@/lib/supabase";
import { readCommercialHandoffStatus, type CommercialReadClient } from "@/lib/cco-commercial-handoff-status";
/** Source-only reader. Runtime route admission and deployment remain owner-held. */
export async function GET(request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
    try {
        const access = await enforceRoutePolicy(createRoutePolicy({
            id: "cco.quotes.commercial_status.read", accessLevel: "internal",
            sessionPolicies: ["supabase_user", "operator_invite"],
            requiredPermissions: ["quote_read", "invoice_read"], tenantBoundary: "internal_workspace",
        }));
        if (!access.ok) {
            access.response.headers.set("Cache-Control", "private, no-store");
            return access.response;
        }
        // Admit only the exact CCO commercial host. A forwarded host cannot override
        // a conflicting authority; never use the permissive branding fallback here.
        const host = request.headers.get("host")?.toLowerCase();
        const forwarded = request.headers.get("x-forwarded-host")?.toLowerCase();
        const actor = access.actor;
        if (host !== "admin.contentco-op.com" || (forwarded && forwarded !== host) || actor.actorType !== "user" || actor.tenantBoundary !== "internal_workspace" || !["supabase_user", "operator_invite"].includes(actor.sessionPolicy) || !["platform_owner", "platform_admin", "ops_admin", "finance_admin"].includes(actor.role) || !actor.permissions.includes("quote_read") || !actor.permissions.includes("invoice_read"))
            return json({ error: "forbidden" }, 403);
        const { id } = await context.params;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
            return json({ error: "invalid_quote_id" }, 400);
        const status = await readCommercialHandoffStatus({ quoteId: id, access: { businessUnit: "CC", role: actor.role, permissions: actor.permissions } }, { sb: getSupabase() as unknown as CommercialReadClient });
        return json({ quoteId: id, status }, status.state === "not_found" ? 404 : status.state === "denied" ? 403 : status.state === "unavailable" ? 503 : 200);
    }
    catch {
        return json({ error: "commercial_status_unavailable" }, 503);
    }
}
