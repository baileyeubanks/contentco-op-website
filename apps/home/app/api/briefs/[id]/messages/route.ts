import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function verifyToken(briefId: string, token: string | null) {
  if (!token) return false;
  const { data } = await supabase
    .from("creative_briefs")
    .select("id")
    .eq("id", briefId)
    .eq("access_token", token)
    .single();
  return !!data;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!(await verifyToken(id, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("brief_messages")
    .select("*")
    .eq("brief_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!(await verifyToken(id, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { body: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("brief_messages")
    .insert({
      brief_id: id,
      // A public portal capability may only create client-authored messages.
      // Team messages are an internal operator action and must not be selected
      // by a caller-controlled request body.
      sender: "client",
      body: body.body.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  // Notify cc-worker when client sends a message (non-fatal)
  try {
    await supabase.from("events").insert({
      type: "brief_message_from_client",
      payload: {
        brief_id: id,
        message_preview: body.body.trim().slice(0, 300),
      },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ message: data });
}
