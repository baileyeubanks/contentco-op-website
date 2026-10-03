import { NextResponse } from "next/server";
import { discoveryRuntime } from "@/lib/cco-discovery-booking-runtime";
import { reserveDiscovery, validateDirectBooking } from "@/lib/cco-discovery-booking-rail";
import { buildDiscoverySlots } from "@/lib/cco-booking";
import { validateCsrf } from "@/lib/csrf";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export async function POST(req?: Request) {
  if (req) {
    if (!validateCsrf(req).valid) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
    const limit = rateLimit(`cco-discovery:${getClientIp(req)}`, { max: 10, windowMs: 60000 });
    if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const runtime = await discoveryRuntime();
    if (!runtime || !req) throw new Error("booking_unavailable");
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
    const input = validateDirectBooking(body);
    if (!input) return NextResponse.json({ error: "invalid_booking" }, { status: 400 });
    const result = await reserveDiscovery(input, runtime.config, runtime.store, runtime.provider, (request) => buildDiscoverySlots(20).some((slot) => slot.startsAt === request.startsAt && slot.endsAt === request.endsAt));
    return NextResponse.json(result, { status: result.ok ? 200 : result.retryable ? 503 : 409, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "booking_unavailable", message: "Online discovery-call scheduling is temporarily unavailable. No time has been reserved.", retryable: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
