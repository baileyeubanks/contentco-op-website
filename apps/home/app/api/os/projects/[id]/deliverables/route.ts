import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createDeliverable, updateDeliverableStatus } from "@/lib/root-projects-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("deliverables")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deliverables: data || [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const result = await createDeliverable({ project_id: id, ...body });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (!body.deliverable_id || !body.status) {
    return NextResponse.json({ error: "deliverable_id and status required" }, { status: 400 });
  }

  const result = await updateDeliverableStatus(body.deliverable_id, body.status);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
