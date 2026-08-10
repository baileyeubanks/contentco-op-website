import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyShareToken } from "@/lib/share-token";

interface Props {
  params: Promise<{ id: string }>;
}

type QuoteAcceptanceBody = {
  action?: unknown;
  signature_name?: unknown;
  comment?: unknown;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNullableString(value: unknown) {
  const normalized = asString(value).trim();
  return normalized || null;
}

async function parseBody(req: Request): Promise<QuoteAcceptanceBody> {
  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as QuoteAcceptanceBody;
  }
  return {};
}

/**
 * POST /api/share/quote/[id]/accept
 *
 * Client-facing acceptance endpoint. Records ESIGN-compliant acceptance
 * with timestamp, IP, user-agent, and optional signature data.
 * Requires a valid, unexpired share token (?token= or x-share-token header)
 * issued by the /share/quote/[id] page.
 */
export async function POST(req: Request, { params }: Props) {
  const { id } = await params;

  /* Token gate — fail closed before touching the database */
  const token =
    new URL(req.url).searchParams.get("token") || req.headers.get("x-share-token");
  if (!verifyShareToken(token, id)) {
    return NextResponse.json({ error: "invalid_share_token" }, { status: 401 });
  }

  const sb = getSupabase();

  const body = await parseBody(req);
  const action = asString(body.action, "accept");
  const signatureName = asNullableString(body.signature_name);
  const comment = asNullableString(body.comment);

  /* Fetch quote */
  const { data: quote, error } = await sb
    .from("quotes")
    .select("id, client_name, client_email, client_status, internal_status")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  /* Capture ESIGN compliance data */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const acceptedAt = new Date().toISOString();
  const signerName = signatureName || quote.client_name || "Client";

  if (action === "accept") {
    /* Build update payload — core fields first */
    const updatePayload: Record<string, unknown> = {
      client_status: "accepted",
      internal_status:
        String(quote.internal_status || "").toLowerCase() === "accepted"
          ? quote.internal_status
          : "accepted",
    };

    /* Try extended columns (may not exist until migration runs) */
    const { error: updateError } = await sb
      .from("quotes")
      .update({
        ...updatePayload,
        accepted_at: acceptedAt,
        accepted_by_name: signerName,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
        acceptance_method: signatureName ? "signature" : "click",
      })
      .eq("id", id);

    /* If extended columns fail, fall back to just core fields */
    if (updateError) {
      const { error: fallbackError } = await sb
        .from("quotes")
        .update(updatePayload)
        .eq("id", id);

      if (fallbackError) {
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      action: "accepted",
      accepted_at: acceptedAt,
      signer: signerName,
    });
  }

  if (action === "reject") {
    const { error: updateError } = await sb
      .from("quotes")
      .update({
        client_status: "rejected",
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "rejected" });
  }

  if (action === "request_changes") {
    const { error: updateError } = await sb
      .from("quotes")
      .update({
        client_status: "changes_requested",
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    /* Store the comment if provided */
      if (comment) {
        await sb.from("quote_comments").insert({
          quote_id: id,
          sender: "client",
          body: comment,
        }).then(() => {});
    }

    return NextResponse.json({ ok: true, action: "changes_requested" });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
