import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/app/root/components/copy-link-button";
import { GeneratePayLinkButton } from "@/app/root/components/generate-pay-link-button";
import { InvoiceDetailActions } from "@/app/root/components/invoice-detail-actions";
import { getRootInvoiceDetail } from "@/lib/root-data";
import { resolveRootBrand } from "@/lib/root-brand";

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toneForStatus(value: string | null | undefined): "default" | "accent" | "warn" | "success" {
  const lowered = String(value || "").toLowerCase();
  if (lowered.includes("paid") || lowered.includes("settled") || lowered.includes("ready")) return "success";
  if (lowered.includes("partial") || lowered.includes("review")) return "accent";
  if (lowered.includes("draft") || lowered.includes("missing") || lowered.includes("pending") || lowered.includes("unpaid")) return "warn";
  return "default";
}

function sanitizeMailtoValue(value: string) {
  return encodeURIComponent(value.replace(/\r?\n/g, "\n"));
}

function absoluteOriginFromHeaders(headerStore: Headers) {
  const host =
    headerStore.get("x-forwarded-host") ||
    headerStore.get("host") ||
    "127.0.0.1:4100";
  const proto =
    headerStore.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function RootInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));
  const origin = absoluteOriginFromHeaders(headerStore);
  const detail = await getRootInvoiceDetail(id, brand.defaultBusinessUnit as "ACS" | "CC");

  if (!detail.invoice) {
    notFound();
  }

  const invoice = detail.invoice;
  const previewUrl = `${origin}/api/root/invoices/${invoice.id}/preview`;
  const pdfUrl = `${origin}/api/root/invoices/${invoice.id}/pdf`;
  const sharePageUrl = `${origin}/share/invoice/${invoice.id}`;
  const payLinkUrl = invoice.stripe_payment_link || "";
  const shareLinkUrl = payLinkUrl || sharePageUrl;
  const sendMailHref = invoice.contact_email
    ? `mailto:${invoice.contact_email}?subject=${sanitizeMailtoValue(
        `${invoice.invoice_number || "Invoice"} from ${brand.key === "acs" ? "Astro Cleanings" : "Content Co-op"}`,
      )}&body=${sanitizeMailtoValue(
        [
          `Hi ${invoice.contact_name || "there"},`,
          "",
          `Your invoice ${invoice.invoice_number || invoice.id.slice(0, 8)} is ready.`,
          payLinkUrl ? `Pay online: ${payLinkUrl}` : `Preview: ${previewUrl}`,
          `PDF: ${pdfUrl}`,
          "",
          "Reply here if you need anything adjusted.",
        ].join("\n"),
      )}`
    : null;
  const readinessFlags = [
    invoice.line_items.length === 0 ? "missing line items" : null,
    !invoice.stripe_payment_link ? "payment link missing" : null,
    !invoice.contact_email && !invoice.contact_phone ? "missing client reachability" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="root-atlas-page" style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={kickerStyle}>invoice workspace</div>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={titleStyle}>
              {invoice.invoice_number || `invoice ${invoice.id.slice(0, 8).toUpperCase()}`}
            </h1>
            <div style={subtitleStyle}>
              {invoice.contact_name || "unknown client"}
              {invoice.contact_company ? ` · ${invoice.contact_company}` : ""}
              {invoice.source_quote?.quote_number ? ` · from ${invoice.source_quote.quote_number}` : ""}
            </div>
          </div>
          <div style={chipRowStyle}>
            <Chip label="workspace" value={String(invoice.business_unit || brand.defaultBusinessUnit)} tone="accent" />
            <Chip label="invoice" value={String(invoice.invoice_status || "draft")} tone={toneForStatus(invoice.invoice_status)} />
            <Chip label="payment" value={String(invoice.payment_status || "unpaid")} tone={toneForStatus(invoice.payment_status)} />
            <Chip label="balance" value={formatMoney(invoice.balance_due)} tone={toneForStatus(invoice.payment_status)} />
            <Chip label="due" value={formatDate(invoice.due_date || invoice.due_at)} tone={toneForStatus(invoice.payment_link_status)} />
          </div>
        </div>

        <div style={actionRailStyle}>
          <div style={actionGroupStyle}>
            <Link href="/root/invoices" className="root-atlas-button root-atlas-button-secondary">back to invoices</Link>
            <a href={previewUrl} target="_blank" rel="noreferrer" className="root-atlas-button root-atlas-button-secondary">preview</a>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="root-atlas-button root-atlas-button-primary">export pdf</a>
          </div>
          {/* Interactive actions: Record Payment, Reminder, Void, Split */}
          <div style={{ ...actionGroupStyle, justifyContent: "flex-end" }}>
            <InvoiceDetailActions
              invoiceId={invoice.id}
              invoiceNumber={String(invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase())}
              total={Number(invoice.amount_due || 0)}
              balanceDue={Number(invoice.balance_due || 0)}
              clientEmail={invoice.contact_email}
              clientName={invoice.contact_name}
            />
          </div>
          <div style={actionGroupStyle}>
            {invoice.stripe_payment_link ? (
              <>
                <a href={payLinkUrl} target="_blank" rel="noreferrer" className="root-atlas-button root-atlas-button-secondary">open pay link</a>
                <CopyLinkButton href={payLinkUrl} className="root-atlas-button root-atlas-button-secondary" label="copy pay link" />
              </>
            ) : (
              <GeneratePayLinkButton invoiceId={invoice.id} className="root-atlas-button root-atlas-button-primary" />
            )}
            <CopyLinkButton href={sharePageUrl} className="root-atlas-button root-atlas-button-secondary" label="copy share link" />
            <a href={sharePageUrl} target="_blank" rel="noreferrer" className="root-atlas-button root-atlas-button-secondary">open share page</a>
            {sendMailHref ? (
              <a href={sendMailHref} className="root-atlas-button root-atlas-button-secondary">send / resend</a>
            ) : null}
            {invoice.source_quote?.id ? (
              <Link href={`/root/quotes/${invoice.source_quote.id}`} className="root-atlas-button root-atlas-button-secondary">open source quote</Link>
            ) : null}
          </div>
        </div>
      </section>

      <section style={summaryGridStyle}>
        <MetricCard label="invoice total" value={formatMoney(invoice.amount_due)} note="canonical document amount" />
        <MetricCard label="paid" value={formatMoney(invoice.paid_amount)} note={`${invoice.payment_count || 0} recorded payments`} tone="success" />
        <MetricCard label="balance due" value={formatMoney(invoice.balance_due)} note={invoice.next_action || "review before send"} tone={toneForStatus(invoice.payment_status)} />
        <MetricCard label="collections" value={String(invoice.reminder_status || "none")} note={invoice.payment_link_status || "payment link missing"} tone={toneForStatus(invoice.payment_link_status)} />
      </section>

      <section style={workspaceGridStyle}>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>invoice body</h2>
              <div style={panelMetaStyle}>{invoice.line_items.length} line items</div>
            </div>
            {invoice.line_items.length === 0 ? (
              <div style={warningBlockStyle}>
                No scoped line items were recovered for this invoice yet. Treat this as an integrity issue before sending or exporting.
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={headCellStyle}>description</th>
                    <th style={headCellStyle}>phase</th>
                    <th style={{ ...headCellStyle, textAlign: "right" }}>qty</th>
                    <th style={{ ...headCellStyle, textAlign: "right" }}>unit</th>
                    <th style={{ ...headCellStyle, textAlign: "right" }}>total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items.map((item) => (
                    <tr key={item.id}>
                      <td style={bodyCellStyle}>
                        <div style={{ display: "grid", gap: 3 }}>
                          <strong>{item.description}</strong>
                          <span style={mutedMetaStyle}>{formatMoney(item.unit_price)} each</span>
                        </div>
                      </td>
                      <td style={bodyCellStyle}>{item.phase_name}</td>
                      <td style={{ ...bodyCellStyle, textAlign: "right" }}>{item.quantity}</td>
                      <td style={{ ...bodyCellStyle, textAlign: "right" }}>{item.unit}</td>
                      <td style={{ ...bodyCellStyle, textAlign: "right", fontWeight: 700 }}>{formatMoney(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>notes and payment terms</h2>
              <div style={panelMetaStyle}>customer-facing document context</div>
            </div>
            <div style={noteBlockStyle}>
              {invoice.notes?.trim()
                ? invoice.notes
                : invoice.source_quote?.payment_terms
                  ? `Payment terms: ${invoice.source_quote.payment_terms}`
                  : "No invoice notes captured yet."}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>payment ledger</h2>
              <div style={panelMetaStyle}>{invoice.payments.length} payment records</div>
            </div>
            {invoice.payments.length === 0 ? (
              <div style={emptyStateStyle}>No invoice payment rows recorded yet.</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={headCellStyle}>method</th>
                    <th style={headCellStyle}>date</th>
                    <th style={headCellStyle}>status</th>
                    <th style={{ ...headCellStyle, textAlign: "right" }}>amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={bodyCellStyle}>{payment.method}</td>
                      <td style={bodyCellStyle}>{formatDate(payment.created_at)}</td>
                      <td style={bodyCellStyle}>{payment.status}</td>
                      <td style={{ ...bodyCellStyle, textAlign: "right", fontWeight: 700 }}>{formatMoney(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside style={{ display: "grid", gap: 14 }}>
          <div style={sidePanelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>billing state</h2>
              <div style={panelMetaStyle}>collections rail</div>
            </div>
            <Field label="invoice status" value={String(invoice.invoice_status || "draft")} />
            <Field label="payment status" value={String(invoice.payment_status || "unpaid")} />
            <Field label="payment link" value={String(invoice.payment_link_status || "missing")} />
            <Field label="reconciliation" value={String(invoice.reconciliation_status || "pending")} />
            <Field label="next action" value={String(invoice.next_action || "review before send")} />
            <Field label="last reminder" value={formatDate(invoice.last_reminder_at, "none")} />
          </div>

          <div style={sidePanelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>client and source</h2>
              <div style={panelMetaStyle}>contact continuity</div>
            </div>
            <Field label="client" value={String(invoice.contact_name || "—")} />
            <Field label="company" value={String(invoice.contact_company || "—")} />
            <Field label="email" value={String(invoice.contact_email || "—")} />
            <Field label="phone" value={String(invoice.contact_phone || "—")} />
            <Field label="source quote" value={invoice.source_quote?.quote_number || "none"} />
            <Field label="quote status" value={invoice.source_quote?.internal_status || "—"} />
            <Field label="quote terms" value={invoice.source_quote?.payment_terms || "—"} />
          </div>

          <div style={sidePanelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>artifact readiness</h2>
              <div style={panelMetaStyle}>preview, export, share</div>
            </div>
            <Field label="document" value={invoice.line_items.length > 0 ? "preview ready" : "not ready"} />
            <Field label="preview" value="available" />
            <Field label="pdf export" value="available" />
            <Field label="share link" value={invoice.stripe_payment_link ? "payment link ready" : "preview link fallback"} />
            <Field label="fingerprint" value={invoice.id.slice(0, 8).toUpperCase()} mono />
          </div>

          {readinessFlags.length > 0 ? (
            <div style={warningPanelStyle}>
              <div style={panelHeaderStyle}>
                <h2 style={panelTitleStyle}>issues to resolve</h2>
                <div style={panelMetaStyle}>before send or collection</div>
              </div>
              <ul style={warningListStyle}>
                {readinessFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "accent" | "warn" | "success";
}) {
  const color =
    tone === "success" ? "#9ce7ba" :
    tone === "warn" ? "#f3c778" :
    tone === "accent" ? "var(--root-accent)" :
    "var(--root-ink, var(--ink))";

  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={{ ...metricValueStyle, color }}>{value}</div>
      <div style={mutedMetaStyle}>{note}</div>
    </div>
  );
}

function Chip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warn" | "success";
}) {
  return (
    <span style={{ ...chipStyle, ...chipToneStyles[tone] }}>
      <strong>{label}</strong>
      <span>{value}</span>
    </span>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={{ ...fieldValueStyle, ...(mono ? monoFieldStyle : null) }}>{value || "—"}</div>
    </div>
  );
}

/* ── Brand-center v2 tokens ── */
const G = "rgba(74,222,128,";
const LINE = `${G}0.10)`;
const MONO = "var(--font-mono)";
const MUTED = "var(--root-muted, var(--muted))";

const pageStyle: CSSProperties = {
  maxWidth: 1280,
  display: "grid",
  gap: 16,
};

const heroStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
  gap: 18,
  alignItems: "start",
  borderRadius: 22,
  border: `1px solid ${LINE}`,
  background: `radial-gradient(ellipse 55% 50% at 10% 40%, ${G}0.07), transparent), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012))`,
  padding: 20,
  boxShadow: "0 14px 40px rgba(0,0,0,0.12)",
  overflow: "hidden",
};

const kickerStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.56rem",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--root-accent)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body), sans-serif",
  fontSize: "1.3rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.1,
};

const subtitleStyle: CSSProperties = {
  color: MUTED,
  fontSize: "0.84rem",
  lineHeight: 1.45,
  opacity: 0.85,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: 999,
  border: `1px solid ${LINE}`,
  background: "rgba(255,255,255,0.02)",
  fontFamily: MONO,
  fontSize: "0.6rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
};

const chipToneStyles: Record<string, CSSProperties> = {
  default: { color: "var(--root-ink, var(--ink))" },
  accent: { color: "var(--root-accent)", borderColor: `${G}0.18)` },
  warn: { color: "#f3c778", borderColor: "rgba(243,199,120,0.2)" },
  success: { color: "#9ce7ba", borderColor: "rgba(156,231,186,0.2)" },
};

const actionRailStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "stretch",
};

const actionGroupStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const metricCardStyle: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${LINE}`,
  background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
  padding: "16px 18px",
  display: "grid",
  gap: 6,
  transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
};

const metricLabelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.52rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
  opacity: 0.8,
};

const metricValueStyle: CSSProperties = {
  fontSize: "1.35rem",
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const workspaceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.75fr)",
  gap: 16,
  alignItems: "start",
};

const panelStyle: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${LINE}`,
  background: `radial-gradient(ellipse 80% 40% at 20% 0%, ${G}0.03), transparent), rgba(255,255,255,0.015)`,
  padding: 18,
  display: "grid",
  gap: 12,
};

const sidePanelStyle: CSSProperties = {
  ...panelStyle,
  gap: 10,
  padding: 16,
};

const warningPanelStyle: CSSProperties = {
  ...panelStyle,
  border: "1px solid rgba(243,199,120,0.25)",
  background: "rgba(243,199,120,0.06)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",
};

const panelMetaStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.56rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
  opacity: 0.7,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const headCellStyle: CSSProperties = {
  padding: "10px 0 9px",
  borderBottom: `1px solid ${LINE}`,
  fontFamily: MONO,
  fontSize: "0.52rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: `${G}0.7)`,
};

const bodyCellStyle: CSSProperties = {
  padding: "11px 0",
  borderBottom: "1px solid rgba(255,255,255,0.035)",
  fontSize: "0.84rem",
  verticalAlign: "top",
};

const noteBlockStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  lineHeight: 1.65,
  fontSize: "0.86rem",
  color: "var(--root-ink, var(--ink))",
};

const warningBlockStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(243,199,120,0.2)",
  background: "rgba(243,199,120,0.06)",
  color: "#f3c778",
  padding: "12px 14px",
  lineHeight: 1.55,
  fontSize: "0.82rem",
};

const emptyStateStyle: CSSProperties = {
  color: MUTED,
  fontSize: "0.8rem",
  lineHeight: 1.5,
};

const mutedMetaStyle: CSSProperties = {
  color: MUTED,
  fontSize: "0.68rem",
  lineHeight: 1.45,
  opacity: 0.75,
};

const fieldLabelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.52rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
  opacity: 0.8,
};

const fieldValueStyle: CSSProperties = {
  fontSize: "0.86rem",
  fontWeight: 700,
  lineHeight: 1.4,
};

const monoFieldStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.74rem",
};

const warningListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: "grid",
  gap: 6,
};
