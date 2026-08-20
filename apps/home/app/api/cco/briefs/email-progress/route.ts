import { NextResponse } from "next/server";

/**
 * The old reminder endpoint wrote drafts and email jobs to Firebase. It is
 * intentionally retired rather than silently retaining a second persistence
 * system while the CCO-DB notification workflow is the intake authority.
 */
export async function POST() {
  return NextResponse.json(
    { error: "legacy_email_progress_retired", retryable: false },
    { status: 410 },
  );
}
