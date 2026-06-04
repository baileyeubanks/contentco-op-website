import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getRootContactDossier, type RootContactListRecord } from "@/lib/root-data";
import { getContactTimeline, getContactRelationships } from "@/lib/root-contacts-engine";
import { resolveRootBrand } from "@/lib/root-brand";

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

function toneForBand(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "priority") return { background: "rgba(74,222,128,0.16)", color: "#4ade80", border: "rgba(74,222,128,0.35)" };
  if (normalized === "active") return { background: "rgba(96,165,250,0.14)", color: "#60a5fa", border: "rgba(96,165,250,0.32)" };
  if (normalized === "warming") return { background: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "rgba(245,158,11,0.32)" };
  return { background: "rgba(148,163,184,0.12)", color: "#cbd5e1", border: "rgba(148,163,184,0.24)" };
}

function Chip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success" | "warning";
}) {
  const palette =
    tone === "accent"
      ? { background: "rgba(96,165,250,0.14)", color: "#60a5fa", border: "rgba(96,165,250,0.28)" }
      : tone === "success"
        ? { background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "rgba(74,222,128,0.28)" }
        : tone === "warning"
          ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.28)" }
          : { background: "rgba(148,163,184,0.12)", color: "#dbe4ee", border: "rgba(148,163,184,0.22)" };

  return (
    <div
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        padding: "7px 12px",
        fontSize: 12,
      }}
    >
      <span style={{ opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 10 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.16)",
        borderRadius: 18,
        padding: 18,
        background: "rgba(5,10,20,0.78)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, color: "rgba(203,213,225,0.62)", textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</div>
      <div style={{ fontSize: 28, color: "#f8fafc", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 13, color: "rgba(203,213,225,0.68)" }}>{note}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, color: "rgba(203,213,225,0.6)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ fontSize: 15, color: "#f8fafc" }}>{value || "—"}</div>
    </div>
  );
}

type RootContactDossierQuote = {
  id: string;
  quote_number: string | null;
  estimated_total?: number | null;
  total?: number | null;
  client_status?: string | null;
  internal_status?: string | null;
};

type RootContactDossierInvoice = {
  id: string;
  invoice_number: string | null;
  total?: number | null;
  amount?: number | null;
  payment_status?: string | null;
  status?: string | null;
};

type RootContactBusinessMembership = {
  business_id: string;
  code: "ACS" | "CC";
  name: string;
};

type RootContactRelationship = {
  id: string;
  relationship_type?: string | null;
  role?: string | null;
  companies?: {
    name?: string | null;
  } | null;
};

type RootContactTimelineItem = {
  id: string;
  source: string;
  label: string;
  detail?: string | null;
  type?: string | null;
  created_at: string | null;
};

type RootContactDetailDossier = RootContactListRecord & {
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
  quotes: RootContactDossierQuote[];
  invoices: RootContactDossierInvoice[];
  overdue_amount: number;
  business_memberships: RootContactBusinessMembership[];
};

