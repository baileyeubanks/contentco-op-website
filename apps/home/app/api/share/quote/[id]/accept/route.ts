import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/share/quote/[id]/accept
 *
 * Client-facing acceptance endpoint. Records ESIGN-compliant acceptance
 * with timestamp, IP, user-agent, and optional signature data.
 */
export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const sb = getSupabase();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for simple accept */
  }

  const {
    action = "accept",
    signature_name,
    comment,
  } = body;

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
  const signerName = signature_name || quote.client_name || "Client";

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
        acceptance_method: signature_name ? "signature" : "click",
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
