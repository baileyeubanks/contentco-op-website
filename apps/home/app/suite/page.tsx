import Link from "next/link";
import type { Metadata } from "next";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { AnimatedSuite } from "@/app/components/animated-suite";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { buildBreadcrumbJsonLd, buildSoftwareSuiteJsonLd } from "@/lib/seo";
import { SUITE_CARDS, SUITE_COMING, SUITE_INTRO } from "@/app/suite-cards";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Co-VideoPro: Review, Approval and Delivery for Video Production",
  description:
    "Co-VideoPro is where Content Co-op clients review cuts, approve them, receive final files, and handle quotes, signatures and payments.",
  alternates: {
    canonical: "https://contentco-op.com/suite",
  },
  openGraph: {
    title: "Co-VideoPro: Review, Approval and Delivery | Content Co-op",
    description:
      "Co-VideoPro is where Content Co-op clients review cuts, approve them, receive final files, and handle quotes, signatures and payments.",
    url: "https://contentco-op.com/suite",
  },
  twitter: {
    title: "Co-VideoPro: Review, Approval and Delivery | Content Co-op",
    description:
      "Co-VideoPro is where Content Co-op clients review cuts, approve them, receive final files, and handle quotes, signatures and payments.",
  },
};

export default function SuitePage() {
  return (
    <PublicPageLayout surface="suite" theme="cream">
      <AnimatedSuite>
      <main className={`page ${styles.page}`}>
        <SeoJsonLd
          data={[
            buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Product Suite", path: "/suite" }]),
            ...buildSoftwareSuiteJsonLd([
              {
                name: "Co-VideoPro",
                url: "https://co-videopro.com",
                description:
                  "Video review, approval, delivery, client portal, and quote, signature and payment software from Content Co-op.",
              },
            ]),
          ]}
        />

      <section className={styles.hero}>
        <p className={styles.kicker}>Co-VideoPro</p>
        <h1 className={styles.heroTitle}>Brief to <em>boardroom.</em></h1>
        <div className={styles.heroDivider} aria-hidden="true" />
        <p className={styles.heroIntro}>{SUITE_INTRO}</p>

        <div className={styles.cardsRow}>
          {SUITE_CARDS.map((card) => {
            const body = (
              <>
                <div className={styles.cardAccent} />
                <div className={styles.cardIcon}>{card.icon}</div>
                <h2 className={styles.cardName}>{card.name}</h2>
                <p className={styles.cardTagline}>{card.tagline}</p>
                <p className={styles.cardDescription}>{card.description}</p>
                <span className={styles.cardStatus}>{card.cta}</span>
              </>
            );
            const common = {
              id: card.id,
              "aria-label": card.ariaLabel,
              className: styles.card,
              style: { "--card-accent": card.accent } as React.CSSProperties,
            };
            return card.external ? (
              <a key={card.id} href={card.href} {...common}>{body}</a>
            ) : (
              <Link key={card.id} href={card.href} {...common}>{body}</Link>
            );
          })}
        </div>

        <div className={styles.coming}>
          <span className={styles.comingLabel}>{SUITE_COMING.label}</span>
          <p className={styles.comingTitle}>{SUITE_COMING.title}</p>
          <p className={styles.comingText}>{SUITE_COMING.description}</p>
        </div>
      </section>

      </main>
      </AnimatedSuite>
    </PublicPageLayout>
  );
}