export default async function RootContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerStore = await headers();
  const brand = resolveRootBrand(headerStore.get("host"), headerStore.get("x-root-brand"));

  const [detail, timelineResult, relationshipResult] = await Promise.all([
    getRootContactDossier(id, null),
    getContactTimeline(id, 80),
    getContactRelationships(id),
  ]);

  if (!detail.dossier) notFound();

  const contact = detail.dossier as RootContactDetailDossier;
  const timeline = (timelineResult.timeline || []) as RootContactTimelineItem[];
  const relationships = (relationshipResult.relationships || []) as RootContactRelationship[];
  const workspaces = Array.isArray(contact.workspace_memberships) ? contact.workspace_memberships : [];
  const relationshipBand = toneForBand(contact.relationship_band);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(96,165,250,0.16), transparent 32%), radial-gradient(circle at top right, rgba(74,222,128,0.12), transparent 28%), #020617",
        color: "#e2e8f0",
        padding: "28px 32px 48px",
        display: "grid",
        gap: 22,
      }}
    >
      <section
        style={{
          border: "1px solid rgba(148,163,184,0.16)",
          borderRadius: 28,
          background: "rgba(2,6,23,0.86)",
          padding: 28,
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: brand.accent }}>
              root contact dossier
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.04, color: "#f8fafc" }}>{contact.full_name}</h1>
              <div style={{ fontSize: 18, color: "rgba(226,232,240,0.74)" }}>
                {contact.company || "No company set"}
                {contact.client_code ? ` · client code ${contact.client_code}` : ""}
                {contact.account_code ? ` · acct ${contact.account_code}` : ""}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Link
              href="/root/contacts"
              style={{
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.22)",
                color: "#e2e8f0",
                textDecoration: "none",
                padding: "10px 14px",
                fontSize: 13,
              }}
            >
              back to contacts
            </Link>
            <Link
              href={`/root/quotes?contact_id=${contact.id}`}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(96,165,250,0.28)",
                color: "#60a5fa",
                textDecoration: "none",
                padding: "10px 14px",
                fontSize: 13,
              }}
            >
              related quotes
            </Link>
            <Link
              href={`/root/invoices?contact_id=${contact.id}`}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(74,222,128,0.28)",
                color: "#4ade80",
                textDecoration: "none",
                padding: "10px 14px",
                fontSize: 13,
              }}
            >
              related invoices
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              borderRadius: 999,
              border: `1px solid ${relationshipBand.border}`,
              background: relationshipBand.background,
              color: relationshipBand.color,
              padding: "7px 12px",
              fontSize: 12,
            }}
          >
            <span style={{ opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 10 }}>relationship</span>
            <span style={{ fontWeight: 700 }}>{contact.relationship_rank || 0}</span>
            <span>{contact.relationship_band || "monitor"}</span>
          </div>
          <Chip label="source" value={String(contact.source || "unknown")} tone="accent" />
          <Chip label="channel" value={String(contact.preferred_channel || "unassigned")} tone="default" />
          <Chip label="lead" value={String(contact.lead_score || 0)} tone="default" />
          <Chip label="sentiment" value={String(contact.sentiment_trend || "neutral")} tone="warning" />
          {workspaces.map((workspace: string) => (
            <Chip key={workspace} label="workspace" value={workspace} tone={workspace === "ACS" ? "accent" : "success"} />
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
        <MetricCard label="relationship rank" value={String(contact.relationship_rank || 0)} note={String(contact.next_best_action || "review relationship")} />
        <MetricCard label="lifetime revenue" value={formatMoney(contact.total_revenue)} note={`${contact.paid_invoice_count || 0} paid invoices`} />
        <MetricCard label="outstanding" value={formatMoney(contact.outstanding_balance)} note={`${contact.open_invoice_count || 0} open invoices`} />
        <MetricCard label="quotes" value={String(contact.quote_count || 0)} note={`${contact.accepted_quotes || 0} accepted · ${contact.open_quote_count || 0} open`} />
        <MetricCard label="conversation lanes" value={String(contact.open_conversation_count || 0)} note={String((contact.conversation_channels || []).join(" · ") || "no active lane")} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 22,
              background: "rgba(3,7,18,0.84)",
              padding: 22,
              display: "grid",
              gap: 18,
            }}
          >
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(203,213,225,0.62)" }}>
              profile and memory
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <Field label="Email" value={String(contact.email || "—")} />
              <Field label="Phone" value={String(contact.phone || "—")} />
              <Field label="Status" value={String(contact.status || contact.lead_status || "active")} />
              <Field label="Contact type" value={String(contact.contact_type || contact.lifecycle || "customer")} />
              <Field label="Orbit tier" value={String(contact.orbit_tier || "unset")} />
              <Field label="Last activity" value={formatDate(contact.last_activity || contact.created_at)} />
              <Field label="Last conversation" value={formatDate(contact.last_conversation_at)} />
              <Field label="Total jobs" value={String(contact.total_jobs || 0)} />
              <Field label="Preferences" value={String(contact.preferences_summary || "No reviewed preference memory yet")} />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(203,213,225,0.6)" }}>tags</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(contact.tags || []).length ? (
                  (contact.tags || []).map((tag: string) => (
                    <span
                      key={tag}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: "rgba(148,163,184,0.12)",
                        border: "1px solid rgba(148,163,184,0.16)",
                        fontSize: 12,
                      }}
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 14, color: "rgba(203,213,225,0.68)" }}>No tags yet.</span>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 22,
              background: "rgba(3,7,18,0.84)",
              padding: 22,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(203,213,225,0.62)" }}>
              finance and quoting
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 8, fontSize: 13, color: "#f8fafc", fontWeight: 600 }}>Quotes</div>
                {(contact.quotes || []).length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(contact.quotes || []).slice(0, 6).map((quote) => (
                      <Link
                        key={quote.id}
                        href={`/root/quotes/${quote.id}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.1fr auto auto",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 16,
                          border: "1px solid rgba(148,163,184,0.14)",
                          background: "rgba(15,23,42,0.58)",
                          textDecoration: "none",
                          color: "#e2e8f0",
                        }}
                      >
                        <span>{quote.quote_number || String(quote.id || "").slice(0, 8)}</span>
                        <span>{formatMoney(quote.estimated_total || quote.total)}</span>
                        <span style={{ color: "rgba(203,213,225,0.72)" }}>{quote.client_status || quote.internal_status || "draft"}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: "rgba(203,213,225,0.68)" }}>No linked quotes yet.</div>
                )}
              </div>

              <div>
                <div style={{ marginBottom: 8, fontSize: 13, color: "#f8fafc", fontWeight: 600 }}>Invoices</div>
                {(contact.invoices || []).length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(contact.invoices || []).slice(0, 6).map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/root/invoices/${invoice.id}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.1fr auto auto",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 16,
                          border: "1px solid rgba(148,163,184,0.14)",
                          background: "rgba(15,23,42,0.58)",
                          textDecoration: "none",
                          color: "#e2e8f0",
                        }}
                      >
                        <span>{invoice.invoice_number || String(invoice.id || "").slice(0, 8)}</span>
                        <span>{formatMoney(invoice.total || invoice.amount)}</span>
                        <span style={{ color: "rgba(203,213,225,0.72)" }}>{invoice.payment_status || invoice.status || "draft"}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: "rgba(203,213,225,0.68)" }}>No linked invoices yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 22,
              background: "rgba(3,7,18,0.84)",
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(203,213,225,0.62)" }}>
              business separation
            </div>
            {(contact.business_memberships || []).length ? (
              (contact.business_memberships || []).map((entry) => (
                <div
                  key={`${entry.business_id}-${entry.code}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: "1px solid rgba(148,163,184,0.14)",
                    background: "rgba(15,23,42,0.58)",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#f8fafc", fontWeight: 600 }}>{entry.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(203,213,225,0.64)" }}>{entry.business_id}</div>
                  </div>
                  <div style={{ color: entry.code === "ACS" ? "#60a5fa" : "#4ade80", fontWeight: 700 }}>{entry.code}</div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 14, color: "rgba(203,213,225,0.68)" }}>No business membership rows linked yet.</div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 22,
              background: "rgba(3,7,18,0.84)",
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(203,213,225,0.62)" }}>
              relationships
            </div>
            {relationships.length ? (
              relationships.map((relationship) => (
                <div
                  key={relationship.id}
                  style={{
                    display: "grid",
                    gap: 4,
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: "1px solid rgba(148,163,184,0.14)",
                    background: "rgba(15,23,42,0.58)",
                  }}
                >
                  <div style={{ color: "#f8fafc", fontWeight: 600 }}>
                    {relationship.companies?.name || "Linked company"}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(203,213,225,0.72)" }}>
                    {relationship.relationship_type || "relationship"}{relationship.role ? ` · ${relationship.role}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 14, color: "rgba(203,213,225,0.68)" }}>No relationship rows linked yet.</div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 22,
              background: "rgba(3,7,18,0.84)",
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(203,213,225,0.62)" }}>
              timeline
            </div>
            {timeline.length ? (
              timeline.slice(0, 14).map((item) => (
                <div
                  key={`${item.source}-${item.id}`}
                  style={{
                    display: "grid",
                    gap: 4,
                    paddingBottom: 12,
                    borderBottom: "1px solid rgba(148,163,184,0.1)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ color: "#f8fafc", fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(203,213,225,0.62)" }}>{formatDate(item.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(203,213,225,0.72)" }}>
                    {item.detail || item.type || item.source}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 14, color: "rgba(203,213,225,0.68)" }}>No timeline events recovered yet.</div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
