import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { ModuleHeader } from "@/app/dashboard/components/module-header";
import { getRootMarketingSnapshot } from "@/lib/root-marketing";
import { resolveRootBrand } from "@/lib/root-brand";

function formatRelativeTime(iso: string | null) {
  if (!iso) return "unknown";
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(elapsedMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "unknown";
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusTone(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("approved") || lowered.includes("accepted") || lowered.includes("sent")) return "success";
  if (lowered.includes("draft") || lowered.includes("new")) return "warn";
  return "default";
}

export default async function RootMarketingPage() {
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const snapshot = await getRootMarketingSnapshot(brand.key);

  return (
    <div className="root-atlas-page" style={{ maxWidth: 1280 }}>
      <div style={{ display: "grid", gap: 22 }}>
        <ModuleHeader
          kicker={brand.key === "acs" ? "marketing engine" : "marketing + content engine"}
          title="marketing"
          description={snapshot.workflow.headline}
          meta={[
            { label: "workspace", value: brand.key === "acs" ? "ACS" : "CC", tone: "accent" },
            { label: "authority", value: snapshot.authority.title },
            { label: "brand sync", value: formatRelativeTime(snapshot.authority.freshness.modifiedAt), tone: "success" },
            { label: "assets", value: String(snapshot.assetSummary.total) },
          ]}
          actions={[
            { label: "brand central", href: snapshot.authority.publicUrl, tone: "secondary" },
            { label: "root atlas", href: snapshot.rootAuthority.publicUrl, tone: "secondary" },
            ...(brand.key === "cc" ? [{ label: "brief queue", href: "/root/marketing/briefs", tone: "secondary" as const }] : []),
            { label: "workflow", href: "/root/marketing/workflow", tone: "secondary" },
            { label: brand.key === "acs" ? "reputation" : "proof", href: "/root/marketing/proof", tone: "secondary" },
            { label: brand.key === "acs" ? "follow-through" : "delivery", href: "/root/marketing/execution", tone: "secondary" },
            { label: brand.key === "acs" ? "public site" : "brief intake", href: brand.key === "acs" ? "https://astrocleanings.com" : "https://contentco-op.com/brief", tone: "primary" },
          ]}
        />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16 }}>
          {snapshot.workflow.totals.map((metric) => (
            <div key={metric.label} style={card}>
              <div style={labelStyle}>{metric.label}</div>
              <div style={valueStyle}>{metric.value}</div>
              <div style={metaStyle}>{metric.note}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}>Authority Sources</div>
            <div style={{ display: "grid", gap: 12 }}>
              <AuthorityCard
                title={snapshot.authority.title}
                publicUrl={snapshot.authority.publicUrl}
                localPath={snapshot.authority.localPath}
                modifiedAt={snapshot.authority.freshness.modifiedAt}
              />
              <AuthorityCard
                title="ROOT Brand Central"
                publicUrl={snapshot.rootAuthority.publicUrl}
                localPath={snapshot.rootAuthority.localPath}
                modifiedAt={snapshot.rootAuthority.freshness.modifiedAt}
              />
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Public Surfaces</div>
            <div style={{ display: "grid", gap: 12 }}>
              {snapshot.publicSurfaces.map((surface) => (
                <a
                  key={surface.url}
                  href={surface.url}
                  style={surfaceCard}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>{surface.label}</div>
                    <div style={{ color: "var(--root-muted, var(--muted))", fontSize: "0.74rem" }}>open ↗</div>
                  </div>
                  <div style={metaStyle}>{surface.note}</div>
                  <div style={{ ...monoStyle, color: "var(--root-muted, var(--muted))" }}>{surface.url}</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}>Operator Lanes</div>
            <div style={{ display: "grid", gap: 12 }}>
              <Link href="/root/marketing/workflow" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={rowStackStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>workflow board</div>
                    <div style={{ color: "var(--root-muted, var(--muted))", fontSize: "0.74rem" }}>open ↗</div>
                  </div>
                  <div style={metaStyle}>
                    {brand.key === "acs"
                      ? "quote demand, follow-up, booked work, and trust assets in one ACS board"
                      : "brief intake, quote readiness, commercial in motion, and contracted scope in one CCO board"}
                  </div>
                </div>
              </Link>
              <Link href="/root/marketing/proof" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={rowStackStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>{brand.key === "acs" ? "reputation board" : "proof board"}</div>
                    <div style={{ color: "var(--root-muted, var(--muted))", fontSize: "0.74rem" }}>open ↗</div>
                  </div>
                  <div style={metaStyle}>
                    {brand.key === "acs"
                      ? "published reviews, testimonials, completed jobs, and trust actions"
                      : "flagship proof, featured studies, delivery bench, and review backlog"}
                  </div>
                </div>
              </Link>
              <Link href="/root/marketing/execution" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={rowStackStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>{brand.key === "acs" ? "follow-through board" : "delivery board"}</div>
                    <div style={{ color: "var(--root-muted, var(--muted))", fontSize: "0.74rem" }}>open ↗</div>
                  </div>
                  <div style={metaStyle}>
                    {brand.key === "acs"
                      ? "completed jobs, review handoff, closed-loop proof, and trust follow-through"
                      : "live delivery motion, contract-ready scope, precedent proof, and backlog cleanup"}
                  </div>
                </div>
              </Link>
              {brand.key === "cc" ? (
                <Link href="/root/marketing/briefs" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={rowStackStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>brief queue</div>
                      <div style={{ color: "var(--root-muted, var(--muted))", fontSize: "0.74rem" }}>open ↗</div>
                    </div>
                    <div style={metaStyle}>internal brief review, blockers, readiness, and quote-draft handoff</div>
                  </div>
                </Link>
              ) : null}
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Canonical Asset Library</div>
            <div style={metaStyle}>source: {snapshot.assetSummary.basePath}</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {snapshot.assetSummary.buckets.map((bucket) => (
                <div key={bucket.label} style={rowStyle}>
                  <div style={{ fontWeight: 700 }}>{bucket.label}</div>
                  <div style={valueStyle}>{bucket.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Workflow Queue</div>
            {brand.key === "cc" ? (
              <div style={{ ...metaStyle, marginBottom: 10 }}>
                review the full internal brief queue at <Link href="/root/marketing/briefs" style={{ color: "inherit" }}>brief queue ↗</Link>
              </div>
            ) : null}
            {snapshot.workflow.queue.length === 0 ? (
              <div style={emptyStyle}>No current marketing/content workflow records surfaced for this workspace.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {snapshot.workflow.queue.map((item) => {
                  const content = (
                    <div style={rowStyle}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div style={metaStyle}>{item.subtitle}</div>
                        <div style={metaStyle}>{item.createdAt ? formatTimestamp(item.createdAt) : "unknown timestamp"}</div>
                      </div>
                      <span style={statusChip(statusTone(item.status))}>{item.status.replace(/_/g, " ")}</span>
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
        </section>
      </div>
    </div>
  );
}

function AuthorityCard({
  title,
  publicUrl,
  localPath,
  modifiedAt,
}: {
  title: string;
  publicUrl: string;
  localPath: string;
  modifiedAt: string | null;
}) {
  return (
    <div style={rowStackStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={textLinkStyle}>
          open ↗
        </a>
      </div>
      <div style={metaStyle}>updated {formatRelativeTime(modifiedAt)} · {formatTimestamp(modifiedAt)}</div>
      <div style={monoStyle}>{localPath}</div>
    </div>
  );
}

const card: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(62,201,131,0.12)",
  background: "rgba(10,18,17,0.88)",
  padding: "18px 20px",
  display: "grid",
  gap: 8,
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
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(255,255,255,0.02)",
};

const rowStackStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(255,255,255,0.02)",
};

const surfaceCard: CSSProperties = {
  ...rowStackStyle,
  textDecoration: "none",
  color: "inherit",
};

const emptyStyle: CSSProperties = {
  padding: "16px 0",
  color: "var(--root-muted, var(--muted))",
};

const textLinkStyle: CSSProperties = {
  color: "var(--root-accent)",
  textDecoration: "none",
  fontSize: "0.78rem",
  fontWeight: 600,
};

function statusChip(tone: "default" | "warn" | "success") {
  const tones = {
    default: {
      color: "var(--root-ink, var(--foreground))",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    warn: {
      color: "#e4ad5b",
      background: "rgba(228,173,91,0.12)",
      border: "1px solid rgba(228,173,91,0.18)",
    },
    success: {
      color: "#3ec983",
      background: "rgba(62,201,131,0.12)",
      border: "1px solid rgba(62,201,131,0.18)",
    },
  } as const;

  return {
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "lowercase" as const,
    ...tones[tone],
  };
}
