import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { ModuleHeader } from "@/app/dashboard/components/module-header";
import { getRootMarketingBriefQueue } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

function formatTimestamp(value: string | null) {
  if (!value) return "unknown";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function chip(tone: "default" | "warn" | "success" | "accent"): CSSProperties {
  const styles: Record<string, CSSProperties> = {
    default: { border: "1px solid rgba(148,163,184,0.18)", color: "rgba(226,232,240,0.9)" },
    warn: { border: "1px solid rgba(251,191,36,0.26)", color: "#fbbf24" },
    success: { border: "1px solid rgba(52,211,153,0.24)", color: "#6ee7b7" },
    accent: { border: "1px solid rgba(74,222,128,0.2)", color: "#86efac" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "6px 10px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.68rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    background: "rgba(255,255,255,0.02)",
    ...styles[tone],
  };
}

export default async function RootMarketingBriefQueuePage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const briefs = await getRootMarketingBriefQueue(brand.key);

  return (
    <div className="root-atlas-page" style={{ maxWidth: 1280 }}>
      <div style={{ display: "grid", gap: 22 }}>
        <ModuleHeader
          kicker="marketing + content engine"
          title="brief queue"
          description="Internal review queue for Content Co-op public briefs, readiness, blockers, and commercial handoff."
          meta={[
            { label: "workspace", value: "CC", tone: "accent" },
            { label: "briefs", value: String(briefs.length) },
            { label: "quote ready", value: String(briefs.filter((brief) => brief.quoteReady).length), tone: "success" },
            { label: "needs follow-up", value: String(briefs.filter((brief) => !brief.quoteReady).length), tone: "warn" },
          ]}
          actions={[
            { label: "marketing lane", href: "/root/marketing", tone: "secondary" },
            { label: "public brief", href: "https://contentco-op.com/brief", tone: "secondary" },
            { label: "quotes", href: "/root/quotes", tone: "primary" },
          ]}
        />

        {briefs.length === 0 ? (
          <div style={emptyStyle}>No internal brief records surfaced right now.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {briefs.map((brief) => (
              <Link key={brief.id} href={brief.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={rowStyle}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.98rem" }}>{brief.title}</div>
                      <span style={chip("accent")}>{brief.recommendation || brief.contentType}</span>
                      <span style={chip(brief.quoteReady ? "success" : "warn")}>
                        {brief.quoteReady ? "quote ready" : "follow up"}
                      </span>
                    </div>
                    <div style={metaStyle}>
                      {[brief.company, formatTimestamp(brief.createdAt)].filter(Boolean).join(" · ")}
                    </div>
                    {brief.recommendation && brief.recommendation !== brief.contentType ? (
                      <div style={metaStyle}>legacy content type: {brief.contentType}</div>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {brief.deliverables.slice(0, 5).map((value) => (
                        <span key={value} style={chip("default")}>{value}</span>
                      ))}
                    </div>
                    <div style={metaStyle}>
                      blockers: {brief.blockers.length ? brief.blockers.join(", ").replace(/_/g, " ") : "none"}
                    </div>
                    <div style={metaStyle}>
                      missing: {brief.missingFields.length ? brief.missingFields.join(", ").replace(/_/g, " ") : "none"}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    <span style={chip(brief.status.includes("review") ? "warn" : "accent")}>{brief.status.replace(/_/g, " ")}</span>
                    <div style={metaStyle}>open brief ↗</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(10,18,17,0.88)",
};

const metaStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--root-muted, var(--muted))",
};

const emptyStyle: CSSProperties = {
  padding: "20px 0",
  color: "var(--root-muted, var(--muted))",
};
