import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/share/quote/[id]/comment — list comments
 * POST /api/share/quote/[id]/comment — add a client comment
 */

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const sb = getSupabase();

  const { data: comments, error } = await sb
    .from("quote_comments")
    .select("id, sender, body, created_at")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    /* Table may not exist yet — return empty */
    return NextResponse.json({ comments: [] });
  }

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const sb = getSupabase();

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { message, sender = "client" } = body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const { data: comment, error } = await sb
    .from("quote_comments")
    .insert({
      quote_id: id,
      sender: sender === "team" ? "team" : "client",
      body: message.trim(),
    })
    .select("id, sender, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
