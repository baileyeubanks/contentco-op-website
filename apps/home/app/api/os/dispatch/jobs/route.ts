import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/root/dispatch/jobs?start=ISO&end=ISO
 *
 * Fetch jobs for the dispatch calendar within a date range.
 * Joins with contacts to get client_name if not stored directly.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params (ISO dates) are required" },
      { status: 400 }
    );
  }

  const sb = getSupabase();

  const { data: jobs, error } = await sb
    .from("jobs")
    .select(
      "id, contact_id, client_name, client_email, client_phone, service_address, service_type, scheduled_start, scheduled_end, status, crew_assigned, notes, total_amount_cents"
    )
    .gte("scheduled_start", start)
    .lte("scheduled_start", end)
    .order("scheduled_start", { ascending: true });

  if (error) {
    console.error("[dispatch/jobs] Supabase error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch jobs" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, jobs: jobs ?? [] });
}
