import Link from "next/link";
import { PublicPageLayout } from "./components/public-page-layout";

export default function NotFound() {
  return (
    <PublicPageLayout surface="home" theme="dark">
      <main style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "4rem 1.5rem",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 480 }}>
          <h1 style={{
            fontFamily: "var(--font-display), Fraunces, Georgia, serif",
            fontSize: "clamp(3rem, 8vw, 5rem)",
            fontWeight: 500,
            lineHeight: 1,
            color: "#0c1322",
            margin: "0 0 1rem",
          }}>
            404
          </h1>
          <p style={{
            fontSize: "1.1rem",
            color: "#666",
            margin: "0 0 2rem",
            lineHeight: 1.6,
          }}>
            This page doesn&apos;t exist. Maybe it moved, maybe it never was.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#c4722a",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}>
              Back to home
            </Link>
            <Link href="/portfolio" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              border: "1px solid rgba(0,0,0,0.1)",
              color: "#0c1322",
              padding: "0.75rem 1.5rem",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}>
              View work
            </Link>
          </div>
        </div>
      </main>
    </PublicPageLayout>
  );
}
