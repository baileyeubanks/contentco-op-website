import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("soundbites")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Phase 2: actual video clip extraction
  // For now, return soundbite metadata as export payload
  return NextResponse.json({
    export_ready: false,
    message: "Video clip export coming in Phase 2. Soundbite metadata below.",
    soundbite: data,
  });
}
