import { NextResponse } from "next/server";

/**
 * Availability is disabled with booking creation so preview slots cannot be
 * mistaken for reservable CCO calendar time.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "booking_unavailable",
      message: "Online discovery-call scheduling is temporarily unavailable. No time has been reserved.",
      retryable: false,
    },
    { status: 503 },
  );
}
