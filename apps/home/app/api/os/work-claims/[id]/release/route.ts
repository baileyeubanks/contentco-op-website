import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("work_claims")
    .update({ released_at: new Date().toISOString(), status: "released" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ work_claim: data });
}
