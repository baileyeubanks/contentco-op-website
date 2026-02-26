import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.brief_id) {
    return NextResponse.json({ error: "Missing brief_id" }, { status: 400 });
  }

  // Create script job
  const { data: job, error: jobErr } = await supabase
    .from("script_jobs")
    .insert({
      org_id: ORG_ID,
      brief_id: payload.brief_id,
      source_video_id: payload.source_video_id || null,
      status: "queued",
    })
    .select()
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Failed to create script job" }, { status: 500 });
  }

  // Generate 3 placeholder variants (real LLM integration is Phase 2)
  const variantDefs = [
    { label: "A", mode: "direct", content: "Operator-first concise narrative. [Placeholder — real generation in Phase 2]" },
    { label: "B", mode: "executive", content: "Leadership narrative with risk framing. [Placeholder — real generation in Phase 2]" },
    { label: "C", mode: "human", content: "Trust-forward practical language. [Placeholder — real generation in Phase 2]" },
  ];

  const { data: variants, error: varErr } = await supabase
    .from("script_variants")
    .insert(
      variantDefs.map((v) => ({
        script_job_id: job.id,
        variant_label: v.label,
        mode: v.mode,
        content: v.content,
      }))
    )
    .select();

  if (varErr) {
    return NextResponse.json({ error: "Failed to create variants" }, { status: 500 });
  }

  // Mark job complete
  await supabase
    .from("script_jobs")
    .update({ status: "complete", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  return NextResponse.json({
    script_job_id: job.id,
    variants: variants ?? [],
  });
}
