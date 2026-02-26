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
  if (!payload.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vault_items")
    .insert({
      org_id: ORG_ID,
      script_job_id: payload.script_job_id || null,
      source_video_id: payload.source_video_id || null,
      title: payload.title,
      tags: payload.tags || [],
      payload: payload.payload || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save to vault" }, { status: 500 });
  }

  return NextResponse.json(data);
}
