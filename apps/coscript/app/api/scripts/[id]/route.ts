import { NextResponse } from "next/server";
import { createSupabaseAuth } from "@/lib/supabase-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: script, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !script) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ script });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Save current version before updating
  const { data: current } = await supabase
    .from("scripts")
    .select("content, hook, score, score_breakdown")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (current && current.content && current.content !== body.content) {
    const { data: lastVersion } = await supabase
      .from("script_versions")
      .select("version_number")
      .eq("script_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    await supabase.from("script_versions").insert({
      script_id: id,
      version_number: (lastVersion?.version_number || 0) + 1,
      content: current.content,
      hook: current.hook || "",
      score: current.score || 0,
      score_breakdown: current.score_breakdown || {},
    });
  }

  const updates: Record<string, unknown> = {};
  const fields = ["title", "script_type", "content", "hook", "audience", "objective", "tone", "platform", "score", "score_breakdown", "ai_feedback", "status", "word_count"];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  const { data: script, error } = await supabase
    .from("scripts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ script });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("scripts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
