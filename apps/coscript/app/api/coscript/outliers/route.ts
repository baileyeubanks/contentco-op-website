import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("outlier_scores")
    .select("*, source_videos(*)")
    .order("score", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch outliers" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
