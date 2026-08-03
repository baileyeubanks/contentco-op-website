import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("quote_views")
    .select("id, ip_address, user_agent, viewed_at")
    .eq("quote_id", id)
    .order("viewed_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ views: [] });
  return NextResponse.json({ views: data ?? [] });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sb = getSupabase();
  const headers = req.headers;

  const { error } = await sb.from("quote_views").insert({
    quote_id:   id,
    ip_address: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: headers.get("user-agent") ?? null,
    referrer:   headers.get("referer") ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
