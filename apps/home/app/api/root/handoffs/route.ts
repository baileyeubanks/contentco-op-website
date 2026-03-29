import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("daily_handoffs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message, handoffs: [] }, { status: 500 });
  return NextResponse.json({ handoffs: data || [] });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  const body = await req.json().catch(() => null);

  if (!body?.owner || !body?.machine || !body?.title || !body?.summary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payload = {
    owner: String(body.owner).trim(),
    machine: String(body.machine).trim(),
    title: String(body.title).trim(),
    summary: String(body.summary).trim(),
    blockers: toList(body.blockers),
    next_actions: toList(body.next_actions),
  };

  const { data, error } = await sb
    .from("daily_handoffs")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handoff: data });
}
