import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
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
import { RotatingGallery } from "./rotating-gallery";
import { SUITE_CARDS, SUITE_COMING, SUITE_INTRO } from "./suite-cards";
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

const CLIENT_LOGOS = [
  { src: "/cc/logos/bp.svg", alt: "BP", width: 72, height: 38, mobileWidth: 56, mobileHeight: 32 },
  { src: "/cc/logos/shell.png", alt: "Shell", width: 54, height: 34, mobileWidth: 42, mobileHeight: 28 },
  { src: "/cc/logos/schneider-electric.svg", alt: "Schneider Electric", width: 136, height: 34, mobileWidth: 112, mobileHeight: 28 },
  { src: "/cc/logos/abb.svg", alt: "ABB", width: 102, height: 33, mobileWidth: 82, mobileHeight: 27 },
  { src: "/cc/logos/maersk.svg", alt: "Maersk", width: 126, height: 32, mobileWidth: 100, mobileHeight: 26 },
  { src: "/cc/logos/citgo.png", alt: "CITGO", width: 64, height: 35, mobileWidth: 50, mobileHeight: 29 },
  { src: "/cc/logos/copart.png", alt: "Copart", width: 116, height: 35, mobileWidth: 92, mobileHeight: 28 },
  { src: "/cc/logos/conexon.png", alt: "Conexon", width: 124, height: 34, mobileWidth: 98, mobileHeight: 27 },
  { src: "/cc/logos/wendys.png", alt: "Wendy's", width: 124, height: 35, mobileWidth: 98, mobileHeight: 28 },
  { src: "/cc/logos/ubs.png", alt: "UBS", width: 108, height: 34, mobileWidth: 86, mobileHeight: 28 },
  { src: "/cc/logos/kodiak.svg", alt: "Kodiak Gas Services", width: 132, height: 34, mobileWidth: 104, mobileHeight: 27 },
  { src: "/cc/logos/facebook.svg", alt: "Facebook", width: 116, height: 33, mobileWidth: 92, mobileHeight: 27 },
  { src: "/cc/logos/mueller.svg", alt: "Mueller", width: 112, height: 31, mobileWidth: 90, mobileHeight: 25 },
  { src: "/cc/logos/pierpont.svg", alt: "Pierpont", width: 118, height: 32, mobileWidth: 94, mobileHeight: 26 },
  { src: "/cc/logos/nature-conferences.png", alt: "Nature Conferences", width: 122, height: 36, mobileWidth: 98, mobileHeight: 29 },
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

        {/* ─── Client logos: a static, centred, wrapping row. A scrolling ticker
            always cuts a logo off at one edge or the other. ─── */}
        <section className="client-logos" aria-label="Trusted by" data-logo-preview={logoPreview}>
          <ul className="client-logos-list">
            {CLIENT_LOGOS.map((logo) => (
              <li key={logo.alt} className="client-logos-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${logo.src}?v=6`}
                  alt={logo.alt}
                  className="client-logo"
                  width={logo.width}
                  height={logo.height}
                  style={{
                    "--logo-width": `${logo.width}px`,
                    "--logo-height": `${logo.height}px`,
                    "--logo-mobile-width": `${logo.mobileWidth}px`,
                    "--logo-mobile-height": `${logo.mobileHeight}px`,
                  } as CSSProperties}
                  loading="eager"
                  decoding="async"
                  fetchPriority="low"
                />
              </li>
            ))}
          </ul>
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
              <p className="products-kicker">Co-VideoPro</p>
              <h2 id="co-apps-title" className="products-headline">Brief to <em>boardroom.</em></h2>
              <div className="products-divider" aria-hidden="true" />
              <p className="products-intro">{SUITE_INTRO}</p>
              <div className="products-grid">
                {SUITE_CARDS.map((product) => (
                  <a
                    key={product.id}
                    className="product-card"
                    href={product.href}
                    aria-label={product.ariaLabel}
                    style={{ "--card-accent": product.accent } as CSSProperties}
                  >
                    <div className="product-card-accent" aria-hidden="true" />
                    <div className="product-icon">{product.icon}</div>
                    <h3 className="product-wordmark">{product.name}</h3>
                    <p className="product-copy">{product.tagline}</p>
                    <p className="product-desc">{product.description}</p>
                    <span className="product-status">{product.cta}</span>
                  </a>
                ))}
              </div>
              <div className="products-coming">
                <span className="products-coming-label">{SUITE_COMING.label}</span>
                <p className="products-coming-title">{SUITE_COMING.title}</p>
                <p className="products-coming-text">{SUITE_COMING.description}</p>
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
                width={470}
                height={117}
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
