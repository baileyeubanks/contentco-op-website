import Link from "next/link";
import { headers } from "next/headers";
import { resolveRootBrand } from "@/lib/root-brand";

const ROLE_CARDS = [
  {
    title: "Client",
    body: "Track quotes, invoices, files, and communication history.",
    href: "/login",
  },
  {
    title: "Crew",
    body: "View assignments, routing, live dispatch state, and checklists.",
    href: "/root/login",
  },
  {
    title: "Admin",
    body: "Run approvals, finance, documents, dispatch, and system health.",
    href: "/root/login",
  },
  {
    title: "Root",
    body: "Open the full operations core for Astro Cleanings and Content Co-op.",
    href: "/root/login",
  },
];

export default async function RootEntryPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32 }}>
      <div
        style={{
          width: "min(1180px, 100%)",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            padding: "28px 30px",
            borderRadius: 18,
            border: "1px solid var(--line)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 18px 80px rgba(0,0,0,0.24)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "var(--root-accent)",
                boxShadow: "0 0 14px var(--root-accent)",
              }}
            />
            <span style={{ fontSize: "1.08rem", fontWeight: 760, letterSpacing: "-0.03em" }}>
              root
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1.3fr 1fr",
              alignItems: "end",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.4rem, 5vw, 5rem)",
                  lineHeight: 0.92,
                  letterSpacing: "-0.06em",
                  margin: 0,
                }}
              >
                One operating system.
                <br />
                <em style={{ color: "var(--root-accent)", fontStyle: "italic" }}>
                  Two businesses.
                </em>
              </h1>
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
              <div style={{ textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.66rem", marginBottom: 8 }}>
                {brand.domainLabel}
              </div>
              <div>{brand.loginHint}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {ROLE_CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              style={{
                display: "grid",
                gap: 10,
                textDecoration: "none",
                color: "inherit",
                padding: "20px 18px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                minHeight: 180,
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--muted)",
                }}
              >
                {card.title}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", letterSpacing: "-0.04em" }}>
                {card.title === "Root" ? "Operations Core" : `${card.title} Access`}
              </div>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6, fontSize: "0.9rem" }}>
                {card.body}
              </p>
              <span
                style={{
                  marginTop: "auto",
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--root-accent)",
                  fontWeight: 700,
                }}
              >
                Open →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
