import Link from "next/link";
import { formatCurrency } from "@/lib/pricing";
import s from "./proposal.module.css";

interface ProposalLineItem {
  item: string;
  description: string;
  amount: number;
}

interface ProposalData {
  title: string;
  executiveSummary: string;
  creativeApproach: string;
  productionTimeline: string;
  investmentBreakdown: {
    lineItems: ProposalLineItem[];
    totalLow: number;
    totalHigh: number;
    deposit: number;
  };
  teamAssignment: string;
  nextSteps: string[];
  disclaimer: string;
}

interface ProposalClientProps {
  proposal: ProposalData;
  contactName: string;
  company: string;
}

export function ProposalClient({ proposal, contactName, company }: ProposalClientProps) {
  return (
    <main className={s.page}>
      {/* Header */}
      <header className={s.header}>
        <div className={s.brand}>
          <span className={s.brandLogo}>CC</span>
          <span className={s.brandName}>Content Co-op</span>
        </div>
        <div className={s.meta}>
          <span>Proposal</span>
          <span>·</span>
          <span>{company}</span>
          <span>·</span>
          <span>{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        </div>
      </header>

      {/* Hero */}
      <section className={s.hero}>
        <p className={s.kicker}>Creative Proposal</p>
        <h1 className={s.title}>{proposal.title}</h1>
        <p className={s.subtitle}>
          Prepared for {contactName} at {company}
        </p>
      </section>

      {/* Executive Summary */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Executive Summary</h2>
        <div className={s.prose}>
          {proposal.executiveSummary.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      {/* Creative Approach */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Creative Approach</h2>
        <div className={s.prose}>
          {proposal.creativeApproach.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      {/* Production Timeline */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Production Timeline</h2>
        <div className={s.prose}>
          {proposal.productionTimeline.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </section>

      {/* Investment */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Investment</h2>
        <div className={s.investmentCard}>
          <table className={s.invTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th className={s.invAmount}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {proposal.investmentBreakdown.lineItems.map((line, i) => (
                <tr key={i}>
                  <td>{line.item}</td>
                  <td>{line.description}</td>
                  <td className={s.invAmount}>{formatCurrency(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Estimated total</strong>
                </td>
                <td className={s.invAmount}>
                  <strong>
                    {formatCurrency(proposal.investmentBreakdown.totalLow)} –{" "}
                    {formatCurrency(proposal.investmentBreakdown.totalHigh)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Team */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Team</h2>
        <div className={s.prose}>
          <p>{proposal.teamAssignment}</p>
        </div>
      </section>

      {/* Next Steps */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Next Steps</h2>
        <ol className={s.stepsList}>
          {proposal.nextSteps.map((step, i) => (
            <li key={i}>
              <span className={s.stepNum}>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className={s.ctaSection}>
        <div className={s.ctaCard}>
          <p className={s.ctaLabel}>Ready to move forward?</p>
          <p className={s.ctaAmount}>
            Your producer will confirm scope, scheduling, and any deposit before payment is requested.
          </p>
          <p className={s.ctaNote}>
            {proposal.disclaimer}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className={s.footer}>
        <Link href="/" className={s.footerLink}>Content Co-op</Link>
        <span>·</span>
        <span>Houston, TX</span>
        <span>·</span>
        <a href="mailto:service@contentco-op.com" className={s.footerLink}>service@contentco-op.com</a>
      </footer>
    </main>
  );
}
