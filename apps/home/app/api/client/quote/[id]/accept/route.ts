import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/client/quote/[id]/accept
 *
 * Records that the client has accepted the service agreement.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: {
    signature_name?: string;
    agreement_sections?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const signatureName = body.signature_name?.trim();
  if (!signatureName || signatureName.length < 2) {
    return NextResponse.json(
      { error: "signature_name is required (min 2 characters)" },
      { status: 400 }
    );
  }

  const sections = body.agreement_sections;
  if (!Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json(
      { error: "agreement_sections is required" },
      { status: 400 }
    );
  }

  const sb = getSupabase();

  /* Verify quote exists */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, status, agreement_accepted")
    .eq("id", id)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  /* Get client IP for audit trail */
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  /* Update quote with agreement data */
  const now = new Date().toISOString();
  const { error: updateError } = await sb
    .from("quotes")
    .update({
      agreement_accepted: true,
      signature_name: signatureName,
      status: quote.status === "draft" ? "sent" : quote.status,
      payload: {
        agreement_data: {
          accepted_at: now,
          signature_name: signatureName,
          sections_accepted: sections,
          ip_address: ip,
          user_agent: req.headers.get("user-agent") ?? "unknown",
        },
      },
    })
    .eq("id", id);

  if (updateError) {
    console.error("[client/quote/accept]", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  /* Log event */
  await sb
    .from("events")
    .insert({
      type: "quote.agreement_accepted",
      payload: {
        quote_id: id,
        signature_name: signatureName,
        sections: sections,
        ip_address: ip,
        timestamp: now,
      },
    })
    .then(() => {});

  return NextResponse.json({ ok: true, accepted_at: now });
}
