import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

type QuoteAcceptanceBody = {
  action?: unknown;
  signature_name?: unknown;
  agreement_sections?: unknown;
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
  const limited = clientLinkRateLimit(req, "share/quote/[id]/accept");
  if (limited) return limited;
  if (!verifyClientLink(readClientLink(req), "quote", id)) return clientLinkNotFound();


  const sb = getSupabase();

  const body = await parseBody(req);
  const action = asString(body.action, "accept");
  const signatureName = asNullableString(body.signature_name);
  const agreementSections = Array.isArray(body.agreement_sections)
    ? body.agreement_sections
        .filter((section): section is string => typeof section === "string")
        .map((section) => section.trim())
        .filter(Boolean)
    : [];
  const comment = asNullableString(body.comment);

  /* Fetch quote */
  const { data: quote, error } = await sb
    .from("quotes")
    .select("id, business_unit, client_name, client_status, internal_status")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (error || !quote || quote.business_unit !== "CC") return clientLinkNotFound();

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
      agreement_accepted: true,
      signature_name: signatureName,
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
      .eq("id", id)
    .eq("business_unit", "CC");

    /* If extended columns fail, fall back to just core fields */
    if (updateError) {
      const { error: fallbackError } = await sb
        .from("quotes")
        .update(updatePayload)
        .eq("id", id)
    .eq("business_unit", "CC");

      if (fallbackError) {
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
      }
    }

    if (signatureName && agreementSections.length > 0) {
      await sb.from("events").insert({
        type: "quote.agreement_accepted",
        payload: {
          quote_id: id,
          signature_name: signatureName,
          sections: agreementSections,
          ip_address: ip,
          timestamp: acceptedAt,
        },
      }).then(() => {});
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
      .eq("id", id)
    .eq("business_unit", "CC");

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
      .eq("id", id)
    .eq("business_unit", "CC");

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
