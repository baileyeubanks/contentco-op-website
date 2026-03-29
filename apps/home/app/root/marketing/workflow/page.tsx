import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { ModuleHeader } from "@/app/dashboard/components/module-header";
import { getRootMarketingWorkflowSnapshot } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

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

function toneForStatus(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("accepted") || lowered.includes("approved") || lowered.includes("live")) return "success" as const;
  if (lowered.includes("pending") || lowered.includes("new") || lowered.includes("review") || lowered.includes("empty")) return "warn" as const;
  return "accent" as const;
}

export default async function RootMarketingWorkflowPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const snapshot = await getRootMarketingWorkflowSnapshot(brand.key);

  return (
    <div className="root-atlas-page" style={{ maxWidth: 1320 }}>
      <div style={{ display: "grid", gap: 22 }}>
        <ModuleHeader
          kicker="marketing + content engine"
          title="workflow"
          description={snapshot.headline}
          meta={[
            { label: "workspace", value: brand.key === "acs" ? "ACS" : "CC", tone: "accent" },
            { label: "lanes", value: String(snapshot.lanes.length) },
            { label: "active items", value: String(snapshot.lanes.reduce((sum, lane) => sum + lane.count, 0)) },
          ]}
          actions={[
            { label: "marketing lane", href: "/root/marketing", tone: "secondary" },
            { label: brand.key === "acs" ? "reputation" : "proof", href: "/root/marketing/proof", tone: "secondary" },
            { label: brand.key === "acs" ? "follow-through" : "delivery", href: "/root/marketing/execution", tone: "secondary" },
            ...(brand.key === "cc" ? [{ label: "brief queue", href: "/root/marketing/briefs", tone: "secondary" as const }] : []),
            { label: brand.key === "acs" ? "quotes" : "quote drafts", href: "/root/quotes", tone: "primary" },
          ]}
        />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
          {snapshot.lanes.map((lane) => (
            <div key={lane.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={sectionTitle}>{lane.label}</div>
                  <div style={metaStyle}>{lane.description}</div>
                </div>
                <div style={bigValue}>{lane.count}</div>
              </div>
              {lane.items.length === 0 ? (
                <div style={emptyStyle}>No items in this lane right now.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {lane.items.map((item) => {
                    const content = (
                      <div style={rowStyle}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={metaStyle}>{item.subtitle}</div>
                          <div style={metaStyle}>{item.note || "No additional note."}</div>
                        </div>
                        <span style={chip(toneForStatus(item.status))}>{item.status.replace(/_/g, " ")}</span>
                      </div>
                    );
                    if (item.href) {
                      return (
                        <Link key={item.id} href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
                          {content}
                        </Link>
                      );
                    }
                    return <div key={item.id}>{content}</div>;
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(62,201,131,0.12)",
  background: "rgba(10,18,17,0.88)",
  padding: "18px 20px",
  display: "grid",
  gap: 12,
};

const sectionTitle: CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const metaStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--root-muted, var(--muted))",
};

const bigValue: CSSProperties = {
  fontSize: "1.65rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(255,255,255,0.02)",
};

const emptyStyle: CSSProperties = {
  padding: "16px 0",
  color: "var(--root-muted, var(--muted))",
};
