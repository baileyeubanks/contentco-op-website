import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { emitTypedEvent } from "@/lib/root-event-log";

export async function GET(req: Request) {
  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const sb = getSupabase();
  let query = sb.from("campaigns").select("*, campaign_contacts(count)").order("created_at", { ascending: false }).limit(limit);

  if (scope) query = query.eq("business_unit", scope);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const sb = getSupabase();
  const { data: campaign, error } = await sb
    .from("campaigns")
    .insert({
      business_unit: body.business_unit || "CC",
      title: body.title,
      campaign_type: body.campaign_type || "outbound",
      status: "draft",
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      budget_cents: body.budget_cents || 0,
      channels: body.channels || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitTypedEvent({
    type: "campaign.created",
    objectType: "campaign",
    objectId: campaign.id,
    businessUnit: (body.business_unit as "ACS" | "CC") || "CC",
    text: `Campaign "${body.title}" created`,
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
