export const dynamic = "force-dynamic";

// X2 HOTFIX 2026-10-08 (D12): this unauthenticated, id-only route created a
// Stripe Checkout session for any invoice id and wrote the URL onto the
// invoice row. No live page calls it. It is closed (404, empty body, the same
// response notFound() gives in a route handler) until a token-gated pay flow
// ships. Do not read params, construct a data client or import Stripe here.
export async function POST(): Promise<Response> {
  return new Response(null, { status: 404 });
}
