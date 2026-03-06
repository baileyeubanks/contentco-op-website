import { NextResponse } from "next/server";
import { createSupabaseAuth } from "@/lib/supabase-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: script } = await supabase
    .from("scripts")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!script) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: versions, error } = await supabase
    .from("script_versions")
    .select("*")
    .eq("script_id", id)
    .order("version_number", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions });
}
