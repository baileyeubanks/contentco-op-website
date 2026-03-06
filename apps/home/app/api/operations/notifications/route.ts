import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/operations/notifications — Recent notification log.
 * Query params: channel, status, limit
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  let query = supabase
    .from("notification_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data || [] });
}
