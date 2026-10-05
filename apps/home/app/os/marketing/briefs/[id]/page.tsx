import type { CSSProperties } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleHeader } from "@/app/dashboard/components/module-header";
import { BriefOpsPanel } from "./brief-ops-panel";
import { ProposalReviewPanel } from "./proposal-review-panel";
import { getRootMarketingBriefDetail } from "@/lib/os-marketing";
import { resolveOsBrand } from "@/lib/os-brand";

function formatTimestamp(value: string | null) {
  if (!value) return "unknown";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null) {
  if (value == null) return "n/a";
  return `$${value.toLocaleString("en-US")}`;
}

function toneForStatus(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("approved") || lowered.includes("sent") || lowered.includes("accepted")) return "success";
  if (lowered.includes("review") || lowered.includes("pending") || lowered.includes("new")) return "warn";
  return "accent";
}

export default async function RootMarketingBriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerStore = await headers();
  const brand = resolveOsBrand(headerStore.get("host"), headerStore.get("x-os-brand"));
  const detail = await getRootMarketingBriefDetail(brand.key, id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="os-atlas-page" style={{ maxWidth: 1280 }}>
      <div style={{ display: "grid", gap: 22 }}>
        <ModuleHeader
          kicker="marketing + content engine"
          title="brief review"
          description="Internal review lane for creative brief intake, quote readiness, and commercial handoff."
          meta={[
            { label: "workspace", value: "CC", tone: "accent" },
            { label: "brief", value: detail.id.slice(0, 8) },
            { label: "status", value: detail.status.replace(/_/g, " "), tone: toneForStatus(detail.status) },
            { label: "quote ready", value: detail.readiness.quoteReady ? "yes" : "needs follow-up", tone: detail.readiness.quoteReady ? "success" : "warn" },
          ]}
          actions={[
            { label: "marketing lane", href: "/os/marketing", tone: "secondary" },
            { label: "public brief", href: "https://contentco-op.com/brief", tone: "secondary" },
            ...(detail.relatedQuotes[0]?.id ? [{ label: "latest draft quote", href: `/os/quotes/${detail.relatedQuotes[0].id}`, tone: "primary" as const }] : []),
          ]}
        />

        <section style={notificationCard} aria-label="Brief notification delivery">
          <h2 style={sectionTitle}>Notification delivery</h2>
          {detail.notifications.map((notice) => (
            <p key={notice.audience}>
              {notice.audience === "internal" ? "Team alert" : "Client receipt"}: {notice.status}
              {notice.status === "sent" ? " — provider accepted; inbox delivery is not confirmed." : " — manual team follow-up required."}
            </p>
          ))}
          <p>The brief remains available for review. Failed or unknown emails do not create a Co-VideoPro project. No email is resent from this panel.</p>
        </section>

        <section style={metricGrid}>
          <MetricCard label="deliverables" value={String(detail.project.deliverables.length)} note="requested outputs in the brief" />
          <MetricCard label="missing fields" value={String(detail.readiness.missingFields.length)} note="fields still absent from intake" />
          <MetricCard label="blockers" value={String(detail.readiness.blockers.length)} note="fields preventing quote readiness" />
          <MetricCard label="draft quotes" value={String(detail.relatedQuotes.length)} note="internal quote drafts already generated" />
        </section>

        <section style={splitGrid}>
          <div style={card}>
            <div style={sectionTitle}>Contact + Intake</div>
            <div style={stack}>
              <Field label="name" value={detail.contact.name} />
              <Field label="email" value={detail.contact.email} />
              <Field label="company" value={detail.contact.company || "unknown"} />
              <Field label="role" value={detail.contact.role || "unknown"} />
              <Field label="location" value={detail.contact.location || "unknown"} />
              <Field label="submission mode" value={detail.source.submissionMode.replace(/_/g, " ")} />
              <Field label="booking intent" value={detail.source.bookingIntent.replace(/_/g, " ")} />
              <Field label="source path" value={detail.source.sourcePath} mono />
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Project Scope</div>
            <div style={stack}>
              <Field label="recommended type" value={detail.project.recommendation || detail.project.contentType || "unknown"} />
              {detail.project.contentType && detail.project.contentType !== detail.project.recommendation ? (
                <Field label="legacy content type" value={detail.project.contentType} />
              ) : null}
              <Field label="likely scope" value={detail.project.likelyScope || "unknown"} />
              <Field label="production level" value={detail.project.productionLevel || "unknown"} />
              <Field label="recommended next step" value={detail.project.nextStep || "unknown"} />
              <Field label="audience" value={detail.project.audience || "unknown"} />
              <Field label="tone" value={detail.project.tone || "unknown"} />
              <Field label="deadline" value={detail.project.deadline || "unknown"} />
              <Field label="objective" value={detail.project.objective || "unknown"} />
              <Field label="key messages" value={detail.project.keyMessages || "unknown"} />
              <Field label="references" value={detail.project.references || "unknown"} />
              <Field label="constraints" value={detail.project.constraints || "unknown"} />
              <Field label="deliverables" value={detail.project.deliverables.join(", ") || "none"} />
            </div>
          </div>
        </section>

        {detail.publicScope || detail.estimate ? (
          <section style={splitGrid}>
            <div style={card}>
              <div style={sectionTitle}>Production Scope (public brief)</div>
              {detail.publicScope ? (
                <div style={stack}>
                  <Field label="project" value={detail.publicScope.projectName || detail.publicScope.projectTypes.join(", ") || "unknown"} />
                  <Field label="types" value={detail.publicScope.projectTypes.join(", ") || "unknown"} />
                  <Field label="capture days" value={detail.publicScope.shootDayCount || "1"} />
                  <Field label="locations" value={detail.publicScope.filmingLocations || "1"} />
                  <Field label="travel" value={detail.publicScope.travelScope || "Houston / local"} />
                  <Field label="finish" value={detail.publicScope.styleLevel || "Polished Commercial"} />
                  <Field label="runtime" value={detail.publicScope.targetRuntime || "unknown"} />
                  <Field label="capture needs" value={detail.publicScope.productionNeeds.join(", ") || "none"} />
                  <Field label="enhancements" value={detail.publicScope.enhancements.join(", ") || "none"} />
                  <Field label="placements" value={detail.publicScope.placements.join(", ") || "unknown"} />
                  <Field label="timeline" value={detail.publicScope.timeline || "unknown"} />
                  <Field label="client budget" value={detail.publicScope.budgetRange || "unknown"} />
                  <Field label="revisions" value={detail.publicScope.revisionExpectation || "unknown"} />
                  <Field label="context" value={detail.publicScope.projectContext || "unknown"} />
                  <Field label="success looks like" value={detail.publicScope.successDefinition || "unknown"} />
                </div>
              ) : (
                <div style={muted}>Legacy brief shape; no public scope fields.</div>
              )}
            </div>

            <div style={card}>
              <div style={sectionTitle}>Instant Estimate (rate card, unreviewed)</div>
              {detail.estimate ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div>
                      <div style={smallLabel}>range shown to client</div>
                      <div style={bigValue}>{formatMoney(detail.estimate.low)} – {formatMoney(detail.estimate.high)}</div>
                    </div>
                    <div>
                      <div style={smallLabel}>rate-card total</div>
                      <div style={{ fontWeight: 700 }}>{formatMoney(detail.estimate.subtotal)}</div>
                    </div>
                    <div>
                      <div style={smallLabel}>50% deposit</div>
                      <div style={{ fontWeight: 700 }}>{formatMoney(detail.estimate.deposit)}</div>
                    </div>
                  </div>
                  <div style={stack}>
                    {detail.estimate.lines.map((line, index) => (
                      <div key={`${line.label}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={muted}>
                          {line.label}
                          {line.quantity && line.unitPrice ? ` · ${line.quantity} ${line.unit || ""} × ${formatMoney(line.unitPrice)}` : ""}
                        </div>
                        <div style={monoText}>{formatMoney(Math.round(line.amount))}</div>
                      </div>
                    ))}
                  </div>
                  {detail.estimate.notes.length > 0 ? (
                    <div style={muted}>{detail.estimate.notes.join(" ")}</div>
                  ) : null}
                  <div style={muted}>Generate the draft quote to freeze a version; this card is informational.</div>
                </div>
              ) : (
                <div style={muted}>No rate-card estimate for this brief shape.</div>
              )}
            </div>
          </section>
        ) : null}

        <section style={splitGrid}>
          <div style={card}>
            <div style={sectionTitle}>Readiness</div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={rowStyle}>
                <div style={{ fontWeight: 700 }}>intake complete</div>
                <span style={chip(detail.readiness.intakeComplete ? "success" : "warn")}>
                  {detail.readiness.intakeComplete ? "complete" : "incomplete"}
                </span>
              </div>
              <div style={rowStyle}>
                <div style={{ fontWeight: 700 }}>quote ready</div>
                <span style={chip(detail.readiness.quoteReady ? "success" : "warn")}>
                  {detail.readiness.quoteReady ? "ready" : "blocked"}
                </span>
              </div>
              <div>
                <div style={smallLabel}>blockers</div>
                {detail.readiness.blockers.length > 0 ? (
                  <div style={pillWrap}>
                    {detail.readiness.blockers.map((value) => <span key={value} style={chip("warn")}>{value.replace(/_/g, " ")}</span>)}
                  </div>
                ) : (
                  <div style={muted}>No hard blockers on quote readiness.</div>
                )}
              </div>
              <div>
                <div style={smallLabel}>missing fields</div>
                {detail.readiness.missingFields.length > 0 ? (
                  <div style={pillWrap}>
                    {detail.readiness.missingFields.map((value) => <span key={value} style={chip("default")}>{value.replace(/_/g, " ")}</span>)}
                  </div>
                ) : (
                  <div style={muted}>Structured intake is fully populated.</div>
                )}
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Commercial Handoff</div>
            <BriefOpsPanel briefId={detail.id} existingQuoteId={detail.relatedQuotes[0]?.id || null} briefStatus={detail.status} />
            <ProposalReviewPanel briefId={id} />
          </div>
        </section>

        <section style={splitGrid}>
          <div style={card}>
            <div style={sectionTitle}>Status History</div>
            {detail.history.length === 0 ? (
              <div style={muted}>No brief status history logged yet.</div>
            ) : (
              <div style={stack}>
                {detail.history.map((entry) => (
                  <div key={entry.id} style={rowStack}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>{entry.status.replace(/_/g, " ")}</div>
                      <div style={muted}>{formatTimestamp(entry.createdAt)}</div>
                    </div>
                    <div style={muted}>{entry.note || "No additional notes recorded."}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>Related Quotes</div>
            {detail.relatedQuotes.length === 0 ? (
              <div style={muted}>No draft quotes have been generated from this brief yet.</div>
            ) : (
              <div style={stack}>
                {detail.relatedQuotes.map((quote) => (
                  <Link key={quote.id} href={`/os/quotes/${quote.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={rowStack}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 700 }}>{quote.quoteNumber || quote.id.slice(0, 8)}</div>
                        <span style={chip(toneForStatus(quote.clientStatus || quote.internalStatus || "pending"))}>
                          {(quote.clientStatus || quote.internalStatus || "pending").replace(/_/g, " ")}
                        </span>
                      </div>
                      <div style={muted}>estimated total {formatMoney(quote.estimatedTotal)}</div>
                      <div style={muted}>created {formatTimestamp(quote.createdAt)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={card}>
      <div style={smallLabel}>{label}</div>
      <div style={bigValue}>{value}</div>
      <div style={muted}>{note}</div>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={fieldRow}>
      <div style={smallLabel}>{label}</div>
      <div style={mono ? monoText : undefined}>{value}</div>
    </div>
  );
}

const metricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: 16,
};

const splitGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  borderRadius: 16,
  border: "1px solid rgba(62,201,131,0.12)",
  background: "rgba(10,18,17,0.88)",
  padding: "18px 20px",
  display: "grid",
  gap: 12,
};

const notificationCard: CSSProperties = {
  ...card,
  color: "#f1f5f9",
  background: "#0a1211",
};

const sectionTitle: CSSProperties = {
  fontSize: "0.92rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const stack: CSSProperties = {
  display: "grid",
  gap: 10,
};

const fieldRow: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(255,255,255,0.02)",
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

const rowStack: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(62,201,131,0.1)",
  background: "rgba(255,255,255,0.02)",
};

const bigValue: CSSProperties = {
  fontSize: "1.65rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const smallLabel: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--root-muted, var(--muted))",
};

const muted: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--root-muted, var(--muted))",
};

const monoText: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.72rem",
};

const pillWrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

function chip(tone: "default" | "accent" | "warn" | "success"): CSSProperties {
  const styles: Record<string, CSSProperties> = {
    default: { border: "1px solid rgba(148,163,184,0.18)", color: "rgba(226,232,240,0.9)" },
    accent: { border: "1px solid rgba(74,222,128,0.2)", color: "#86efac" },
    warn: { border: "1px solid rgba(251,191,36,0.26)", color: "#fbbf24" },
    success: { border: "1px solid rgba(52,211,153,0.24)", color: "#6ee7b7" },
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
