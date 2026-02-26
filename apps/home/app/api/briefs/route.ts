import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contact_name, contact_email } = body;
  if (!contact_name || !contact_email) {
    return NextResponse.json(
      { error: "contact_name and contact_email are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("creative_briefs")
    .insert({
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      phone: body.phone || null,
      company: body.company || null,
      role: body.role || null,
      location: body.location || null,
      content_type: body.content_type || null,
      deliverables: body.deliverables || null,
      audience: body.audience || null,
      tone: body.tone || null,
      deadline: body.deadline || null,
      objective: body.objective || null,
      key_messages: body.key_messages || null,
      references: body.references || null,
    })
    .select("id, access_token, status, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json(
      { error: "Failed to save brief" },
      { status: 500 }
    );
  }

  // Insert into events table → netlify_event_bridge routes to main + cc-worker (non-fatal)
  try {
    await supabase.from("events").insert({
      type: "brief_submitted",
      payload: {
        brief_id: data.id,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        phone: body.phone || null,
        location: body.location || null,
        company: body.company || null,
        content_type: body.content_type || null,
        deliverables: body.deliverables || null,
        deadline: body.deadline || null,
        objective: body.objective || null,
        portal_url: `/portal/${data.id}?token=${data.access_token}`,
      },
    });
  } catch {
    // non-fatal — event bridge notification only
  }

  return NextResponse.json({
    id: data.id,
    access_token: data.access_token,
    status: data.status,
    created_at: data.created_at,
  });
}
