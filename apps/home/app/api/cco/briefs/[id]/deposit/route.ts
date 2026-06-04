import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const description = String(body.description || "Project deposit");

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://contentco-op.com";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Project Deposit",
              description,
            },
            unit_amount: Math.round(amount * 100), // cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        brief_id: id,
        type: "deposit",
      },
      success_url: `${appUrl}/brief/proposal/${id}?paid=true`,
      cancel_url: `${appUrl}/brief/proposal/${id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[deposit] Stripe error:", err);
    return NextResponse.json(
      { error: "stripe_error", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
