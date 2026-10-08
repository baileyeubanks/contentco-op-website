import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { PublicPageLayout } from "./components/public-page-layout";
import { AnimatedHome } from "./components/animated-home";
import { SeoJsonLd } from "./components/seo-json-ld";
import { HeroVideoSequence } from "./hero-video-sequence";
import { weatherVaneVideo, weatherVanePoster } from "./hero-video-config";
import {
  galleryImages,
  heroVideo,
  heroVideoMobile,
} from "./home-content";
import { HOME_CLIENT_LOGOS } from "./home-client-logos";
import { RotatingGallery } from "./rotating-gallery";
import {
  SOCIAL_IMAGE_ALT,
  SOCIAL_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_TITLE,
  organizationJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "https://contentco-op.com/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://contentco-op.com/",
    images: [
      {
        url: SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: SOCIAL_IMAGE_ALT,
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SOCIAL_IMAGE_PATH,
        alt: SOCIAL_IMAGE_ALT,
      },
    ],
  },
};

const CO_VIDEOPRO_ENTRY_HREF = "https://co-videopro.com/projects";

const HOME_SUITE_PRODUCTS: Array<{
  prefix: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  icon: ReactNode;
}> = [
  {
    prefix: "Co-",
    name: "Script",
    tagline: "Align the story.",
    description:
      "Co-Script turns a brief into production intelligence: client language, research, interview targets, shot lists, constraints, and script drafts in one place. AI helps surface angles and gaps, while the human team keeps the message accurate and on brand.",
    accent: "#4c8ef5",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M10 4.5h14l6 6V35.5H10z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M24 4.5v7h6" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M15 16h12M15 21h9M15 26h12M15 31h7" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" opacity={0.62} />
        <path d="M7 10.5h6M10 7.5v6" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" />
        <path d="M29 24.5l1.2 2.6 2.8 1.1-2.8 1.1-1.2 2.7-1.2-2.7-2.8-1.1 2.8-1.1z" fill="currentColor" opacity={0.9} />
      </svg>
    ),
  },
  {
    prefix: "Co-",
    name: "Cut",
    tagline: "Shape the film.",
    description:
      "Co-Cut keeps post-production legible: media ingest, transcript-driven selects, edit versions, captions, exports, and frame-specific feedback. AI supports transcripts and selects so the editor can spend more time shaping the film, not chasing notes.",
    accent: "#a78bf5",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
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
    prefix: "Co-",
    name: "Deliver",
    tagline: "Control the handoff.",
    description:
      "Co-Deliver is the client-ready review and delivery layer: approval gates, comments, share links, downloads, final versions, and archive trails. AI helps summarize decisions and flag loose ends so the final handoff stays clean.",
    accent: "#2dd4bf",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
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

type HomePageSearchParams = {
  hero?: string | string[];
  logos?: string | string[];
  photo?: string | string[];
};

type HomePageProps = {
  searchParams?: Promise<HomePageSearchParams>;
};

const getParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const getDecodedParam = (value: string | string[] | undefined) => {
  const param = getParam(value);
  if (!param) return undefined;

  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const heroPreview = getParam(params.hero) === "vibrant" ? "vibrant" : "quiet";
  const logoPreview = getParam(params.logos) === "color" ? "color" : "neutral";
  const galleryPhoto = getDecodedParam(params.photo);

  return (
    <PublicPageLayout surface="home" theme="cream">
      <AnimatedHome>
      <main className="page">
        <SeoJsonLd data={[organizationJsonLd, websiteJsonLd, ...serviceJsonLd]} />

        {/* ─── S1: Hero — cinematic full-bleed video ─── */}
        <section className="hero" data-hero-preview={heroPreview}>
          <HeroVideoSequence
            firstSrc={weatherVaneVideo}
            nextSrc={heroVideo}
            nextMobileSrc={heroVideoMobile}
            poster={weatherVanePoster}
          />
          <div className="hero-content">
            <h1>
              <span className="hero-thin">Minimal disruption, </span>
              <em>maximum signal.</em>
            </h1>
            <p className="hero-lede">
              <span>Houston-based commercial video production.</span>
              <span>Built around active operations.</span>
            </p>
            <div className="hero-actions">
              <Link className="button light compact" href="/portfolio">See our work</Link>
              <Link className="button ghost compact" href="/brief">Start the Creative Brief</Link>
            </div>
          </div>
        </section>

        {/* ─── Client Logo Ticker ─── */}
        <section className="client-logos" aria-label="Trusted by" data-logo-preview={logoPreview}>
          <div className="client-logos-ticker">
            {[0, 1].map((copy) => (
              <div key={copy} className="client-logos-track" aria-hidden={copy === 1}>
                {HOME_CLIENT_LOGOS.map((logo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${logo.alt}-${copy}`}
                    src={`${logo.src}?v=6`}
                    alt={logo.alt}
                    className="client-logo"
                    style={{
                      "--logo-width": `${logo.width}px`,
                      "--logo-height": `${logo.height}px`,
                      "--logo-mobile-width": `${logo.mobileWidth}px`,
                      "--logo-mobile-height": `${logo.mobileHeight}px`,
                    } as CSSProperties}
                    loading={copy === 0 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority="low"
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ─── S2: Work Gallery ─── */}
        <div className="cream-section-flush">
          <RotatingGallery
            images={galleryImages}
            columns={8}
            rows={4}
            interval={5200}
            baseHref="/"
            initialSelectedSrc={galleryPhoto}
            closeHref="/"
          />
        </div>

        {/* ─── S3: Products ─── */}
        <div className="cream-section">
          <section className="products" aria-labelledby="co-apps-title">
            <div className="products-content">
              <p className="products-kicker">The Co-Apps Suite</p>
              <h2 id="co-apps-title" className="products-headline">Brief to <em>boardroom.</em></h2>
              <div className="products-divider" aria-hidden="true" />
              <p className="products-intro">
                These are not side quests. Every project moves through the same three rooms:
                plan the story, shape the film, and deliver the work without losing the thread.
              </p>
              <div className="products-grid">
                {HOME_SUITE_PRODUCTS.map((product) => (
                  <a
                    key={product.name}
                    className="product-card"
                    href={CO_VIDEOPRO_ENTRY_HREF}
                    aria-label={`Open ${product.prefix}${product.name} in Co-VideoPro`}
                    style={{ "--card-accent": product.accent } as CSSProperties}
                  >
                    <div className="product-card-accent" aria-hidden="true" />
                    <div className="product-icon">{product.icon}</div>
                    <h3 className="product-wordmark">
                      <span className="product-co">{product.prefix}</span>{product.name}
                    </h3>
                    <p className="product-copy">{product.tagline}</p>
                    <p className="product-desc">{product.description}</p>
                    <span className="product-status">Open Co-VideoPro</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ─── S5: Trust / Quote ─── */}
        <section className="trust">
          <div className="trust-inner">
            <blockquote className="trust-quote">
              For enterprise teams, the final video is only half the job. The other half is a production process that shows up prepared, communicates clearly, protects the schedule, and delivers work stakeholders can actually use.
            </blockquote>
            <div className="trust-photo">
              <Image
                src="/cc/photos/bailey-headshot-20261003.jpeg"
                alt="Bailey Eubanks"
                fill
                sizes="(max-width:980px) 200px, 300px"
                quality={85}
                style={{ pointerEvents: "none" }}
              />
            </div>
            <div className="trust-signoff">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/cc/signature-bailey.png"
                alt="Bailey Eubanks"
                className="trust-sig-img"
                width={130}
                height={37}
              />
              <span className="trust-role">Founder &amp; Executive Producer</span>
            </div>
          </div>
        </section>

      </main>
      </AnimatedHome>
    </PublicPageLayout>
  );
}
