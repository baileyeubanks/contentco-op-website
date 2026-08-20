import { NextResponse } from "next/server";

/**
 * The retired implementation created a Calendar event and then treated a
 * Firebase preview write as a booking receipt. Do not tell a client that a
 * discovery call is reserved until a canonical CCO-DB booking record and
 * idempotent calendar receipt exist.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "booking_unavailable",
      message: "Online discovery-call scheduling is temporarily unavailable. No time has been reserved.",
      retryable: false,
    },
    { status: 503 },
  );
}
