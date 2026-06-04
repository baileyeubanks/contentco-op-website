import Link from "next/link";
import { buildCcoAdminReadModel } from "@/lib/cco-admin-model";
import { ProposalWorkbench } from "./proposal-workbench";
import s from "./page.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function CcoAdminPage() {
  const model = buildCcoAdminReadModel();
  const estimate = model.queues.estimates[0];
  const brief = model.queues.briefs.find((item) => item.id === estimate.briefId) || model.queues.briefs[0];
  const lead = model.queues.leads.find((item) => item.id === brief.personId) || model.queues.leads[0];

  return (
    <main className={s.surface}>
      <aside className={s.sidebar}>
        <Link className={s.brand} href="/">
          <span>CCO</span>
          <strong>Admin</strong>
        </Link>
        <nav className={s.nav} aria-label="CCO admin modules">
          {[
            "Dashboard",
            "Leads & Clients",
            "Brief Queue",
            "Estimate Workbench",
            "Approval Queue",
            "Discovery Bookings",
            "Co-App Handoffs",
            "Settings",
            "Audit",
          ].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              {item}
            </a>
          ))}
        </nav>
        <div className={s.authBox}>
          <span>Seeded admins</span>
          {model.adminUsers.map((admin) => (
            <strong key={admin.email}>{admin.email}</strong>
          ))}
        </div>
      </aside>

      <section className={s.content}>
        <header className={s.hero} id="dashboard">
          <div>
            <p className={s.kicker}>CCO Mission Control</p>
            <h1>Brief-to-proposal command surface.</h1>
            <p>
              Firebase is the system of record for leads, briefs, proposals, booking, approvals,
              email queueing, audit events, and the co-app handoff graph.
            </p>
          </div>
          <div className={s.statusPanel}>
            <span>Firebase mode</span>
            <strong>{model.firebase.mode}</strong>
            <small>{model.firebase.note}</small>
          </div>
        </header>

        <section className={s.metrics} aria-label="CCO dashboard metrics">
          {[
            ["New leads", model.metrics.newLeads],
            ["Briefs in review", model.metrics.briefsInReview],
            ["Proposals pending", model.metrics.proposalsPendingApproval],
            ["Discovery bookings", model.metrics.discoveryBookings],
            ["Handoffs ready", model.metrics.handoffsReady],
          ].map(([label, value]) => (
            <article className={s.metric} key={label}>
              <span>{label}</span>
              <strong>{formatMetric(Number(value))}</strong>
            </article>
          ))}
        </section>

        <section className={s.twoColumn}>
          <article className={s.panel} id="leads-clients">
            <div className={s.panelHeader}>
              <div>
                <p className={s.kicker}>Leads & Clients</p>
                <h2>Lead capture queue</h2>
              </div>
              <Link href="/brief">Public brief</Link>
            </div>
            <div className={s.rows}>
              {model.queues.leads.map((item) => (
                <div className={s.row} key={item.id}>
                  <div>
                    <strong>{item.fullName}</strong>
                    <span>{item.email}</span>
                  </div>
                  <small>{item.lifecycleStage}</small>
                </div>
              ))}
            </div>
          </article>

          <article className={s.panel} id="brief-queue">
            <div className={s.panelHeader}>
              <div>
                <p className={s.kicker}>Brief Queue</p>
                <h2>Proposal-ready intake</h2>
              </div>
              <Link href={`/book?brief=${brief.id}&email=${lead.email}&name=${lead.fullName}`}>Book call</Link>
            </div>
            <div className={s.rows}>
              {model.queues.briefs.map((item) => (
                <div className={s.row} key={item.id}>
                  <div>
                    <strong>{item.projectName}</strong>
                    <span>{item.briefNumber} · {item.projectTypes.join(", ")}</span>
                  </div>
                  <small>{item.readinessScore}% ready</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section id="estimate-workbench">
          <ProposalWorkbench
            estimate={estimate}
            brief={brief}
            lead={lead}
            handoffs={model.queues.handoffs}
          />
        </section>

        <section className={s.twoColumn}>
          <article className={s.panel} id="approval-queue">
            <div className={s.panelHeader}>
              <div>
                <p className={s.kicker}>Approval Queue</p>
                <h2>Internal send gates</h2>
              </div>
              <span className={s.badge}>Owner/Admin only</span>
            </div>
            <div className={s.rows}>
              {model.queues.approvals.map((approval) => (
                <div className={s.row} key={String(approval.id)}>
                  <div>
                    <strong>{String(approval.policyType)}</strong>
                    <span>{String(approval.reason)}</span>
                  </div>
                  <small>{String(approval.status)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className={s.panel} id="discovery-bookings">
            <div className={s.panelHeader}>
              <div>
                <p className={s.kicker}>Discovery Bookings</p>
                <h2>Google Calendar handoff</h2>
              </div>
              <Link href="/book">Open booking</Link>
            </div>
            <div className={s.bookingPreview}>
              <strong>Next booking lane</strong>
              <span>{brief.projectName}</span>
              <small>15/30 minute call, Firestore booking record, Calendar event sync after verified Google credentials.</small>
            </div>
          </article>
        </section>

        <section className={s.panel} id="co-app-handoffs">
          <div className={s.panelHeader}>
            <div>
              <p className={s.kicker}>Co-App Handoffs</p>
              <h2>Structured packets for the product suite</h2>
            </div>
            <span className={s.badge}>Canonical keys</span>
          </div>
          <div className={s.handoffGrid}>
            {model.apps.map((app) => {
              const queue = model.queues.handoffs.find((handoff) => handoff.appKey === app.appKey);
              return (
                <article key={app.appKey} className={s.handoff}>
                  <span>{app.appKey}</span>
                  <strong>{app.appLabel}</strong>
                  <p>{app.purpose}</p>
                  <small>{app.host} · {queue?.status || "not queued"}</small>
                </article>
              );
            })}
          </div>
        </section>

        <section className={s.twoColumn}>
          <article className={s.panel} id="settings">
            <div className={s.panelHeader}>
              <div>
                <p className={s.kicker}>Settings</p>
                <h2>Firestore collection contract</h2>
              </div>
              <span className={s.badge}>Generated IDs</span>
            </div>
            <div className={s.collectionList}>
              {model.collections.map((collection) => (
                <div key={collection.name}>
                  <strong>{collection.name}</strong>
                  <span>{collection.publicWrites ? "public write API" : "admin/server write"}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={s.panel} id="audit">
            <div className={s.panelHeader}>
              <div>
                <p className={s.kicker}>Audit</p>
                <h2>Recent generated state</h2>
              </div>
              <span className={s.badge}>{formatDate(model.generatedAt)}</span>
            </div>
            <div className={s.auditList}>
              <div>
                <strong>public.brief_submitted</strong>
                <span>{brief.id}</span>
              </div>
              <div>
                <strong>system.enrichment_queued</strong>
                <span>Gemini structured output after save</span>
              </div>
              <div>
                <strong>proposal.versioned_pdf_ready</strong>
                <span>Firebase Storage path reserved</span>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
