import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: project, error } = await supabase
    .from("editing_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [uploads, soundbites, keepers] = await Promise.all([
    supabase.from("raw_uploads").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("soundbites").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("soundbites").select("id", { count: "exact", head: true }).eq("project_id", id).eq("keeper", true),
  ]);

  return NextResponse.json({
    ...project,
    uploads: uploads.data ?? [],
    soundbite_count: soundbites.count ?? 0,
    keeper_count: keepers.count ?? 0,
  });
}
