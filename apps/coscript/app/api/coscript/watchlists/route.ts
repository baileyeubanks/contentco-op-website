import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.name) {
    return NextResponse.json({ error: "Missing watchlist name" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("watchlists")
    .insert({
      org_id: ORG_ID,
      name: payload.name,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create watchlist" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("watchlists")
    .select("*, watchlist_sources(count)")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlists" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
