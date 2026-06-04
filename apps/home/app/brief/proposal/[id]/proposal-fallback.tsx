"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface ProposalFallbackProps {
  briefId: string;
  reason: "generating" | "unavailable";
}

export function ProposalFallback({ briefId, reason }: ProposalFallbackProps) {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    if (reason !== "generating") return;
    const interval = setInterval(() => setDots((d) => (d % 3) + 1), 800);
    return () => clearInterval(interval);
  }, [reason]);

  const isGenerating = reason === "generating";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          padding: "40px 32px",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: isGenerating ? "rgba(74,222,128,0.08)" : "rgba(251,191,36,0.08)",
            border: `1px solid ${isGenerating ? "rgba(74,222,128,0.2)" : "rgba(251,191,36,0.2)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 24,
          }}
        >
          {isGenerating ? "✦" : "⚡"}
        </div>

        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {isGenerating
            ? `Generating your proposal${".".repeat(dots)}`
            : "Proposal coming soon"}
        </h1>

        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.5)",
            margin: "0 0 24px",
          }}
        >
          {isGenerating
            ? "Our AI producer is crafting your custom proposal. This usually takes 30–60 seconds. Refresh in a moment."
            : "Your proposal is being finalized by our team. We'll email it to you shortly, or you can check back soon."}
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#4ade80",
              color: "#0a0a0a",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh Page
          </button>
          <Link
            href="/"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Back to Home
          </Link>
        </div>

        <div
          style={{
            marginTop: 20,
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.25)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          Ref: {briefId.slice(0, 8).toUpperCase()}
        </div>
      </div>
    </main>
  );
}
