import { NextResponse } from "next/server";

/**
 * Retired public intake endpoint.
 *
 * It previously used an unpinned generic Supabase client and could continue
 * after downstream handoff failures. Public Content Co-Op intake is accepted
 * only through /api/cco/briefs, which requires a durable CCO-DB receipt before
 * the client may display success.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_brief_intake_retired",
      message: "This intake endpoint is unavailable. Submit your brief through /brief.",
      retryable: false,
    },
    { status: 410 },
  );
}
