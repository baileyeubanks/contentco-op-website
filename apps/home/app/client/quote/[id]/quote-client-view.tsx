"use client";

import { useState } from "react";
import { QuoteSummary } from "./quote-summary";
import { AgreementSection } from "./agreement-section";
import { CheckoutSection } from "./checkout-section";

export type QuoteData = {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  service_address: string | null;
  service_type: string | null;
  square_footage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  frequency: string | null;
  estimated_total: number;
  deposit_amount_cents: number;
  deposit_status: string | null;
  status: string | null;
  agreement_accepted: boolean | null;
  signature_name: string | null;
  created_at: string;
};

export type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  phase_name: string | null;
};

type Step = "summary" | "agreement" | "checkout" | "confirmed";

export function QuoteClientView({
  quote,
  items,
}: {
  quote: QuoteData;
  items: QuoteItem[];
}) {
  /* If already paid, go straight to confirmed */
  const initialStep: Step =
    quote.deposit_status === "paid"
      ? "confirmed"
      : quote.agreement_accepted
        ? "checkout"
        : "summary";

  const [step, setStep] = useState<Step>(initialStep);

  /* Progress indicator */
  const steps: { key: Step; label: string }[] = [
    { key: "summary", label: "Review" },
    { key: "agreement", label: "Agreement" },
    { key: "checkout", label: "Payment" },
  ];

  const currentIndex = step === "confirmed" ? 3 : steps.findIndex((s) => s.key === step);

  if (step === "confirmed") {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Deposit Received!</h1>
        <p className="text-gray-600 max-w-md mx-auto mb-6">
          Thank you, {quote.client_name}. Your deposit of{" "}
          <span className="font-semibold">
            ${(quote.deposit_amount_cents / 100).toFixed(2)}
          </span>{" "}
          has been received. We&apos;ll be in touch shortly to schedule your service.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm mx-auto text-left">
          <p className="text-sm text-gray-500 mb-1">Quote</p>
          <p className="font-semibold text-gray-900 mb-3">#{quote.quote_number}</p>
          <p className="text-sm text-gray-500 mb-1">Total</p>
          <p className="font-semibold text-gray-900 mb-3">
            ${Number(quote.estimated_total).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mb-1">Deposit Paid</p>
          <p className="font-semibold text-green-700">
            ${(quote.deposit_amount_cents / 100).toFixed(2)}
          </p>
        </div>
        <p className="text-sm text-gray-400 mt-8">
          Questions? Call us at{" "}
          <a href="tel:+13464015841" className="text-[#1B4F72] underline">
            (346) 401-5841
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Step progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                i < currentIndex
                  ? "bg-green-500 text-white"
                  : i === currentIndex
                    ? "bg-[#1B4F72] text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < currentIndex ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-sm hidden sm:inline ${
                i === currentIndex ? "font-semibold text-gray-900" : "text-gray-500"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-0.5 ${
                  i < currentIndex ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === "summary" && (
        <QuoteSummary
          quote={quote}
          items={items}
          onAccept={() => setStep("agreement")}
        />
      )}

      {step === "agreement" && (
        <AgreementSection
          quote={quote}
          onBack={() => setStep("summary")}
          onAccepted={() => setStep("checkout")}
        />
      )}

      {step === "checkout" && (
        <CheckoutSection
          quote={quote}
          onBack={() => setStep("agreement")}
          onSuccess={() => setStep("confirmed")}
        />
      )}
    </div>
  );
}
