import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";
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

export async function GET(req: Request, { params }: Props) {
  const { id } = await params;
  const limited = clientLinkRateLimit(req, "share/quote/[id]/comment");
  if (limited) return limited;
  if (!verifyClientLink(readClientLink(req), "quote", id)) return clientLinkNotFound("/api/share/quote/[id]/comment", id);
  const sb = getSupabase();
  const { data: quote } = await sb.from("quotes").select("id, business_unit")
    .eq("id", id).eq("business_unit", "CC").maybeSingle();
  if (!quote || quote.business_unit !== "CC") return clientLinkNotFound("/api/share/quote/[id]/comment", id);

  const { data: comments, error } = await sb
    .from("quote_comments")
    .select("id, sender, body, created_at")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    /* Table may not exist yet — return empty */
    return NextResponse.json({ comments: [] });
  }

  return NextResponse.json({ comments: (comments || []).map(row => ({ id: row.id, sender: row.sender, body: row.body, created_at: row.created_at })) });
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const limited = clientLinkRateLimit(req, "share/quote/[id]/comment");
  if (limited) return limited;
  if (!verifyClientLink(readClientLink(req), "quote", id)) return clientLinkNotFound("/api/share/quote/[id]/comment", id);


  const sb = getSupabase();
  const { data: quote } = await sb.from("quotes").select("id, business_unit")
    .eq("id", id).eq("business_unit", "CC").maybeSingle();
  if (!quote || quote.business_unit !== "CC") return clientLinkNotFound("/api/share/quote/[id]/comment", id);

  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = asNullableString(body.message);

  if (!message) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const { data: comment, error } = await sb
    .from("quote_comments")
    .insert({
      quote_id: id,
      sender: "client",
      body: message,
    })
    .select("id, sender, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comment: comment ? { id: comment.id, sender: comment.sender, body: comment.body, created_at: comment.created_at } : null }, { status: 201 });
}
