import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Update watchlist status to syncing
  await supabase
    .from("watchlists")
    .update({ status: "syncing" })
    .eq("id", id);

  // Phase 2: real YouTube/TikTok sync would happen here.
  // For now, mark as active after "sync".
  await supabase
    .from("watchlists")
    .update({ status: "active" })
    .eq("id", id);

  return NextResponse.json({
    watchlist_id: id,
    status: "synced",
    sources_found: 0,
  });
}
