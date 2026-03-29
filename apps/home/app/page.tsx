import Link from "next/link";
import Image from "next/image";
import { CCO_URLS, Nav } from "@contentco-op/ui";
import { PublicFooter } from "./components/public-footer";
import { AmbientVideo } from "./ambient-video";
import { HeroCopyRotator } from "./hero-copy-rotator";
import {
  galleryImages,
  heroPoster,
  heroVideo,
  productsAmbientPoster,
} from "./home-content";
import { PRODUCTS } from "./home-copy";
import { RotatingGallery } from "./rotating-gallery";

const PRODUCT_META: Record<string, { step: string; accent: string; icon: React.ReactNode }> = {
  Script: {
    step: "01",
    accent: "#4c8ef5",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  Cut: {
    step: "02",
    accent: "#a78bf5",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="3" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="15" x2="22" y2="15" />
        <line x1="9" y1="9" x2="9" y2="22" />
        <line x1="15" y1="9" x2="15" y2="22" />
      </svg>
    ),
  },
  Deliver: {
    step: "03",
    accent: "#2dd4bf",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
};

export default function HomePage() {
  return (
    <main className="page">
      <Nav surface="home" />

      <section className="hero">
        <AmbientVideo
          src={heroVideo}
          poster={heroPoster}
          label="Industrial energy production footage"
          forcePlayback
        />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-content">
          <HeroCopyRotator />
          <p className="hero-lede">
            Industrial stories that hold
            <br />
            up under scrutiny.
          </p>
          <div className="hero-actions">
            <a className="button light compact" href={CCO_URLS.brief}>Creative Brief</a>
            <a className="button ghost compact" href={CCO_URLS.bookingAlias}>Book a Call</a>
          </div>
        </div>
      </section>

      <section className="client-logos" aria-label="Trusted by">
        <div className="client-logos-ticker">
          {[0, 1].map((copy) => (
            <div key={copy} className="client-logos-track" aria-hidden={copy === 1}>
              {[
                { src: "/cc/logos/bp.svg", alt: "BP", h: 20 },
                { src: "/cc/logos/shell.svg", alt: "Shell", h: 16 },
                { src: "/cc/logos/schneider-electric.png", alt: "Schneider Electric", h: 22 },
                { src: "/cc/logos/abb.png", alt: "ABB", h: 16 },
                { src: "/cc/logos/maersk.svg", alt: "Maersk", h: 16 },
                { src: "/cc/logos/citgo.png", alt: "CITGO", h: 20 },
                { src: "/cc/logos/copart.png", alt: "Copart", h: 18 },
                { src: "/cc/logos/conexon.png", alt: "Conexon", h: 18 },
                { src: "/cc/logos/wendys.png", alt: "Wendy's", h: 18 },
                { src: "/cc/logos/ubs.svg", alt: "UBS", h: 16 },
                { src: "/cc/logos/kodiak.svg", alt: "Kodiak", h: 14 },
                { src: "/cc/logos/facebook.svg", alt: "Facebook", h: 14 },
                { src: "/cc/logos/mueller.svg", alt: "Mueller", h: 14 },
                { src: "/cc/logos/pierpont.svg", alt: "Pierpont", h: 14 },
                { src: "/cc/logos/nature-conferences.png", alt: "Nature Conferences", h: 18 },
              ].map((logo) => (
                <img key={logo.alt} src={logo.src} alt={logo.alt} className="client-logo" height={logo.h} loading="lazy" />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section id="work" aria-label="Selected work">
        <RotatingGallery images={galleryImages} columns={3} interval={6000} />
      </section>

      <section className="products">
        <div className="products-backdrop" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productsAmbientPoster}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }}
          />
        </div>
        <div className="products-overlay" aria-hidden="true" />
        <div className="products-content">
          <p className="products-kicker">The Co-Apps Suite</p>
          <h2 className="products-headline">Brief to boardroom.</h2>
          <div className="products-grid">
            {PRODUCTS.items.map((p) => {
              const meta = PRODUCT_META[p.name];
              return (
                <Link
                  key={p.name}
                  className="product-card"
                  href={p.href}
                  style={{ "--accent": meta.accent } as React.CSSProperties}
                >
                  <div className="product-step">{meta.step}</div>
                  <div className="product-icon">{meta.icon}</div>
                  <div className="product-wordmark">
                    <span className="product-co">{p.prefix}</span>{p.name}
                  </div>
                  <p className="product-copy">{p.tagline}</p>
                  <p className="product-desc">{p.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="trust">
        <div className="trust-inner">
          <blockquote className="trust-quote">
            In high-stakes industries, video isn&rsquo;t content&nbsp;— it&rsquo;s institutional capital. The organizations that understand this will define how expertise moves.
          </blockquote>
          <div className="trust-photo">
            <Image
              src="/cc/photos/bailey-headshot.jpg"
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

      <PublicFooter />
    </main>
  );
}
