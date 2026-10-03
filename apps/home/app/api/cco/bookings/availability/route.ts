import { NextResponse } from "next/server";
import { discoveryRuntime } from "@/lib/cco-discovery-booking-runtime";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const runtime = await discoveryRuntime();
    if (runtime) return NextResponse.json({ ok: true, slots: await runtime.availability(), durationMinutes: 20 }, { headers: { "Cache-Control": "no-store" } });
  } catch { /* No fabricated slots on configuration, database or provider failure. */ }
  return NextResponse.json({ error: "booking_unavailable", message: "Online discovery-call scheduling is temporarily unavailable. No time has been reserved.", retryable: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
