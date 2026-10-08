import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/share/quote/[id]/view
 *
 * Tracks when a client views a shared quote. Updates client_status to "viewed"
 * if it hasn't been accepted/rejected yet.
 */
export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const limited = clientLinkRateLimit(req, "share/quote/[id]/view");
  if (limited) return limited;
  if (!verifyClientLink(readClientLink(req), "quote", id)) return clientLinkNotFound();
  const sb = getSupabase();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  /* Only advance to "viewed" if currently pending/sent */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, business_unit, client_status")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (!quote || quote.business_unit !== "CC") return clientLinkNotFound();

  const currentStatus = String(quote.client_status || "").toLowerCase();
  const canAdvance = ["not_sent", "sent", "pending", ""].includes(currentStatus);

  if (canAdvance) {
    await sb
      .from("quotes")
      .update({ client_status: "viewed" })
      .eq("id", id)
    .eq("business_unit", "CC");
  }

  /* Log the view event (best-effort, table may not exist yet) */
  await sb
    .from("events")
    .insert({
      type: "quote.viewed",
      payload: { quote_id: id, ip, user_agent: userAgent },
    })
    .then(() => {});

  return NextResponse.json({ ok: true, viewed: true });
}
