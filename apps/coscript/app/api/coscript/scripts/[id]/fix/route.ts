import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = await req.json().catch(() => ({}));

  if (!payload.fix_request) {
    return NextResponse.json({ error: "Missing fix_request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("script_fixes")
    .insert({
      script_job_id: id,
      parent_variant_id: payload.parent_variant_id || null,
      fix_request: payload.fix_request,
      output_content: null, // Phase 2: LLM would fill this
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create fix" }, { status: 500 });
  }

  return NextResponse.json(data);
}
