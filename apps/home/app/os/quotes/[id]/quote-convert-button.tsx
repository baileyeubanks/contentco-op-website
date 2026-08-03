"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function QuoteConvertButton({
  quoteId,
  disabled = false,
}: {
  quoteId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  /* Quick convert (for when you just need it done fast) */
  async function handleQuickConvert() {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "conversion_failed");
      const invoiceId = data?.invoice?.id;
      router.push(invoiceId ? `/os/invoices/${invoiceId}` : "/os/invoices");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Invoice conversion failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Link
        href={`/os/quotes/${quoteId}/convert`}
        className="os-atlas-button os-atlas-button-primary"
        style={{ textDecoration: "none", textAlign: "center" }}
      >
        review & convert
      </Link>
      <button
        type="button"
        onClick={() => void handleQuickConvert()}
        className="os-atlas-button os-atlas-button-secondary"
        disabled={disabled || loading}
      >
        {loading ? "converting..." : "quick convert"}
      </button>
    </div>
  );
}
