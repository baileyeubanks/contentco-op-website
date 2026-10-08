import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getSupabase } from "@/lib/supabase";
import { buildClientLinkUrl, clientLinkNotFound } from "@/lib/client-link-token";
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(createRoutePolicy({
    id: "cco.quotes.share_link", accessLevel: "internal", sessionPolicies: ["supabase_user", "operator_invite"],
    requiredPermissions: ["quote_manage"], tenantBoundary: "internal_workspace",
  }));
  if (!access.ok) return access.response;
  const { id } = await params;
  const { data: row } = await getSupabase().from("quotes").select("id, business_unit")
    .eq("id", id).eq("business_unit", "CC").maybeSingle();
  if (!row || row.business_unit !== "CC") return clientLinkNotFound();
  const url = buildClientLinkUrl("quote", id);
  return url ? NextResponse.json({ share_link_url: url }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "share_link_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
