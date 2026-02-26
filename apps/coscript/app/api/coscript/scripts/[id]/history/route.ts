import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: variants, error: varErr } = await supabase
    .from("script_variants")
    .select("*")
    .eq("script_job_id", id)
    .order("created_at", { ascending: true });

  if (varErr) {
    return NextResponse.json({ error: "Failed to fetch variants" }, { status: 500 });
  }

  const { data: fixes } = await supabase
    .from("script_fixes")
    .select("*")
    .eq("script_job_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    variants: variants ?? [],
    fixes: fixes ?? [],
  });
}
