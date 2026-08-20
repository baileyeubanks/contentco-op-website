import { NextResponse } from "next/server";

/**
 * The old endpoint rendered a fixture proposal for arbitrary IDs. A real PDF
 * export must be sourced from an authorized, durable CCO estimate; until that
 * exists, return an explicit unavailable state instead of fabricated output.
 */
export async function GET() {
  return NextResponse.json(
    { error: "proposal_pdf_unavailable", retryable: false },
    { status: 410 },
  );
}
