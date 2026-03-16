import Link from "next/link";
import Image from "next/image";
import { Nav } from "@contentco-op/ui";
import { AmbientVideo } from "./ambient-video";
import { galleryImages, heroClips } from "./home-content";
import { RotatingGallery } from "./rotating-gallery";
import { HeroSection } from "./hero-section";

export default function HomePage() {
  return (
    <main className="page">
      <Nav surface="home" />

      {/* ─── S1: Hero — rotating clips + rotating taglines ─── */}
      <HeroSection clips={heroClips} />

      {/* ─── S2: Full-Bleed Positioning ─── */}
      <section className="bleed">
        <Image
          src="/cc/photos/seagull-rope-access.jpg"
          alt="Rope access workers on offshore platform legs above the ocean"
          fill
          sizes="100vw"
          quality={85}
          priority
        />
        <div className="bleed-overlay" aria-hidden="true" />
        <p className="bleed-statement">
          We build content systems that survive the boardroom.
        </p>
      </section>

      {/* ─── S3: Work Gallery — rotating crossfade ─── */}
      <RotatingGallery images={galleryImages} columns={3} interval={6000} />

      {/* ─── S4: Products ─── */}
      <section className="products">
        <AmbientVideo
          src="/cc/video/ambient-products.mp4"
          poster="/cc/video/ambient-products-poster.jpg"
          label="Industrial refinery at sunset"
        />
        <div className="products-overlay" aria-hidden="true" />
        <div className="products-content">
          <p className="products-kicker">Script. Create. Edit. Deliver.</p>
          <div className="products-grid products-grid-2x2">
            <a className="product-card" href="https://coscript.contentco-op.com">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Script
              </div>
              <p className="product-stage">Pre-Production</p>
              <p>Shot structures, interview watchlists, and AI-assisted scripts built for industrial environments. From brief to production-ready in one tool.</p>
              <span className="product-cta">Open Co-Script &rarr;</span>
            </a>
            <a className="product-card" href="https://coedit.contentco-op.com">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Edit
              </div>
              <p className="product-stage">Post-Production</p>
              <p>Browser-native timeline editor with AI-assisted cuts, waveform-first assembly, and a media bin built for field-to-boardroom turnarounds.</p>
              <span className="product-cta">Open Co-Edit &rarr;</span>
            </a>
            <Link className="product-card" href="/book">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Create
              </div>
              <p className="product-stage">Discovery</p>
              <p>Live scoping before production begins. Align deliverables, timeline, access, and budget in a single strategy call — then send the brief to confirm scope.</p>
              <span className="product-cta">Book a Strategy Call &rarr;</span>
            </Link>
            <a className="product-card" href="https://codeliver.contentco-op.com">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Deliver
              </div>
              <p className="product-stage">Delivery</p>
              <p>Timecoded review with version control and stakeholder sign-off in one shareable link. No email chains, no confused feedback loops.</p>
              <span className="product-cta">Open Co-Deliver &rarr;</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── S5: Trust / Quote ─── */}
      <section className="trust">
        <div className="trust-card">
          <div className="trust-text">
            <blockquote>
              Twelve years in energy production. Every frame is a decision.
              We deliver on time — from strategy to final cut.
            </blockquote>
            <div className="trust-byline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="trust-signature"
                src="/cc/signature-bailey.png"
                alt="Bailey Eubanks signature"
                width={160}
                height={60}
              />
              <div className="trust-attribution">
                <span className="trust-name">Bailey Eubanks</span>
                <span className="trust-role">Content Co-op</span>
              </div>
            </div>
          </div>
          <div className="trust-photo">
            <Image
              src="/cc/photos/bailey-headshot.jpg"
              alt="Bailey Eubanks"
              width={600}
              height={800}
              sizes="(max-width: 768px) 40vw, 200px"
              quality={85}
              className="trust-photo-image"
            />
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="cc-footer">
        <div className="cc-footer-bottom">
          <div className="cc-footer-brand">
            <Image src="/logos/lockup-3408.png" alt="Content Co-op" width={120} height={32} />
            <p className="muted">&copy; {new Date().getFullYear()} Content Co-op.</p>
          </div>
          <nav className="cc-footer-links" aria-label="Footer links">
            <Link href="/">Home</Link>
            <Link href="/portfolio">Portfolio</Link>
            <a href="https://coedit.contentco-op.com">Co-Edit</a>
            <a href="https://coscript.contentco-op.com">Co-Script</a>
            <a href="https://codeliver.contentco-op.com">Co-Deliver</a>
            <Link href="/brief">Creative Brief</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
