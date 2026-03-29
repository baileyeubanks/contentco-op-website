"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GeneratePayLinkButton({
  invoiceId,
  className,
}: {
  invoiceId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/root/invoices/${invoiceId}/pay-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate payment link");
        return;
      }
      // Refresh the page to show the new payment link
      router.refresh();
    } catch {
      alert("Failed to generate payment link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={className}
      style={loading ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
    >
      {loading ? "generating..." : "generate pay link"}
    </button>
  );
}
