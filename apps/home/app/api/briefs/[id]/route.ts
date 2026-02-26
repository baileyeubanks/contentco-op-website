import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const { data: brief, error } = await supabase
    .from("creative_briefs")
    .select("*")
    .eq("id", id)
    .eq("access_token", token)
    .single();

  if (error || !brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  // Fetch status history
  const { data: history } = await supabase
    .from("brief_status_history")
    .select("*")
    .eq("brief_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ brief, history: history ?? [] });
}
