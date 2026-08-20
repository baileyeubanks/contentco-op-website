import { NextResponse } from "next/server";

/**
 * Public CCO intake no longer has a Firebase persistence path. Keep this
 * historical URL explicit so health checks cannot mistake local-contract mode
 * for a successful submission backend.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "legacy_firebase_status_retired",
      message: "Public CCO intake uses CCO-DB; Firebase status is not a persistence health check.",
      retryable: false,
    },
    { status: 410 },
  );
}
