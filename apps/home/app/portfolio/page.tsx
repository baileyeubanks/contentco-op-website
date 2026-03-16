"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioCaseStudy } from "@contentco-op/types";
import { Nav } from "@contentco-op/ui";
import {
  portfolioFeaturedStudies,
  portfolioFlagshipStudy,
  portfolioStats,
  portfolioSupportingStudies,
} from "@/lib/content/portfolio";
import { BOOKING_PAGE_PATH, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

import styles from "./page.module.css";

export default function PortfolioPage() {
  const [activeStudy, setActiveStudy] = useState<PortfolioCaseStudy | null>(null);

  useEffect(() => {
    document.body.style.overflow = activeStudy ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeStudy]);

  return (
    <div className={styles.page}>
      <Nav surface="portfolio" />

      <main>
        <header className={styles.hero}>
          <div className={styles.heroShell}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Portfolio</p>
              <h1 className={styles.heroTitle}>Selected work for energy and industrial teams.</h1>
              <p className={styles.heroBody}>
                Safety systems, executive coverage, industrial brand films, and recruiting work built to stay credible once stakeholders start reviewing it closely.
              </p>

              <div className={styles.heroActions}>
                <button type="button" className={styles.primaryButton} onClick={() => setActiveStudy(portfolioFlagshipStudy)}>
                  Open flagship case study
                </button>
                <Link href={BOOKING_PAGE_PATH} className={styles.secondaryButton}>
                  Book strategy call
                </Link>
              </div>

              <div className={styles.statRow}>
                <StatCard value={String(portfolioStats.caseStudies)} label="case studies" />
                <StatCard value={String(portfolioStats.deliverables)} label="deliverables" />
                <StatCard value={String(portfolioStats.sectors)} label="core lanes" />
              </div>
            </div>

            <div className={styles.heroMosaic}>
              {[portfolioFlagshipStudy, ...portfolioFeaturedStudies.slice(0, 2)].map((study, index) => (
                <button
                  key={study.id}
                  type="button"
                  className={`${styles.heroTile} ${index === 0 ? styles.heroTileLarge : ""}`}
                  onClick={() => setActiveStudy(study)}
                >
                  <div className={styles.imageWrap}>
                    <Image
                      src={study.gallery[0].src}
                      alt={study.gallery[0].alt}
                      fill
                      sizes={index === 0 ? "(max-width: 960px) 100vw, 42vw" : "(max-width: 960px) 100vw, 20vw"}
                      className={styles.image}
                      priority={index === 0}
                    />
                  </div>
                  <div className={styles.tileScrim} aria-hidden="true" />
                  <div className={styles.heroTileBody}>
                    <span className={styles.tileMeta}>{study.client}</span>
                    <strong className={styles.tileTitle}>{study.title}</strong>
                    <span className={styles.tileTag}>{study.scope}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className={styles.flagshipSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Flagship case study</p>
              <h2 className={styles.sectionTitle}>Start with the strongest example of training work built for real operations review.</h2>
            </div>
            <p className={styles.sectionCopy}>
              This is the clearest example of structured content that has to stay useful after the first watch and hold up in front of multiple stakeholders.
            </p>
          </div>

          <article className={styles.flagshipCard}>
            <button type="button" className={styles.flagshipMedia} onClick={() => setActiveStudy(portfolioFlagshipStudy)}>
              <div className={styles.imageWrap}>
                <Image
                  src={portfolioFlagshipStudy.gallery[0].src}
                  alt={portfolioFlagshipStudy.gallery[0].alt}
                  fill
                  sizes="(max-width: 960px) 100vw, 46vw"
                  className={styles.image}
                  priority
                />
              </div>
              <div className={styles.flagshipMediaCard}>
                <span className={styles.mediaLabel}>{portfolioFlagshipStudy.client}</span>
                <strong>{portfolioFlagshipStudy.format}</strong>
                <span>{portfolioFlagshipStudy.scope}</span>
              </div>
            </button>

            <div className={styles.flagshipBody}>
              <div className={styles.metaRow}>
                <span>{portfolioFlagshipStudy.sector}</span>
                <span className={styles.dot} aria-hidden="true" />
                <span>{portfolioFlagshipStudy.year}</span>
                <span className={styles.dot} aria-hidden="true" />
                <span>{portfolioFlagshipStudy.format}</span>
              </div>

              <h2 className={styles.cardTitle}>{portfolioFlagshipStudy.title}</h2>
              <p className={styles.cardHeadline}>{portfolioFlagshipStudy.headline}</p>
              <p className={styles.cardSummary}>{portfolioFlagshipStudy.summary}</p>

              <div className={styles.tokenRow}>
                {portfolioFlagshipStudy.proofPoints.map((item) => (
                  <span key={item} className={styles.token}>
                    {item}
                  </span>
                ))}
              </div>

              <div className={styles.inlineActions}>
                <button type="button" className={styles.primaryButton} onClick={() => setActiveStudy(portfolioFlagshipStudy)}>
                  Open case study
                </button>
                <Link className={styles.secondaryButton} href={CREATIVE_BRIEF_PATH}>
                  Send creative brief
                </Link>
              </div>
            </div>
          </article>
        </section>

        <section className={styles.section} id="featured-proof">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Featured work</p>
              <h2 className={styles.sectionTitle}>Additional proof across executive, industrial, and brand work.</h2>
            </div>
            <p className={styles.sectionCopy}>
              Open the case study when you want the full story, but the stills and framing should already tell you what kind of room the work can survive.
            </p>
          </div>

          <div className={styles.featuredGrid}>
            {portfolioFeaturedStudies.map((study) => (
              <article key={study.id} className={styles.featuredCard}>
                <button type="button" className={styles.featuredMedia} onClick={() => setActiveStudy(study)}>
                  <div className={styles.imageWrap}>
                    <Image
                      src={study.gallery[0].src}
                      alt={study.gallery[0].alt}
                      fill
                      sizes="(max-width: 960px) 100vw, 32vw"
                      className={styles.image}
                    />
                  </div>
                  <div className={styles.tileScrim} aria-hidden="true" />
                  <span className={styles.openBadge}>Open case study</span>
                </button>

                <div className={styles.featuredBody}>
                  <div className={styles.metaRow}>
                    <span>{study.client}</span>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{study.year}</span>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{study.scope}</span>
                  </div>

                  <h3 className={styles.featuredTitle}>{study.title}</h3>
                  <p className={styles.cardHeadline}>{study.headline}</p>
                  <p className={styles.cardSummary}>{study.summary}</p>

                  <div className={styles.tokenRow}>
                    {study.proofPoints.map((item) => (
                      <span key={item} className={styles.token}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Supporting work</p>
              <h2 className={styles.sectionTitle}>More range across recruiting and field-first storytelling.</h2>
            </div>
            <p className={styles.sectionCopy}>
              These projects stay compact on the page so the portfolio moves quickly while still showing where the work travels.
            </p>
          </div>

          <div className={styles.supportingGrid}>
            {portfolioSupportingStudies.map((study) => (
              <article key={study.id} className={styles.supportingCard}>
                <button type="button" className={styles.supportingMedia} onClick={() => setActiveStudy(study)}>
                  <div className={styles.imageWrap}>
                    <Image
                      src={study.gallery[0].src}
                      alt={study.gallery[0].alt}
                      fill
                      sizes="(max-width: 960px) 100vw, 24vw"
                      className={styles.image}
                    />
                  </div>
                </button>

                <div className={styles.supportingBody}>
                  <div className={styles.metaRow}>
                    <span>{study.sector}</span>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{study.format}</span>
                  </div>
                  <h3 className={styles.supportingTitle}>{study.title}</h3>
                  <p className={styles.supportingClient}>{study.client}</p>
                  <p className={styles.supportingText}>{study.headline}</p>
                  <div className={styles.tokenRow}>
                    {study.deliverables.slice(0, 2).map((item) => (
                      <span key={item} className={styles.token}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {activeStudy ? <ViewerModal key={activeStudy.id} study={activeStudy} onClose={() => setActiveStudy(null)} /> : null}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.statCard}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StoryBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className={styles.storyBlock}>
      <span className={styles.storyLabel}>{label}</span>
      <p>{text}</p>
    </div>
  );
}

function ViewerModal({ study, onClose }: { study: PortfolioCaseStudy; onClose: () => void }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = study.gallery[activeImageIndex] ?? study.gallery[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalShell}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`portfolio-modal-${study.id}`}
      >
        <div className={styles.modalStage}>
          <div className={styles.imageWrap}>
            <Image
              src={activeImage.src}
              alt={activeImage.alt}
              fill
              sizes="(max-width: 960px) 100vw, 62vw"
              className={styles.image}
            />
          </div>
          <div className={styles.modalStageBadge}>
            <span className={styles.mediaLabel}>{study.client}</span>
            <strong>Selected proof still</strong>
          </div>
        </div>

        <aside className={styles.modalAside}>
          <div className={styles.modalHeader}>
            <div className={styles.metaRow}>
              <span>{study.client}</span>
              <span className={styles.dot} aria-hidden="true" />
              <span>{study.year}</span>
              <span className={styles.dot} aria-hidden="true" />
              <span>{study.scope}</span>
            </div>
            <h2 id={`portfolio-modal-${study.id}`} className={styles.modalTitle}>
              {study.title}
            </h2>
            <p className={styles.modalHeadline}>{study.headline}</p>
            <p className={styles.modalNote}>{study.summary}</p>
          </div>

          <div className={styles.modalStory}>
            <StoryBlock label="Mandate" text={study.mandate} />
            <StoryBlock label="Execution" text={study.execution} />
            <StoryBlock label="Outcome" text={study.outcome} />
          </div>

          <div className={styles.modalGallery}>
            {study.gallery.map((image, index) => (
              <button
                key={image.src}
                type="button"
                className={`${styles.modalThumb} ${index === activeImageIndex ? styles.modalThumbActive : ""}`}
                onClick={() => setActiveImageIndex(index)}
              >
                <div className={styles.imageWrap}>
                  <Image src={image.src} alt={image.alt} fill sizes="180px" className={styles.image} />
                </div>
              </button>
            ))}
          </div>

          <div className={styles.tokenRow}>
            {study.deliverables.map((item) => (
              <span key={item} className={styles.token}>
                {item}
              </span>
            ))}
          </div>

          <div className={styles.modalActions}>
            <Link className={styles.primaryButton} href={BOOKING_PAGE_PATH}>
              Book strategy call
            </Link>
            <Link className={styles.secondaryButton} href={CREATIVE_BRIEF_PATH}>
              Send creative brief
            </Link>
            <button type="button" className={styles.ghostButton} onClick={onClose}>
              Close
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
