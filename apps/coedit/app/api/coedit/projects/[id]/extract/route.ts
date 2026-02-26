import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

const CATEGORIES = ["insight", "story", "quote", "reaction", "data"];
const SPEAKERS = ["Interviewee", "Host", "Guest A", "Guest B"];

function randomTC(maxMinutes: number): string {
  const h = 0;
  const m = Math.floor(Math.random() * maxMinutes);
  const s = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function addSeconds(tc: string, secs: number): string {
  const [h, m, s] = tc.split(":").map(Number);
  let total = h * 3600 + m * 60 + s + secs;
  const nh = Math.floor(total / 3600);
  total %= 3600;
  const nm = Math.floor(total / 60);
  const ns = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}:${String(ns).padStart(2, "0")}`;
}

const MOCK_TRANSCRIPTS = [
  "The real turning point was when we stopped measuring output and started measuring impact. That changed everything for the team.",
  "I think people underestimate how important the first thirty seconds are. You either hook them or you lose them.",
  "We tried three different approaches before landing on this one. The key was listening to the operators on the ground.",
  "Safety isn't just a checkbox — it's a culture. And culture starts with the stories you tell about what matters.",
  "Our biggest win last quarter came from a conversation we almost didn't have. Someone spoke up in a meeting and it saved us six figures.",
  "The data told one story, but the people on site told a completely different one. We had to reconcile both.",
  "When I first walked onto that platform, I realized this job was nothing like what I'd been trained for.",
  "Every client says they want authentic content, but most aren't prepared for what authentic actually looks like.",
];

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Find an upload to extract from
  const { data: uploads } = await supabase
    .from("raw_uploads")
    .select("id")
    .eq("project_id", id)
    .limit(1);

  const uploadId = uploads?.[0]?.id;
  if (!uploadId) {
    return NextResponse.json({ error: "No uploads found. Upload a file first." }, { status: 400 });
  }

  // Create extraction job
  const { data: job, error: jobErr } = await supabase
    .from("extraction_jobs")
    .insert({
      project_id: id,
      upload_id: uploadId,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  // Generate 5-8 mock soundbites
  const count = 5 + Math.floor(Math.random() * 4);
  const bites = [];
  for (let i = 0; i < count; i++) {
    const startTc = randomTC(25);
    const dur = 8 + Math.floor(Math.random() * 25);
    bites.push({
      upload_id: uploadId,
      project_id: id,
      start_tc: startTc,
      end_tc: addSeconds(startTc, dur),
      duration_seconds: dur,
      transcript: MOCK_TRANSCRIPTS[i % MOCK_TRANSCRIPTS.length],
      speaker: SPEAKERS[Math.floor(Math.random() * SPEAKERS.length)],
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      confidence: +(0.6 + Math.random() * 0.35).toFixed(2),
    });
  }

  const { error: biteErr } = await supabase.from("soundbites").insert(bites);
  if (biteErr) {
    await supabase.from("extraction_jobs").update({ status: "failed", error_message: biteErr.message }).eq("id", job.id);
    return NextResponse.json({ error: biteErr.message }, { status: 500 });
  }

  // Update job as complete
  await supabase
    .from("extraction_jobs")
    .update({ status: "complete", soundbites_found: count, completed_at: new Date().toISOString() })
    .eq("id", job.id);

  // Update project status
  await supabase
    .from("editing_projects")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", id);

  // Update upload status
  await supabase
    .from("raw_uploads")
    .update({ status: "analyzed" })
    .eq("id", uploadId);

  return NextResponse.json({ job_id: job.id, soundbites_found: count });
}
