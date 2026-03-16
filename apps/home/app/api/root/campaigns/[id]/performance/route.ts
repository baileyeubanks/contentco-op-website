import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  const [{ data: campaign }, { data: contacts }] = await Promise.all([
    sb.from("campaigns").select("*").eq("id", id).maybeSingle(),
    sb.from("campaign_contacts").select("status").eq("campaign_id", id),
  ]);

  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const all = contacts || [];
  const enrolled = all.filter((c) => c.status === "enrolled" || c.status === "active").length;
  const completed = all.filter((c) => c.status === "completed").length;
  const optedOut = all.filter((c) => c.status === "opted_out").length;
  const bounced = all.filter((c) => c.status === "bounced").length;

  return NextResponse.json({
    campaign_id: id,
    title: campaign.title,
    status: campaign.status,
    metrics: {
      total_contacts: all.length,
      enrolled,
      completed,
      opted_out: optedOut,
      bounced,
      completion_rate: all.length > 0 ? Math.round((completed / all.length) * 100) : 0,
      opt_out_rate: all.length > 0 ? Math.round((optedOut / all.length) * 100) : 0,
    },
  });
}
