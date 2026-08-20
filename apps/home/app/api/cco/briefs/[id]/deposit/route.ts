import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * A public Checkout session must be backed by the canonical CCO payment rail
 * and an idempotent webhook receipt. The former endpoint used a legacy,
 * unpinned brief store, so it is explicitly unavailable until that rail is
 * implemented. A polished proposal is never evidence that payment is ready.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "deposit_checkout_unavailable",
      message: "Online deposit checkout is not available for this proposal yet.",
      retryable: false,
    },
    { status: 410 },
  );
}
