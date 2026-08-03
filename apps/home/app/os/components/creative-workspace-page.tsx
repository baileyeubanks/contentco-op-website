import type { CSSProperties } from "react";
import Link from "next/link";
import { ModuleHeader } from "@/app/dashboard/components/module-header";

type Action = {
  label: string;
  href: string;
  tone?: "primary" | "secondary" | "warn";
};

type Metric = {
  label: string;
  value: string;
  note: string;
};

type SectionItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  note?: string;
  href?: string;
};

type Section = {
  id: string;
  label: string;
  description: string;
  items: SectionItem[];
};

export function CreativeWorkspacePage({
  kicker,
  title,
  description,
  meta,
  actions,
  metrics,
  sections,
}: {
  kicker: string;
  title: string;
  description: string;
  meta: Array<{ label: string; value: string; tone?: "default" | "accent" | "warn" | "success" }>;
  actions: Action[];
  metrics: Metric[];
  sections: Section[];
}) {
  return (
    <div className="root-atlas-page" style={{ maxWidth: 1240, display: "grid", gap: 18 }}>
      <ModuleHeader
        kicker={kicker}
        title={title}
        description={description}
        meta={meta}
        actions={actions}
      />

      <section style={metricGrid}>
        {metrics.map((metric) => (
          <div key={metric.label} style={panel}>
            <div style={metricLabel}>{metric.label}</div>
            <div style={metricValue}>{metric.value}</div>
            <div style={metaText}>{metric.note}</div>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        {sections.map((section) => (
          <div key={section.id} style={panel}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={sectionTitle}>{section.label}</div>
              <div style={metaText}>{section.description}</div>
            </div>

            {section.items.length === 0 ? (
              <div style={emptyState}>No live records surfaced for this lane yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {section.items.map((item) => {
                  const content = (
                    <div style={rowStyle}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div style={metaText}>{item.subtitle}</div>
                        {item.note ? <div style={metaText}>{item.note}</div> : null}
                      </div>
                      <span style={statusChip(item.status)}>{item.status.replace(/_/g, " ")}</span>
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
  );
}

function statusChip(status: string): CSSProperties {
  const lowered = status.toLowerCase();
  const background = lowered.includes("approved") || lowered.includes("ready") || lowered.includes("live")
    ? "rgba(62,201,131,0.14)"
    : lowered.includes("review") || lowered.includes("pending") || lowered.includes("blocked")
      ? "rgba(228,173,91,0.16)"
      : "rgba(255,255,255,0.06)";

  const color = lowered.includes("approved") || lowered.includes("ready") || lowered.includes("live")
    ? "#3ec983"
    : lowered.includes("review") || lowered.includes("pending") || lowered.includes("blocked")
      ? "#e4ad5b"
      : "var(--root-muted, var(--muted))";

  return {
    alignSelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background,
    color,
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const panel: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(62,201,131,0.12)",
  background: "rgba(10,18,17,0.88)",
  padding: "16px 18px",
  display: "grid",
  gap: 12,
};

const metricLabel: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.62rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--root-muted, var(--muted))",
};

const metricValue: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const sectionTitle: CSSProperties = {
  fontSize: "0.96rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  textTransform: "lowercase",
};

const metaText: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.68rem",
  color: "var(--root-muted, var(--muted))",
  lineHeight: 1.45,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  paddingTop: 10,
  borderTop: "1px solid rgba(255,255,255,0.05)",
};

const emptyState: CSSProperties = {
  color: "var(--root-muted, var(--muted))",
  fontSize: "0.82rem",
};
