import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import styles from "../legal-page.module.css";
import { SITE_NAME, absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

const updatedAt = "April 21, 2026";

const sections = [
  { id: "site-use", label: "Website use" },
  { id: "project-terms", label: "Project terms" },
  { id: "client-materials", label: "Client materials" },
  { id: "payment", label: "Payment" },
  { id: "ip", label: "Intellectual property" },
  { id: "liability", label: "Limitations" },
  { id: "contact", label: "Contact" },
];

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The website and service terms that govern use of contentco-op.com and Content Co-op production engagements.",
  alternates: {
    canonical: "https://contentco-op.com/terms",
  },
  openGraph: {
    title: `Terms of Service | ${SITE_NAME}`,
    description:
      "The website and service terms that govern use of contentco-op.com and Content Co-op production engagements.",
    url: "https://contentco-op.com/terms",
  },
  twitter: {
    title: `Terms of Service | ${SITE_NAME}`,
    description:
      "The website and service terms that govern use of contentco-op.com and Content Co-op production engagements.",
  },
};

export default function TermsPage() {
  return (
    <PublicPageLayout surface="terms" theme="cream">
      <main className={styles.page}>
        <SeoJsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Terms of Service", path: "/terms" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Terms of Service",
            url: absoluteUrl("/terms"),
            description:
              "The website and service terms that govern use of contentco-op.com and Content Co-op production engagements.",
            isPartOf: {
              "@type": "WebSite",
              name: SITE_NAME,
              url: absoluteUrl("/"),
            },
          },
        ]}
      />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Content Co-op Legal</p>
          <h1 className={styles.title}>
            Terms of{" "}
            <br />
            <span className={styles.titleAccent}>Service</span>
          </h1>
          <p className={styles.lede}>
            These terms govern use of <strong>contentco-op.com</strong> and, unless a signed proposal, statement of work,
            or master services agreement says otherwise, they also frame how Content Co-op handles public inquiries,
            scheduling, and early-stage project engagement.
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaPill}>Effective {updatedAt}</span>
            <span className={styles.metaPill}>Project terms may supersede by contract</span>
          </div>
        </header>

        <div className={styles.grid}>
          <aside className={styles.toc} aria-label="Terms sections">
            <p className={styles.tocLabel}>Sections</p>
            <nav className={styles.tocLinks}>
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>{section.label}</a>
              ))}
              <Link href="/privacy">Privacy Policy</Link>
            </nav>
          </aside>

          <div className={styles.content}>
            <section className={styles.section} id="site-use">
              <h2>Website use</h2>
              <p>
                You may use this website to learn about Content Co-op, review our work, submit project information, and
                contact us for legitimate business purposes. You may not misuse the site, interfere with operations,
                attempt unauthorized access, scrape restricted materials, or use the site to distribute unlawful,
                infringing, or harmful content.
              </p>
            </section>

            <section className={styles.section} id="project-terms">
              <h2>Project terms and scoping</h2>
              <p>
                Public website information is informational only and does not, by itself, create a production engagement.
                Actual services, scope, timing, deliverables, revision rounds, licensing, scheduling, and fees are defined
                in the controlling proposal, statement of work, estimate, or other signed agreement for the project.
              </p>
            </section>

            <section className={styles.section} id="client-materials">
              <h2>Client materials, approvals, and representations</h2>
              <p>
                If you submit footage, brand materials, copy, access information, or other project inputs, you represent
                that you have the authority to provide them and to authorize the requested use. You remain responsible for
                factual accuracy, legal approvals, location permissions, talent permissions, and rights to any materials
                you supply.
              </p>
            </section>

            <section className={styles.section} id="payment">
              <h2>Payment, scheduling, and cancellation</h2>
              <p>
                Deposits, payment milestones, due dates, cancellation terms, rush fees, rescheduling impact, and out-of-
                pocket cost treatment are governed by the applicable project agreement. If no separate agreement says
                otherwise, invoices are due according to their stated terms and overdue balances may delay delivery or
                release of project assets.
              </p>
            </section>

            <section className={styles.section} id="ip">
              <h2>Intellectual property and portfolio use</h2>
              <p>
                Unless a signed agreement states otherwise, Content Co-op retains ownership of its pre-existing tools,
                methods, templates, and production systems. Final deliverable usage rights transfer only as described in
                the governing project agreement. Unless confidentiality or exclusivity terms prohibit it, Content Co-op may
                reference non-confidential completed work for portfolio, case-study, or promotional purposes.
              </p>
            </section>

            <section className={styles.section} id="liability">
              <h2>Limitations and disclaimers</h2>
              <p>
                This site is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted by law,
                Content Co-op disclaims implied warranties and is not liable for indirect, incidental, special,
                consequential, or punitive damages arising from website use, inquiry handling, or project delays outside
                its reasonable control. Nothing here limits liability that cannot be limited under applicable law.
              </p>
              <div className={styles.note}>
                <p className={styles.noteTitle}>Priority of signed agreements</p>
                <p className={styles.noteBody}>
                  If a signed client agreement conflicts with these website terms, the signed agreement controls for that
                  project.
                </p>
              </div>
            </section>

            <section className={styles.section} id="contact">
              <h2>Contact</h2>
              <p>
                Questions about these terms can be sent to{" "}
                <a href="mailto:service@contentco-op.com">service@contentco-op.com</a>. For data-handling questions, see
                our <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
      </main>
    </PublicPageLayout>
  );
}
