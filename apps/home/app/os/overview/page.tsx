import Link from "next/link";
import { buildRootOverviewReadModel, type RootOverviewJob } from "@/lib/os-overview";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "No recent timestamp";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLatency(value: number) {
  return `${Math.round(value)}ms`;
}

function JobRow({ job, featured = false }: { job: RootOverviewJob; featured?: boolean }) {
  const completed = job.bucket === "completed" || job.status.toLowerCase() === "completed";
  return (
    <div className={`${styles.row} ${featured ? styles.nextWork : ""}`}>
      <div>
        <p className={styles.rowTitle}>{job.title}</p>
        <p className={styles.rowMeta}>
          {job.clientName || "Unassigned contact"} ·{" "}
          {completed
            ? `completed ${formatDate(job.completedAt)}`
            : `scheduled ${formatDate(job.scheduledDate)}`}
        </p>
      </div>
      <div className={styles.rowValue}>
        <div>{formatCurrency(job.totalAmount)}</div>
        <span className={styles.pill}>{job.status}</span>
      </div>
    </div>
  );
}

export default async function OverviewPage() {
  const model = await buildRootOverviewReadModel();
  const slowestEntry =
    Object.entries(model.diagnostics.timingsMs).sort((a, b) => b[1] - a[1])[0] ?? null;
  const completedJobs = model.recentJobs.filter(
    (job) => job.bucket === "completed" || job.status.toLowerCase() === "completed",
  );
  const openJobs = model.recentJobs.filter((job) => !completedJobs.includes(job));
  const scheduledJobs = openJobs
    .filter((job) => job.status.toLowerCase() === "scheduled" && job.scheduledDate && Number.isFinite(Date.parse(job.scheduledDate)))
    .sort((a, b) => Date.parse(a.scheduledDate!) - Date.parse(b.scheduledDate!));
  const nextDate = scheduledJobs[0]?.scheduledDate;
  const nextJobs = scheduledJobs.filter((job) => job.scheduledDate === nextDate);
  const laterJobs = scheduledJobs.filter((job) => job.scheduledDate !== nextDate);
  const otherJobs = openJobs.filter((job) => !scheduledJobs.includes(job));

  return (
    <div className={styles.surface} data-cco-overview>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Operations overview</h1>
          <p className={styles.heroCopy}>
            Scheduled work, recent quotes and contact activity.
          </p>
        </div>
        <span className={styles.metaBadge} data-status={model.diagnostics.status}>
          Data reads: {model.diagnostics.status}
        </span>
        {model.diagnostics.warnings.length > 0 ? (
          <ul className={styles.warningList} aria-label="Read warnings">
            {model.diagnostics.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <section className={styles.gridFour} aria-label="Overview totals">
        {model.summary.cards.map((card) => (
          <article
            key={card.label}
            className={[
              styles.card,
              card.tone === "positive"
                ? styles.cardTonePositive
                : card.tone === "warning"
                  ? styles.cardToneWarning
                  : styles.cardToneNeutral,
            ].join(" ")}
          >
            <div className={styles.cardLabel}>{card.label}</div>
            <div className={styles.cardValue}>{card.value.toLocaleString()}</div>
            <div className={styles.cardDetail}>{card.detail}</div>
          </article>
        ))}
      </section>

      <section className={styles.sectionGrid}>
        <article className={`${styles.panel} ${styles.workPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Work and closeout</h2>
            </div>
            <Link className={styles.panelAction} href="/os/dispatch">
              Open dispatch
            </Link>
          </div>
          {nextJobs.length > 0 && (
            <div className={styles.nextGroup}>
              <h3 className={styles.workGroupTitle}>Next scheduled</h3>
              <div className={styles.list}>
                {nextJobs.map((job, index) => <JobRow key={`${job.id}-${index}`} job={job} featured />)}
              </div>
            </div>
          )}
          {laterJobs.length > 0 && (
            <div>
              <h3 className={styles.workGroupTitle}>Later scheduled</h3>
              <div className={styles.list}>
                {laterJobs.map((job, index) => <JobRow key={`${job.id}-${index}`} job={job} />)}
              </div>
            </div>
          )}
          {otherJobs.length > 0 && (
            <div>
              <h3 className={styles.workGroupTitle}>Other work</h3>
              <div className={styles.list}>
                {otherJobs.map((job, index) => <JobRow key={`${job.id}-${index}`} job={job} />)}
              </div>
            </div>
          )}
          {completedJobs.length > 0 && (
            <details className={styles.completedWork}>
              <summary>Recent completed work</summary>
              <div className={styles.list}>
                {completedJobs.map((job, index) => <JobRow key={`${job.id}-${index}`} job={job} />)}
              </div>
            </details>
          )}
          {model.recentJobs.length === 0 && (
            <p className={styles.empty}>No recent job activity was loaded for this workspace.</p>
          )}
        </article>

        <article className={`${styles.panel} ${styles.quotePanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Recent quotes</h2>
            </div>
            <Link className={styles.panelAction} href="/os/quotes">
              Open quotes
            </Link>
          </div>
          <div className={styles.list}>
            {model.recentQuotes.length > 0 ? (
              model.recentQuotes.map((quote) => (
                <div key={quote.id} className={styles.row}>
                  <div>
                    <p className={styles.rowTitle}>{quote.clientName}</p>
                    <p className={styles.rowMeta}>
                      {quote.quoteNumber} · {quote.businessUnit} · created {formatDate(quote.createdAt)}
                    </p>
                  </div>
                  <div className={styles.rowValue}>
                    <div>{formatCurrency(quote.estimatedTotal)}</div>
                    <span className={styles.pill}>{quote.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No recent quote activity was loaded for this workspace.</p>
            )}
          </div>
        </article>
      </section>

      <section className={styles.systemGrid}>
        <article className={`${styles.panel} ${styles.contactPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Contacts</h2>
            </div>
            <Link className={styles.panelAction} href="/os/contacts">
              Open contacts
            </Link>
          </div>
          <div className={styles.list}>
            {model.contactsSnapshot.length > 0 ? (
              model.contactsSnapshot.map((contact) => (
                <div key={contact.id} className={styles.row}>
                  <div>
                    <p className={styles.rowTitle}>{contact.name}</p>
                    <p className={styles.rowMeta}>
                      {contact.company || contact.email || "No company or email recorded"} ·{" "}
                      {contact.contactType || "untyped contact"}
                    </p>
                  </div>
                  <div className={styles.rowValue}>
                    <div>priority {contact.priorityScore ?? 0}</div>
                    <span className={styles.pill}>
                      {contact.lastContacted ? formatDate(contact.lastContacted) : "no touchpoint"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No contact snapshot is available for this workspace yet.</p>
            )}
          </div>
        </article>

      </section>

      <footer className={styles.systemPanel}>
        <details className={styles.systemDetails}>
          <summary>Read diagnostics</summary>
          <div className={styles.diagnostics}>
            <div className={styles.diagnosticsRow}>
              <span>Route classification</span>
              <strong>{model.diagnostics.status}</strong>
            </div>
            <div className={styles.diagnosticsRow}>
              <span>Total overview load</span>
              <strong>{formatLatency(model.diagnostics.totalMs)}</strong>
            </div>
            <div className={styles.diagnosticsRow}>
              <span>Payload</span>
              <strong>{model.diagnostics.payloadBytes.toLocaleString()} bytes</strong>
            </div>
            {slowestEntry ? (
              <div className={styles.diagnosticsRow}>
                <span>Slowest read: {slowestEntry[0]}</span>
                <strong>{formatLatency(slowestEntry[1])}</strong>
              </div>
            ) : null}
            <div className={styles.diagnosticsRow}>
              <span>Quotes lane</span>
              <strong>{model.summary.quotesTotal.toLocaleString()} total</strong>
            </div>
            <div className={styles.diagnosticsRow}>
              <span>Jobs lane</span>
              <strong>{model.summary.jobsTotal.toLocaleString()} total</strong>
            </div>
          </div>
          {model.diagnostics.warnings.length === 0 ? (
            <p className={styles.empty}>
              No query warnings on this render.
            </p>
          ) : null}
        </details>
        <Link className={styles.panelAction} href="/os/system">
          Open system
        </Link>
      </footer>
    </div>
  );
}
