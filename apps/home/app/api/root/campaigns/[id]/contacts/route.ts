import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/root-event-log";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("campaign_contacts")
    .select("*, contacts(id, full_name, name, email, phone, lead_score, lead_status)")
    .eq("campaign_id", id)
    .order("enrolled_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data || [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const contactIds: string[] = Array.isArray(body.contact_ids) ? body.contact_ids : body.contact_id ? [body.contact_id] : [];

  if (!contactIds.length) return NextResponse.json({ error: "contact_ids required" }, { status: 400 });

  const sb = getSupabase();
  const inserts = contactIds.map((contactId) => ({
    campaign_id: id,
    contact_id: contactId,
    status: "enrolled",
  }));

  const { data, error } = await sb.from("campaign_contacts").upsert(inserts, { onConflict: "campaign_id,contact_id" }).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const contactId of contactIds) {
    await emitTypedEvent({
      type: "campaign.contact_enrolled",
      objectType: "campaign",
      objectId: id,
      contactId,
      text: `Contact enrolled in campaign`,
    });
  }

  return NextResponse.json({ enrolled: data || [] }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.contact_id) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  const sb = getSupabase();
  await sb.from("campaign_contacts")
    .update({ status: "opted_out" })
    .eq("campaign_id", id)
    .eq("contact_id", body.contact_id);

  await emitTypedEvent({
    type: "campaign.contact_opted_out",
    objectType: "campaign",
    objectId: id,
    contactId: body.contact_id,
    text: `Contact opted out of campaign`,
  });

  return NextResponse.json({ ok: true });
}
