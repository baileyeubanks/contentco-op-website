import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = await req.json().catch(() => ({}));

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (payload.state) updates.state = payload.state;
  if (payload.body) updates.body = payload.body;

  const { data, error } = await supabase
    .from("timecoded_comments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }

  // Log event
  await supabase.from("review_events").insert({
    asset_id: data.asset_id,
    event_type: payload.state === "resolved" ? "comment_resolved" : "comment_updated",
    payload: { comment_id: id, state: payload.state },
  });

  return NextResponse.json(data);
}
