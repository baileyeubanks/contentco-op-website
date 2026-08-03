import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/root-event-log";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  const [{ data: campaign, error }, { data: contacts }] = await Promise.all([
    sb.from("campaigns").select("*").eq("id", id).maybeSingle(),
    sb.from("campaign_contacts")
      .select("*, contacts(id, full_name, name, email, lead_score)")
      .eq("campaign_id", id)
      .order("enrolled_at", { ascending: false }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ campaign, enrolled_contacts: contacts || [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sb = getSupabase();

  const { data: campaign, error } = await sb.from("campaigns").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "active") {
    await emitTypedEvent({
      type: "campaign.launched",
      objectType: "campaign",
      objectId: id,
      businessUnit: (campaign.business_unit as "ACS" | "CC") || "CC",
      text: `Campaign "${campaign.title}" launched`,
    });
  }

  return NextResponse.json({ campaign });
}
