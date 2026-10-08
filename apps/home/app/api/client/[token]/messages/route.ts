import { clientLinkNotFound } from "@/lib/client-link-token";
import { isAcceptablePortalToken } from "@/lib/portal-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";
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
  if (!isAcceptablePortalToken(token)) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from("contacts")
    .select("id, business_unit")
    .eq("portal_token", token)
    .eq("business_unit", "CC")
    .maybeSingle();
  return data?.business_unit === "CC" ? data : null;
}

export async function GET(req: Request, { params }: Props) {
  const { token } = await params;
  const limited = clientLinkRateLimit(req, "client/portal-messages");
  if (limited) return limited;
  if (!isAcceptablePortalToken(token)) return clientLinkNotFound("/api/client/[token]/messages", token);
  const contact = await resolveContact(token);
  if (!contact) return clientLinkNotFound("/api/client/[token]/messages", token);

  const sb = getSupabase();
  const { data: messages } = await sb
    .from("client_messages")
    .select("id, sender, body, created_at")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({ messages: (messages || []).map(row => ({ id: row.id, sender: row.sender, body: row.body, created_at: row.created_at })) });
}

export async function POST(req: Request, { params }: Props) {
  const { token } = await params;
  const limited = clientLinkRateLimit(req, "client/portal-messages");
  if (limited) return limited;
  if (!isAcceptablePortalToken(token)) return clientLinkNotFound("/api/client/[token]/messages", token);
  const contact = await resolveContact(token);
  if (!contact) return clientLinkNotFound("/api/client/[token]/messages", token);

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
  for (const [table, associatedId] of [["quotes", quoteId], ["invoices", invoiceId]] as const) {
    if (!associatedId) continue;
    const { data: row } = await sb.from(table).select("id, business_unit")
      .eq("id", associatedId).eq("contact_id", contact.id).eq("business_unit", "CC").maybeSingle();
    if (!row || row.business_unit !== "CC") return clientLinkNotFound("/api/client/[token]/messages", token);
  }
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
    return NextResponse.json({ error: "message_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: msg ? { id: msg.id, sender: msg.sender, body: msg.body, created_at: msg.created_at } : null }, { status: 201 });
}
