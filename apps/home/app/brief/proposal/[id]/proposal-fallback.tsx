import Link from "next/link";

interface ProposalFallbackProps {
  briefId: string;
  reason: "not_ready" | "unavailable";
}

export function ProposalFallback({ briefId, reason }: ProposalFallbackProps) {
  const isNotReady = reason === "not_ready";

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
            background: isNotReady ? "rgba(74,222,128,0.08)" : "rgba(251,191,36,0.08)",
            border: `1px solid ${isNotReady ? "rgba(74,222,128,0.2)" : "rgba(251,191,36,0.2)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 24,
          }}
        >
          {isNotReady ? "✦" : "⚡"}
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
          {isNotReady ? "Proposal not ready" : "Proposal unavailable"}
        </h1>

        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.5)",
            margin: "0 0 24px",
          }}
        >
          {isNotReady
            ? "Your brief is saved, but a durable proposal has not been generated. We will follow up after reviewing the scope."
            : "We could not load a durable proposal record. Please contact our team if you need help."}
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
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
