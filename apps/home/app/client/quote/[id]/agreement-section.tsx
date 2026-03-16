"use client";

import { useState } from "react";
import type { QuoteData } from "./quote-client-view";

const AGREEMENT_SECTIONS = [
  {
    id: "scope",
    title: "1. Scope of Work",
    body: "Astro Cleaning Services will perform the residential or commercial cleaning services described in the attached quote. Any work beyond the quoted scope requires a separate written estimate and approval.",
  },
  {
    id: "scheduling",
    title: "2. Scheduling & Access",
    body: "The client agrees to provide reasonable access to the property at the scheduled date and time. Cancellations made less than 24 hours prior to the scheduled service are subject to a 50% cancellation fee. Lockouts or inability to access the property will be treated as a same-day cancellation.",
  },
  {
    id: "payment",
    title: "3. Payment Terms",
    body: "A deposit is due upon acceptance of this quote. The remaining balance is due upon completion of the service. Accepted payment methods include credit/debit card, Zelle, and bank transfer. Late payments may be subject to a 1.5% monthly finance charge.",
  },
  {
    id: "satisfaction",
    title: "4. Satisfaction Guarantee",
    body: "If you are not satisfied with any aspect of our cleaning service, contact us within 48 hours and we will return to re-clean the areas in question at no additional charge. This guarantee covers the quality of work performed, not changes to the original scope.",
  },
  {
    id: "liability",
    title: "5. Liability & Insurance",
    body: "Astro Cleaning Services maintains general liability insurance and workers' compensation coverage. In the unlikely event of accidental damage, claims must be reported within 24 hours with photographic evidence. Our liability is limited to the cost of repair or replacement, not to exceed the quoted service amount.",
  },
  {
    id: "recurring",
    title: "6. Recurring Service Plans",
    body: "If this quote is for recurring service (weekly, bi-weekly, or monthly), the quoted rate applies for the initial commitment period. Either party may modify or cancel recurring services with 7 days' written notice. Rates are subject to annual review.",
  },
  {
    id: "general",
    title: "7. General Terms",
    body: "This agreement is governed by the laws of the State of Texas, Harris County jurisdiction. Astro Cleaning Services reserves the right to subcontract portions of the work. This agreement constitutes the entire understanding between both parties regarding the services described.",
  },
];

export function AgreementSection({
  quote,
  onBack,
  onAccepted,
}: {
  quote: QuoteData;
  onBack: () => void;
  onAccepted: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [signatureName, setSignatureName] = useState("");
  const [finalAgree, setFinalAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSectionsChecked = AGREEMENT_SECTIONS.every((s) => checked[s.id]);
  const canSubmit =
    allSectionsChecked && signatureName.trim().length >= 2 && finalAgree && !submitting;

  function toggleSection(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/quote/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_name: signatureName.trim(),
          agreement_sections: AGREEMENT_SECTIONS.map((s) => s.id),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save agreement");
      }

      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 sm:px-8 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Service Agreement</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please review and accept each section below.
        </p>
      </div>

      <div className="px-6 py-6 sm:px-8 space-y-4">
        {AGREEMENT_SECTIONS.map((section) => (
          <label
            key={section.id}
            className={`block rounded-xl border p-4 cursor-pointer transition-colors ${
              checked[section.id]
                ? "border-green-300 bg-green-50/50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!checked[section.id]}
                onChange={() => toggleSection(section.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1B4F72] focus:ring-[#1B4F72]"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{section.title}</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{section.body}</p>
              </div>
            </div>
          </label>
        ))}

        {/* Signature */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Digital Signature
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Type your full legal name to sign this agreement.
          </p>
          <input
            type="text"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F72] focus:border-transparent"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}
          />
          {signatureName.trim().length >= 2 && (
            <p className="text-xs text-gray-400 mt-2">
              Signed as: <span className="italic font-medium text-gray-600">{signatureName}</span>{" "}
              on {new Date().toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Final agree */}
        <label className="flex items-start gap-3 mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={finalAgree}
            onChange={() => setFinalAgree(!finalAgree)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1B4F72] focus:ring-[#1B4F72]"
          />
          <span className="text-sm text-gray-700 font-medium">
            I agree to all terms and conditions outlined above and authorize Astro Cleaning
            Services to proceed with the quoted services.
          </span>
        </label>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors ${
              canSubmit
                ? "bg-[#1B4F72] hover:bg-[#163d59] shadow-lg shadow-[#1B4F72]/20"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {submitting ? "Saving..." : "Continue to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
