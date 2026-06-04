import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ token: string }>;
}

type ClientMessageRequestBody = {
  message?: unknown;
  quote_id?: unknown;
  invoice_id?: unknown;
};

function asNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

/**
 * GET /api/client/[token]/messages — list messages for this contact
 * POST /api/client/[token]/messages — send a message from the client
 */

async function resolveContact(token: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from("contacts")
    .select("id")
    .eq("portal_token", token)
    .maybeSingle();
  return data;
}

export async function GET(_req: Request, { params }: Props) {
  const { token } = await params;
  const contact = await resolveContact(token);
  if (!contact) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const sb = getSupabase();
  const { data: messages } = await sb
    .from("client_messages")
    .select("id, contact_id, quote_id, invoice_id, sender, body, created_at")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({ messages: messages || [] });
}

export async function POST(req: Request, { params }: Props) {
  const { token } = await params;
  const contact = await resolveContact(token);
  if (!contact) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const body = await req.json().catch(() => null) as ClientMessageRequestBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = asNullableString(body.message);
  const quoteId = asNullableString(body.quote_id);
  const invoiceId = asNullableString(body.invoice_id);
  if (!message) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: msg, error } = await sb
    .from("client_messages")
    .insert({
      contact_id: contact.id,
      quote_id: quoteId,
      invoice_id: invoiceId,
      sender: "client",
      body: message,
    })
    .select("id, sender, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: msg }, { status: 201 });
}
