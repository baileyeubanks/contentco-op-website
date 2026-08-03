import Link from "next/link";
import type { Metadata } from "next";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { AnimatedSuite } from "@/app/components/animated-suite";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { buildBreadcrumbJsonLd, buildSoftwareSuiteJsonLd } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Production Workflow Software for Content Teams",
  description:
    "Explore the Co-Apps Suite from Content Co-op: planning, review, and delivery tools for production workflows.",
  alternates: {
    canonical: "https://contentco-op.com/suite",
  },
  openGraph: {
    title: "Production Workflow Software for Content Teams | Content Co-op",
    description:
      "Explore the Co-Apps Suite from Content Co-op: planning, review, and delivery tools for production workflows.",
    url: "https://contentco-op.com/suite",
  },
  twitter: {
    title: "Production Workflow Software for Content Teams | Content Co-op",
    description:
      "Explore the Co-Apps Suite from Content Co-op: planning, review, and delivery tools for production workflows.",
  },
};

const APP_URLS = {
  coscript: "/co-script",
  cocut: "/co-cut",
  codeliver: "/co-deliver",
} as const;

const APP_CANONICAL_URLS = {
  coscript: "https://contentco-op.com/co-script",
  cocut: "https://contentco-op.com/co-cut",
  codeliver: "https://contentco-op.com/co-deliver",
} as const;

const CARDS = [
  {
    id: "co-script",
    name: "Script",
    prefix: "Co-",
    tagline: "Align the story.",
    description:
      "Co-Script turns a brief into production intelligence: client language, research, interview targets, shot lists, constraints, and script drafts in one place. AI helps surface angles and gaps, while the human team keeps the message accurate and on brand.",
    accent: "#c4722a",
    href: APP_URLS.coscript,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width={44} height={44}>
        <path d="M10 4.5h14l6 6V35.5H10z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M24 4.5v7h6" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M15 16h12M15 21h9M15 26h12M15 31h7" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" opacity={0.62} />
        <path d="M7 10.5h6M10 7.5v6" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" />
        <path d="M29 24.5l1.2 2.6 2.8 1.1-2.8 1.1-1.2 2.7-1.2-2.7-2.8-1.1 2.8-1.1z" fill="currentColor" opacity={0.9} />
      </svg>
    ),
  },
  {
    id: "co-cut",
    name: "Cut",
    prefix: "Co-",
    tagline: "Shape the film.",
    description:
      "Co-Cut keeps post-production legible: media ingest, transcript-driven selects, edit versions, captions, exports, and frame-specific feedback. AI supports transcripts and selects so the editor can spend more time shaping the film, not chasing notes.",
    accent: "#c4722a",
    href: APP_URLS.cocut,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width={44} height={44}>
        <rect x="2" y="14" width="36" height="12" rx="2" stroke="currentColor" strokeWidth={1.4} />
        <line x1="10" y1="14" x2="10" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="18" y1="14" x2="18" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="26" y1="14" x2="26" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="34" y1="14" x2="34" y2="26" stroke="currentColor" strokeWidth={0.8} opacity={0.3} />
        <line x1="22" y1="9" x2="22" y2="31" stroke="currentColor" strokeWidth={1.8} />
        <polygon points="19,9 25,9 22,12" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "co-deliver",
    name: "Deliver",
    prefix: "Co-",
    tagline: "Control the handoff.",
    description:
      "Co-Deliver is the client-ready review and delivery layer: approval gates, comments, share links, downloads, final versions, and archive trails. AI helps summarize decisions and flag loose ends so the final handoff stays clean.",
    accent: "#c4722a",
    href: APP_URLS.codeliver,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width={44} height={44}>
        <rect x="7" y="12" width="26" height="18" rx="3" stroke="currentColor" strokeWidth={1.5} />
        <path d="M12 12l8 7 8-7" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M20 19v10" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
        <path d="M14 25h7.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
        <circle cx="29" cy="28.5" r="6" fill="#f3ede2" stroke="currentColor" strokeWidth={1.4} />
        <path d="M26.6 28.5l1.6 1.6 3.2-3.3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
] as const;

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
                name: "Co-Script",
                url: APP_CANONICAL_URLS.coscript,
                description: "AI-assisted pre-production intelligence for briefs, research, scripts, and shot lists.",
              },
              {
                name: "Co-Cut",
                url: APP_CANONICAL_URLS.cocut,
                description: "Transcript-driven editing, review, and version control for production teams.",
              },
              {
                name: "Co-Deliver",
                url: APP_CANONICAL_URLS.codeliver,
                description: "Review links, approval gates, downloads, version management, and client handoff.",
              },
            ]),
          ]}
        />

      <section className={styles.hero}>
        <p className={styles.kicker}>The Co-Apps Suite</p>
        <h1 className={styles.heroTitle}>Brief to <em>boardroom.</em></h1>
        <div className={styles.heroDivider} aria-hidden="true" />
        <p className={styles.heroIntro}>
          These are not side quests. Every project moves through the same three rooms:
          plan the story, shape the film, and deliver the work without losing the thread.
        </p>

        <div className={styles.cardsRow}>
          {CARDS.map((card) => (
            <Link
              key={card.name}
              id={card.id}
              href={card.href}
              className={styles.card}
              style={{ "--card-accent": card.accent } as React.CSSProperties}
            >
              <div className={styles.cardAccent} />
              <div className={styles.cardIcon}>{card.icon}</div>
              <h2 className={styles.cardName}>
                <span className={styles.cardPrefix}>{card.prefix}</span>{card.name}
              </h2>
              <p className={styles.cardTagline}>{card.tagline}</p>
              <p className={styles.cardDescription}>{card.description}</p>
              <span className={styles.cardStatus}>Request access</span>
            </Link>
          ))}
        </div>
      </section>

      </main>
      </AnimatedSuite>
    </PublicPageLayout>
  );
}
