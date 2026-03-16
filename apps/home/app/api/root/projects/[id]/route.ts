import { NextResponse } from "next/server";
import { getProjectById, updateProjectStatus } from "@/lib/root-projects-engine";
import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getProjectById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Handle status changes specially (trigger events)
  if (body.status) {
    const result = await updateProjectStatus(id, body.status);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result);
  }

  // Generic update
  const sb = getSupabase();
  const { data, error } = await sb.from("projects").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
