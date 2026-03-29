import Link from "next/link";
import { buildRootOverviewReadModel } from "@/lib/root-overview";
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

export default async function OverviewPage() {
  const model = await buildRootOverviewReadModel();
  const slowestEntry =
    Object.entries(model.diagnostics.timingsMs).sort((a, b) => b[1] - a[1])[0] ?? null;

  return (
    <main className={styles.surface}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          ROOT runtime reset
        </div>
        <div>
          <h1 className={styles.heroTitle}>Now first. Work visible. System honest.</h1>
          <p className={styles.heroCopy}>
            ROOT is mounted inside HOME right now, so this surface is tuned for the operator
            moment that matters first: what is moving, what is at risk, what needs attention,
            and whether the runtime itself can be trusted.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <span className={styles.metaBadge}>status: {model.diagnostics.status}</span>
          <span className={styles.metaBadge}>server load: {formatLatency(model.diagnostics.totalMs)}</span>
          <span className={styles.metaBadge}>payload: {model.diagnostics.payloadBytes} bytes</span>
          {slowestEntry ? (
            <span className={styles.metaBadge}>
              slowest read: {slowestEntry[0]} · {formatLatency(slowestEntry[1])}
            </span>
          ) : null}
        </div>
      </section>

      <section className={styles.gridFour}>
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
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Movement</p>
              <h2 className={styles.panelTitle}>Recent commercial motion</h2>
            </div>
            <Link className={styles.panelAction} href="/root/quotes">
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

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Work</p>
              <h2 className={styles.panelTitle}>Dispatch and closeout pulse</h2>
            </div>
            <Link className={styles.panelAction} href="/root/dispatch">
              Open dispatch
            </Link>
          </div>
          <div className={styles.list}>
            {model.recentJobs.length > 0 ? (
              model.recentJobs.map((job) => (
                <div key={job.id} className={styles.row}>
                  <div>
                    <p className={styles.rowTitle}>{job.title}</p>
                    <p className={styles.rowMeta}>
                      {(job.clientName || "Unassigned contact")} ·{" "}
                      {job.bucket === "upcoming"
                        ? `scheduled ${formatDate(job.scheduledDate)}`
                        : `completed ${formatDate(job.completedAt)}`}
                    </p>
                  </div>
                  <div className={styles.rowValue}>
                    <div>{formatCurrency(job.totalAmount)}</div>
                    <span className={styles.pill}>{job.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No recent job activity was loaded for this workspace.</p>
            )}
          </div>
        </article>
      </section>

      <section className={styles.systemGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Risk / Trust</p>
              <h2 className={styles.panelTitle}>Contact stewardship</h2>
            </div>
            <Link className={styles.panelAction} href="/root/contacts">
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

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>System</p>
              <h2 className={styles.panelTitle}>Runtime diagnostics</h2>
            </div>
            <Link className={styles.panelAction} href="/root/system">
              Open system
            </Link>
          </div>
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
              <span>Quotes lane</span>
              <strong>{model.summary.quotesTotal.toLocaleString()} total</strong>
            </div>
            <div className={styles.diagnosticsRow}>
              <span>Jobs lane</span>
              <strong>{model.summary.jobsTotal.toLocaleString()} total</strong>
            </div>
          </div>
          {model.diagnostics.warnings.length > 0 ? (
            <ul className={styles.warningList}>
              {model.diagnostics.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              No query warnings were emitted on this overview render. This is the new baseline.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}
