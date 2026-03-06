import { NextResponse } from "next/server";
import { createSupabaseAuth } from "@/lib/supabase-auth";

export async function GET() {
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: scripts, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scripts });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      user_id: user.id,
      title: body.title || "Untitled Script",
      script_type: body.script_type || "video_script",
      content: body.content || "",
      hook: body.hook || "",
      audience: body.audience || "",
      objective: body.objective || "",
      tone: body.tone || "",
      platform: body.platform || "",
      word_count: body.word_count || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ script }, { status: 201 });
}
