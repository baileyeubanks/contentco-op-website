import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

type QuoteCommentBody = {
  message?: unknown;
  sender?: unknown;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNullableString(value: unknown) {
  const normalized = asString(value).trim();
  return normalized || null;
}

async function parseBody(req: Request): Promise<QuoteCommentBody | null> {
  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as QuoteCommentBody;
  }
  return null;
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

  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = asNullableString(body.message);
  const sender = asString(body.sender, "client");

  if (!message) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const { data: comment, error } = await sb
    .from("quote_comments")
    .insert({
      quote_id: id,
      sender: sender === "team" ? "team" : "client",
      body: message,
    })
    .select("id, sender, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
