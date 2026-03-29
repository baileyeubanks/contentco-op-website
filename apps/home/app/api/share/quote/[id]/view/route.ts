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
  const sb = getSupabase();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  /* Only advance to "viewed" if currently pending/sent */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, client_status")
    .eq("id", id)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const currentStatus = String(quote.client_status || "").toLowerCase();
  const canAdvance = ["not_sent", "sent", "pending", ""].includes(currentStatus);

  if (canAdvance) {
    await sb
      .from("quotes")
      .update({ client_status: "viewed" })
      .eq("id", id);
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
