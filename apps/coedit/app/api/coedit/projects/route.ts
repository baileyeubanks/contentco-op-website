import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const ORG = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const { data: projects, error } = await supabase
    .from("editing_projects")
    .select("*")
    .eq("org_id", ORG)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach counts for each project
  const enriched = await Promise.all(
    (projects ?? []).map(async (p) => {
      const [uploads, soundbites, keepers] = await Promise.all([
        supabase.from("raw_uploads").select("id", { count: "exact", head: true }).eq("project_id", p.id),
        supabase.from("soundbites").select("id", { count: "exact", head: true }).eq("project_id", p.id),
        supabase.from("soundbites").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("keeper", true),
      ]);
      return {
        ...p,
        upload_count: uploads.count ?? 0,
        soundbite_count: soundbites.count ?? 0,
        keeper_count: keepers.count ?? 0,
      };
    })
  );

  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description } = body;

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("editing_projects")
    .insert({ org_id: ORG, title, description: description ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, upload_count: 0, soundbite_count: 0, keeper_count: 0 }, { status: 201 });
}
