"use client";

import { useState } from "react";
import type { QuoteData } from "./quote-client-view";

const AGREEMENT_SECTIONS = [
  { id: "scope", title: "Scope of Work", body: "Content Co-op will produce the deliverables described in this quote. Additional work requires a written change order." },
  { id: "schedule", title: "Timeline", body: "Production begins after the agreed deposit and required client materials are received. The quote describes the delivery schedule." },
  { id: "payment", title: "Payment Terms", body: "The deposit, remaining balance and payment schedule are those stated in this quote." },
  { id: "revisions", title: "Revisions", body: "The quote describes the included revisions. Additional revisions require approval of a change order." },
  { id: "rights", title: "Usage Rights", body: "Rights and usage follow the terms included in the quote. Contact service@contentco-op.com with questions before accepting." },
];

export function AgreementSection({
  quote,
  acceptToken,
  onBack,
  onAccepted,
}: {
  quote: QuoteData;
  acceptToken: string | null;
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
      if (!acceptToken) {
        throw new Error("Agreement acceptance is temporarily unavailable");
      }
      const res = await fetch(
        `/api/share/quote/${quote.id}/accept?t=${encodeURIComponent(acceptToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "accept",
            signature_name: signatureName.trim(),
            agreement_sections: AGREEMENT_SECTIONS.map((s) => s.id),
          }),
        },
      );

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
            I agree to all terms and conditions outlined above and authorize Content Co-op to proceed with the quoted services.
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
