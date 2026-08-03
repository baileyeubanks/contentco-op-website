import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { ModuleHeader } from "@/app/dashboard/components/module-header";
import { getRootMarketingExecutionSnapshot } from "@/lib/root-marketing";
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
  if (lowered.includes("approved") || lowered.includes("published") || lowered.includes("live") || lowered.includes("reviewed")) return "success" as const;
  if (lowered.includes("blocked") || lowered.includes("pending") || lowered.includes("needed") || lowered.includes("follow_up")) return "warn" as const;
  return "accent" as const;
}

export default async function RootMarketingExecutionPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const snapshot = await getRootMarketingExecutionSnapshot(brand.key);

  return (
    <div className="root-atlas-page" style={{ maxWidth: 1320 }}>
      <div style={{ display: "grid", gap: 22 }}>
        <ModuleHeader
          kicker={brand.key === "acs" ? "marketing + follow-through engine" : "marketing + delivery engine"}
          title={brand.key === "acs" ? "follow-through" : "delivery"}
          description={snapshot.headline}
          meta={[
            { label: "workspace", value: brand.key === "acs" ? "ACS" : "CC", tone: "accent" },
            { label: "sections", value: String(snapshot.sections.length) },
            { label: "active items", value: String(snapshot.sections.reduce((sum, section) => sum + section.count, 0)) },
          ]}
          actions={[
            { label: "marketing lane", href: "/root/marketing", tone: "secondary" },
            { label: brand.key === "acs" ? "reputation" : "proof", href: "/root/marketing/proof", tone: "secondary" },
            { label: snapshot.primaryAction.label, href: snapshot.primaryAction.href, tone: "primary" },
          ]}
        />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16 }}>
          {snapshot.metrics.map((metric) => (
            <div key={metric.label} style={card}>
              <div style={labelStyle}>{metric.label}</div>
              <div style={valueStyle}>{metric.value}</div>
              <div style={metaStyle}>{metric.note}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
          {snapshot.sections.map((section) => (
            <div key={section.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={sectionTitle}>{section.label}</div>
                  <div style={metaStyle}>{section.description}</div>
                </div>
                <div style={valueStyle}>{section.count}</div>
              </div>
              {section.items.length === 0 ? (
                <div style={emptyStyle}>No items in this section right now.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {section.items.map((item) => {
                    const content = (
                      <div style={rowStyle}>
                        <div style={{ display: "grid", gap: 8, flex: 1 }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontWeight: 700 }}>{item.title}</div>
                            <div style={metaStyle}>{item.subtitle}</div>
                            <div style={metaStyle}>{item.note || "No additional note."}</div>
                          </div>
                          {item.badges?.length ? (
                            <div style={badgeWrap}>
                              {item.badges.map((badge) => (
                                <span key={badge} style={chip("default")}>{badge}</span>
                              ))}
                            </div>
                          ) : null}
                          {item.details?.length ? (
                            <div style={{ display: "grid", gap: 4 }}>
                              {item.details.map((detail) => (
                                <div key={detail} style={detailStyle}>{detail}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span style={chip(toneForStatus(item.status))}>{item.status.replace(/_/g, " ")}</span>
                      </div>
                    );

                    if (item.href?.startsWith("/")) {
                      return (
                        <Link key={item.id} href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
                          {content}
                        </Link>
                      );
                    }

                    if (item.href) {
                      return (
                        <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                          {content}
                        </a>
                      );
                    }

                    return <div key={item.id}>{content}</div>;
                  })}
                </div>
              )}
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}>Operator Action</div>
            <a
              href={snapshot.primaryAction.href}
              target={snapshot.primaryAction.href.startsWith("/") ? undefined : "_blank"}
              rel={snapshot.primaryAction.href.startsWith("/") ? undefined : "noopener noreferrer"}
              style={{ ...rowStyle, textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700 }}>{snapshot.primaryAction.label}</div>
                <div style={metaStyle}>{snapshot.primaryAction.note}</div>
              </div>
              <span style={chip("accent")}>open</span>
            </a>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Source Notes</div>
            <div style={{ display: "grid", gap: 10 }}>
              {snapshot.sourceNotes.map((note) => (
                <div key={note.label} style={rowStyle}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{note.label}</div>
                    <div style={monoStyle}>{note.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--root-muted, var(--muted))",
};

const valueStyle: CSSProperties = {
  fontSize: "1.65rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const metaStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--root-muted, var(--muted))",
};

const monoStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.68rem",
  lineHeight: 1.5,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(255,255,255,0.02)",
};

const badgeWrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const detailStyle: CSSProperties = {
  fontSize: "0.74rem",
  lineHeight: 1.5,
  color: "rgba(226,232,240,0.78)",
};

const emptyStyle: CSSProperties = {
  padding: "16px 0",
  color: "var(--root-muted, var(--muted))",
};
