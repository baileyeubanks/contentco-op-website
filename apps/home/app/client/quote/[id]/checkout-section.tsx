"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { QuoteData } from "./quote-client-view";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

export function CheckoutSection({
  quote,
  onBack,
  onSuccess,
}: {
  quote: QuoteData;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      try {
        const res = await fetch(`/api/client/quote/${quote.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to initialize payment");
        }

        const data = await res.json();
        if (!cancelled) {
          setClientSecret(data.clientSecret);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Payment setup failed");
          setLoading(false);
        }
      }
    }

    createIntent();
    return () => {
      cancelled = true;
    };
  }, [quote.id]);

  const depositDollars = (quote.deposit_amount_cents / 100).toFixed(2);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 sm:px-8 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Pay Deposit</h2>
        <p className="text-sm text-gray-500 mt-1">
          Secure payment to confirm your service booking.
        </p>
      </div>

      <div className="px-6 py-6 sm:px-8">
        {/* Amount summary */}
        <div className="bg-[#1B4F72]/5 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Deposit Amount</p>
            <p className="text-3xl font-bold text-[#1B4F72]">${depositDollars}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Quote #{quote.quote_number}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Total: ${Number(quote.estimated_total).toFixed(2)}
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !clientSecret && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#1B4F72",
                  colorBackground: "#ffffff",
                  colorText: "#1a1a1a",
                  colorDanger: "#dc2626",
                  fontFamily:
                    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                  borderRadius: "12px",
                  spacingUnit: "4px",
                },
                rules: {
                  ".Input": {
                    border: "1px solid #d1d5db",
                    boxShadow: "none",
                    padding: "12px 14px",
                  },
                  ".Input:focus": {
                    border: "1px solid #1B4F72",
                    boxShadow: "0 0 0 1px #1B4F72",
                  },
                  ".Label": {
                    fontWeight: "500",
                    fontSize: "14px",
                    marginBottom: "6px",
                  },
                },
              },
            }}
          >
            <PaymentForm
              quoteId={quote.id}
              depositDollars={depositDollars}
              onBack={onBack}
              onSuccess={onSuccess}
            />
          </Elements>
        )}

        {!clientSecret && !loading && (
          <div className="flex gap-3 pt-4">
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Secured by Stripe. Your payment info never touches our servers.</span>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  quoteId,
  depositDollars,
  onBack,
  onSuccess,
}: {
  quoteId: string;
  depositDollars: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      setSubmitting(true);
      setError(null);

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Validation failed");
        setSubmitting(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/client/quote/${quoteId}`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message ?? "Payment failed");
        setSubmitting(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        /* Confirm on our backend */
        try {
          await fetch(`/api/client/quote/${quoteId}/pay/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
          });
        } catch {
          /* Non-critical — webhook will catch it */
        }
        onSuccess();
      } else {
        setError("Payment was not completed. Please try again.");
        setSubmitting(false);
      }
    },
    [stripe, elements, quoteId, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 mt-4">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors ${
            !stripe || submitting
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-[#1B4F72] hover:bg-[#163d59] shadow-lg shadow-[#1B4F72]/20"
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            `Pay $${depositDollars} Deposit`
          )}
        </button>
      </div>
    </form>
  );
}
