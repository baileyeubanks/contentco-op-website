import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { filename, duration_seconds, file_size_bytes, mime_type } = body;

  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

  const { data, error } = await supabase
    .from("raw_uploads")
    .insert({
      project_id: id,
      filename,
      duration_seconds: duration_seconds ?? null,
      file_size_bytes: file_size_bytes ?? null,
      mime_type: mime_type ?? "video/mp4",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update project status
  await supabase
    .from("editing_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json(data, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("raw_uploads")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
