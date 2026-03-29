import Link from "next/link";
import Image from "next/image";
import { Nav } from "@contentco-op/ui";
import { PublicFooter } from "@/app/components/public-footer";
import { BOOKING_PAGE_PATH } from "@/lib/public-booking";
import { portfolioPublicStudies } from "@/lib/content/portfolio";
import styles from "./page.module.css";

const APP_URLS = {
  coscript: "https://script.contentco-op.com",
  cocut: "https://cut.contentco-op.com",
  codeliver: "https://deliver.contentco-op.com",
} as const;

const CARDS = [
  {
    name: "Script",
    prefix: "Co-",
    tagline: "Plan the story.",
    accent: "#4c8ef5",
    href: APP_URLS.coscript,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width={44} height={44}>
        <rect x="4" y="14" width="32" height="22" rx="2.5" stroke="currentColor" strokeWidth={1.4} />
        <path d="M4 14 L10 6 L30 6 L36 14" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
        <line x1="10" y1="6" x2="14" y2="14" stroke="currentColor" strokeWidth={1.4} />
        <line x1="20" y1="6" x2="24" y2="14" stroke="currentColor" strokeWidth={1.4} />
        <line x1="30" y1="6" x2="34" y2="14" stroke="currentColor" strokeWidth={1.4} />
        <line x1="10" y1="25" x2="30" y2="25" stroke="currentColor" strokeWidth={1} opacity={0.4} />
        <line x1="10" y1="30" x2="24" y2="30" stroke="currentColor" strokeWidth={1} opacity={0.4} />
      </svg>
    ),
  },
  {
    name: "Cut",
    prefix: "Co-",
    tagline: "Shape the film.",
    accent: "#a78bf5",
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
    name: "Deliver",
    prefix: "Co-",
    tagline: "Ship the work.",
    accent: "#2dd4bf",
    href: APP_URLS.codeliver,
    icon: (
      <svg viewBox="0 0 40 40" fill="none" width={44} height={44}>
        <circle cx="18" cy="22" r="12" stroke="currentColor" strokeWidth={1.4} />
        <polyline points="12,22 16,26 24,18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 8 L36 8 L36 16" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="26" y1="18" x2="36" y2="8" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

const PRODUCTS = [
  { id: "co-script", name: "Co-Script", accent: "#4c8ef5", href: APP_URLS.coscript },
  { id: "co-cut", name: "Co-Cut", accent: "#a78bf5", href: APP_URLS.cocut },
  { id: "co-deliver", name: "Co-Deliver", accent: "#2dd4bf", href: APP_URLS.codeliver },
];

export default function SuitePage() {
  return (
    <main className={`page page-dark ${styles.page}`}>
      <Nav surface="home" />

      {/* ─── Hero: Cards ARE the visual ─── */}
      <section className={styles.hero}>
        <p className={styles.kicker}>The Co-Apps Suite</p>
        <h1 className={styles.heroTitle}>Brief to boardroom.</h1>

        <div className={styles.cardsRow}>
          {CARDS.map((card) => (
            <Link
              key={card.name}
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
            </Link>
          ))}
        </div>

        <div className={styles.heroCtas}>
          <Link href="/brief" className={styles.primaryBtn}>Start a brief</Link>
          <Link href={BOOKING_PAGE_PATH} className={styles.ghostBtn}>Book a demo</Link>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ─── Suite montage video slot ─── */}
      <section className={styles.montageSection}>
        <div className={styles.montageSlot}>
          <svg viewBox="0 0 48 48" fill="none" width={56} height={56}>
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth={1} opacity={0.25} />
            <polygon points="19,15 35,24 19,33" fill="currentColor" opacity={0.35} />
          </svg>
          <span className={styles.montageLabel}>Suite montage — coming soon</span>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ─── Individual product sections ─── */}
      <section className={styles.productsSection}>
        {PRODUCTS.map((product) => (
          <article
            key={product.id}
            id={product.id}
            className={styles.productBlock}
            style={{ "--product-accent": product.accent } as React.CSSProperties}
          >
            <div className={styles.productInfo}>
              <h2 className={styles.productName}>{product.name}</h2>
              <div className={styles.productActions}>
                <a href={product.href} className={styles.primaryBtn}>Open {product.name}</a>
                <Link href={BOOKING_PAGE_PATH} className={styles.ghostBtn}>Demo</Link>
              </div>
            </div>
            <div className={styles.productVideo}>
              <div className={styles.videoPlaceholder}>
                <svg viewBox="0 0 48 48" fill="none" width={44} height={44}>
                  <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth={1} opacity={0.3} />
                  <polygon points="20,16 34,24 20,32" fill="currentColor" opacity={0.4} />
                </svg>
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.divider} />

      {/* ─── Portfolio reel ─── */}
      <section className={styles.reelSection}>
        <p className={styles.kicker}>The work</p>
        <div className={styles.reelGrid}>
          {portfolioPublicStudies.map((study) => (
            <Link key={study.id} href={`/portfolio?v=${study.id}`} className={styles.reelCard}>
              <div className={styles.reelThumb}>
                <Image
                  src={study.thumbnail}
                  alt={study.title}
                  fill
                  sizes="(max-width: 720px) 50vw, 25vw"
                  quality={75}
                  style={{ objectFit: "cover" }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
