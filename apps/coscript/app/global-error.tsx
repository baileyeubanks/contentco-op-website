"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ background: "#0f172a", color: "#f1f5f9", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>{error.message}</p>
          <button onClick={reset} style={{ background: "#b5ff66", color: "#0f172a", border: "none", borderRadius: 8, padding: "0.625rem 1.25rem", fontWeight: 700, cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
