import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import styles from "../legal-page.module.css";
import { SITE_NAME, absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

const updatedAt = "April 21, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Content Co-op collects, uses, stores, and protects information submitted through contentco-op.com and related production workflows.",
  alternates: {
    canonical: "https://contentco-op.com/privacy",
  },
  openGraph: {
    title: `Privacy Policy | ${SITE_NAME}`,
    description:
      "How Content Co-op collects, uses, stores, and protects information submitted through contentco-op.com and related production workflows.",
    url: "https://contentco-op.com/privacy",
  },
  twitter: {
    title: `Privacy Policy | ${SITE_NAME}`,
    description:
      "How Content Co-op collects, uses, stores, and protects information submitted through contentco-op.com and related production workflows.",
  },
};

const sections = [
  { id: "scope", label: "Scope" },
  { id: "collect", label: "What we collect" },
  { id: "use", label: "How we use it" },
  { id: "sharing", label: "When we share it" },
  { id: "retention", label: "Retention and security" },
  { id: "rights", label: "Your choices" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <PublicPageLayout surface="privacy" theme="cream">
      <main className={styles.page}>
        <SeoJsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Privacy Policy", path: "/privacy" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Privacy Policy",
            url: absoluteUrl("/privacy"),
            description:
              "How Content Co-op collects, uses, stores, and protects information submitted through contentco-op.com and related production workflows.",
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
            Privacy{" "}
            <br />
            <span className={styles.titleAccent}>Policy</span>
          </h1>
          <p className={styles.lede}>
            Content Co-op handles project inquiries, booking requests, and production information with the same care we
            expect on set: minimal collection, clear operational use, and no casual disclosure. This policy explains what
            we collect through <strong>contentco-op.com</strong>, how we use it, and what choices you have.
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaPill}>Effective {updatedAt}</span>
            <span className={styles.metaPill}>Applies to contentco-op.com</span>
          </div>
        </header>

        <div className={styles.grid}>
          <aside className={styles.toc} aria-label="Privacy policy sections">
            <p className={styles.tocLabel}>Sections</p>
            <nav className={styles.tocLinks}>
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>{section.label}</a>
              ))}
              <Link href="/terms">Terms of Service</Link>
            </nav>
          </aside>

          <div className={styles.content}>
            <section className={styles.section} id="scope">
              <h2>Scope</h2>
              <p>
                This policy applies to the Content Co-op website, creative brief intake, booking flow, portfolio routes,
                and related communications initiated through this site. It covers information you submit directly, data
                generated while using the site, and operational records needed to respond to inquiries, scope projects, and
                deliver services.
              </p>
            </section>

            <section className={styles.section} id="collect">
              <h2>What we collect</h2>
              <p>Depending on how you use the site, we may collect:</p>
              <ul>
                <li>contact details such as name, company, email address, and phone number,</li>
                <li>project information submitted through the creative brief or booking flow,</li>
                <li>scheduling preferences, intake responses, and message history,</li>
                <li>billing or invoicing details required to quote or execute work,</li>
                <li>technical data such as IP address, browser details, device type, and basic usage logs.</li>
              </ul>
            </section>

            <section className={styles.section} id="use">
              <h2>How we use it</h2>
              <p>We use collected information to operate the business and the site, including to:</p>
              <ul>
                <li>respond to inquiries and qualify project fit,</li>
                <li>prepare proposals, schedules, and production plans,</li>
                <li>manage project communication, approvals, and delivery,</li>
                <li>issue invoices or process payments when applicable,</li>
                <li>monitor site reliability, detect abuse, and improve workflow performance.</li>
              </ul>
              <div className={styles.note}>
                <p className={styles.noteTitle}>No resale</p>
                <p className={styles.noteBody}>
                  Content Co-op does not sell personal information gathered through this website.
                </p>
              </div>
            </section>

            <section className={styles.section} id="sharing">
              <h2>When we share it</h2>
              <p>
                We share information only when needed to run the business and the site. That can include infrastructure,
                hosting, database, scheduling, payment, or communications vendors used to process legitimate business
                activity. We may also disclose information when required by law, to enforce agreements, or to protect the
                safety, rights, or operations of Content Co-op, clients, or the public.
              </p>
            </section>

            <section className={styles.section} id="retention">
              <h2>Retention and security</h2>
              <p>
                We retain information for as long as reasonably necessary to operate the site, respond to inquiries,
                maintain project records, meet legal or accounting obligations, and support ongoing client relationships.
                We use commercially reasonable safeguards to protect stored information, but no system is absolute. You
                should avoid sending unnecessary sensitive information through public forms.
              </p>
            </section>

            <section className={styles.section} id="rights">
              <h2>Your choices</h2>
              <p>
                You can request access, correction, or deletion of personal information we control, subject to legal and
                operational requirements. You may also opt out of non-essential outreach communications at any time. If you
                need the governing service terms for a project or website use, review our <Link href="/terms">Terms of
                Service</Link>.
              </p>
            </section>

            <section className={styles.section} id="contact">
              <h2>Contact</h2>
              <p>
                For privacy questions or requests, contact{" "}
                <a href="mailto:service@contentco-op.com">service@contentco-op.com</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
      </main>
    </PublicPageLayout>
  );
}
