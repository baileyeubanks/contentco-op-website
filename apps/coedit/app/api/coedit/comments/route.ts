import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.asset_id || !payload.at || !payload.body) {
    return NextResponse.json({ error: "Missing comment fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("timecoded_comments")
    .insert({
      asset_id: payload.asset_id,
      version_id: payload.version_id || null,
      timecode: payload.at,
      body: payload.body,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }

  // Log event
  await supabase.from("review_events").insert({
    asset_id: payload.asset_id,
    event_type: "comment_added",
    payload: { comment_id: data.id, timecode: payload.at },
  });

  return NextResponse.json(data);
}

export async function GET(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("asset_id");
  if (!assetId) {
    return NextResponse.json({ error: "asset_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("timecoded_comments")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
