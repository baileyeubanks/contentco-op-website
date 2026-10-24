"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { QuoteData } from "./quote-client-view";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

type PaymentSetup = {
  quoteId: string;
  clientSecret: string;
  invoiceId: string;
  amountCents: number;
};

export function CheckoutSection({
  quote,
  onBack,
  onSuccess,
}: {
  quote: QuoteData;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [setup, setSetup] = useState<PaymentSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSetup(null);
    setLoading(true);
    setError(null);

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
        if (
          typeof data?.clientSecret !== "string" ||
          !/^pi_.+_secret_.+$/.test(data.clientSecret) ||
          typeof data.invoice_id !== "string" ||
          !data.invoice_id.trim() ||
          typeof data.estimate_id !== "string" ||
          !data.estimate_id.trim() ||
          typeof data.estimate_version_id !== "string" ||
          !data.estimate_version_id.trim() ||
          !Number.isSafeInteger(data.amount_cents) ||
          data.amount_cents <= 0
        ) {
          throw new Error(
            "Payment setup could not be verified. Please reload the quote.",
          );
        }
        if (!cancelled) {
          setSetup({
            quoteId: quote.id,
            clientSecret: data.clientSecret,
            invoiceId: data.invoice_id,
            amountCents: data.amount_cents,
          });
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

  const activeSetup = setup?.quoteId === quote.id ? setup : null;
  const depositDollars = (
    (activeSetup?.amountCents ?? quote.deposit_amount_cents) / 100
  ).toFixed(2);

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
            <p className="text-3xl font-bold text-[#1B4F72]">
              ${depositDollars}
            </p>
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

        {error && !activeSetup && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {activeSetup && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: activeSetup.clientSecret,
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
              key={activeSetup.clientSecret}
              quoteId={quote.id}
              setup={activeSetup}
              depositDollars={depositDollars}
              onBack={onBack}
              onSuccess={onSuccess}
            />
          </Elements>
        )}

        {!activeSetup && !loading && (
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
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>
            Secured by Stripe. Your payment info never touches our servers.
          </span>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  quoteId,
  setup,
  depositDollars,
  onBack,
  onSuccess,
}: {
  quoteId: string;
  setup: PaymentSetup;
  depositDollars: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [finishedStatus, setFinishedStatus] = useState<
    "paid" | "canceled" | null
  >(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const finished = useRef(false);
  const providerPayment = useRef<{ id: string; status: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        !stripe ||
        !elements ||
        !mounted.current ||
        busy.current ||
        finished.current
      )
        return;

      busy.current = true;
      setSubmitting(true);
      setError(null);

      try {
        let paymentIntent = providerPayment.current;
        if (
          !paymentIntent ||
          paymentIntent.status === "requires_payment_method"
        ) {
          const { error: submitError } = await elements.submit();
          if (!mounted.current) return;
          if (submitError) {
            setError(submitError.message ?? "Validation failed");
            return;
          }
          // Once confirmation starts, uncertainty must be resolved against the
          // same intent. Only an observed uncharged requires_payment_method
          // state permits card correction and confirmation of this same intent.
          providerPayment.current = {
            id: setup.clientSecret.split("_secret_")[0],
            status: "unknown",
          };
          setVerificationPending(true);
          const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: `${window.location.origin}/client/quote/${quoteId}`,
            },
            redirect: "if_required",
          });
          if (!mounted.current) return;
          if (result.error || !result.paymentIntent) {
            setError(
              "Your payment status needs verification. Check payment status before trying again.",
            );
            return;
          }
          paymentIntent = result.paymentIntent;
        } else if (paymentIntent.status !== "succeeded") {
          const result = await stripe.retrievePaymentIntent(setup.clientSecret);
          if (!mounted.current) return;
          if (result.error || !result.paymentIntent) {
            setError(
              "Your payment status could not be verified. Please check again.",
            );
            return;
          }
          paymentIntent = result.paymentIntent;
        }
        if (paymentIntent.id !== providerPayment.current?.id) {
          setError(
            "Your payment status could not be verified. Please check again.",
          );
          return;
        }
        providerPayment.current = {
          id: paymentIntent.id,
          status: paymentIntent.status,
        };
        if (paymentIntent.status === "requires_payment_method") {
          setVerificationPending(false);
          setError(
            "Your payment was not completed. Correct your card details or choose another payment method, then try again.",
          );
          return;
        }
        if (paymentIntent.status === "canceled") {
          finished.current = true;
          setFinishedStatus("canceled");
          setVerificationPending(false);
          setError(
            "This payment was canceled. Return to the quote to restart checkout.",
          );
          return;
        }
        if (paymentIntent.status !== "succeeded") {
          setError(
            paymentIntent.status === "processing"
              ? "Your payment is processing. Check payment status before trying again."
              : "Payment has not been completed. Check payment status before making another payment.",
          );
          return;
        }
        const response = await fetch(
          `/api/client/quote/${quoteId}/pay/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
          },
        );
        const receipt = await response.json();
        if (!mounted.current) return;
        const matchingReceipt =
          receipt?.invoice_id === setup.invoiceId &&
          receipt?.amount_cents === setup.amountCents;
        const alreadyProcessed =
          receipt?.already_processed === true &&
          (receipt.invoice_id === undefined ||
            receipt.invoice_id === setup.invoiceId) &&
          (receipt.amount_cents === undefined ||
            receipt.amount_cents === setup.amountCents);
        if (
          !response.ok ||
          receipt?.ok !== true ||
          receipt?.error ||
          (!matchingReceipt && !alreadyProcessed)
        ) {
          setError(
            "Your payment succeeded, but its record could not be verified. Check payment status; do not pay again.",
          );
          return;
        }
        finished.current = true;
        setFinishedStatus("paid");
        setVerificationPending(false);
        onSuccess();
      } catch {
        if (!mounted.current) return;
        setError(
          providerPayment.current &&
            providerPayment.current.status !== "requires_payment_method"
            ? "Your payment needs verification. Check payment status; do not pay again."
            : "Payment validation failed. Please try again.",
        );
      } finally {
        busy.current = false;
        if (mounted.current) setSubmitting(false);
      }
    },
    [stripe, elements, quoteId, setup, onSuccess],
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
          disabled={submitting || verificationPending}
          className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={
            !stripe || !elements || submitting || Boolean(finishedStatus)
          }
          className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors ${
            !stripe || !elements || submitting || Boolean(finishedStatus)
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-[#1B4F72] hover:bg-[#163d59] shadow-lg shadow-[#1B4F72]/20"
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : finishedStatus === "canceled" ? (
            "Payment canceled"
          ) : verificationPending ? (
            "Check payment status"
          ) : (
            `Pay $${depositDollars} Deposit`
          )}
        </button>
      </div>
    </form>
  );
}
