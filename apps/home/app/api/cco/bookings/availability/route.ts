import { NextResponse } from "next/server";
import { getDiscoveryAvailability, type DiscoveryDuration } from "@/lib/cco-booking";

export const dynamic = "force-dynamic";

function parseDuration(value: string | null): DiscoveryDuration {
  if (value === "15") return 15;
  if (value === "30") return 30;
  return 20;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const duration = parseDuration(searchParams.get("duration"));
  const availability = await getDiscoveryAvailability(duration);

  return NextResponse.json({
    ok: true,
    duration_minutes: duration,
    calendar: availability.calendar,
    slots: availability.slots,
  });
}
