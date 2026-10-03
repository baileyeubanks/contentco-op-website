import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired unauthenticated client-portal lookup.
 *
 * This route previously resolved a contact from a bare `?email=` or
 * `?contact_id=` query with the service-role client and returned that
 * person's quotes, jobs, invoices and payments to anyone who supplied the
 * address. Equality filtering on a public identifier is not an access check.
 *
 * Client portal access must be a bearer capability minted by CCO OS (the
 * creative-brief portal already works this way with `creative_briefs.access_token`).
 * Until that capability exists for contacts, this endpoint fails closed.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "client_portal_lookup_retired",
      message: "Client portal access requires a link issued by Content Co-Op. Request one through /book.",
      retryable: false,
    },
    { status: 410 },
  );
}
