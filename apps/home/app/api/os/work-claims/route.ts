import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("work_claims")
    .select("*")
    .is("released_at", null)
    .order("claimed_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message, work_claims: [] }, { status: 500 });
  return NextResponse.json({ work_claims: data || [] });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  const body = await req.json().catch(() => null);
  if (!body?.task_key || !body?.title || !body?.repo || !body?.machine || !body?.owner) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const payload = {
    task_key: String(body.task_key),
    title: String(body.title),
    repo: String(body.repo),
    machine: String(body.machine),
    owner: String(body.owner),
    status: "active",
    notes: body.notes ? String(body.notes) : null,
  };
  const { data, error } = await sb
    .from("work_claims")
    .insert(payload)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ work_claim: data });
}
