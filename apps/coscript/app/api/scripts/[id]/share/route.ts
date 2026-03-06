import { NextResponse } from "next/server";
import { createSupabaseAuth } from "@/lib/supabase-auth";
import crypto from "crypto";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: script } = await supabase
    .from("scripts")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!script) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = crypto.randomBytes(16).toString("hex");
  const expires_at = new Date(Date.now() + 7 * 86400000).toISOString();

  const { error } = await supabase.from("share_links").insert({
    script_id: id,
    token,
    expires_at,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token, expires_at });
}
