import Image from "next/image";
import { Nav } from "@contentco-op/ui";
import { AmbientVideo } from "./ambient-video";
import { RotatingGallery } from "./rotating-gallery";

const heroClips = Array.from({ length: 19 }, (_, i) => `/cc/video/hero-${i + 1}.mp4`);

const gallery = [
  // CC portfolio — real work
  { src: "/cc/photos/gallery-control-room.jpg", alt: "BP control room operator monitoring screens", label: "Whiting Refinery", tag: "Production" },
  { src: "/cc/photos/gallery-drone-platform.jpg", alt: "DJI Inspire drone on offshore platform", label: "Aerial Unit", tag: "BTS" },
  { src: "/cc/photos/gallery-crew-refinery.jpg", alt: "CC crew prepping gimbal at refinery", label: "BP Whiting", tag: "BTS" },
  { src: "/cc/photos/gallery-crew-field-shoot.jpg", alt: "CC crew shooting in tall grass", label: "Fowler Ridge", tag: "BTS" },
  { src: "/cc/photos/gallery-machinist-cnc.jpg", alt: "Machinist operating CNC mill", label: "Precision MFG", tag: "Industrial" },
  { src: "/cc/photos/gallery-fire-gear-rack.jpg", alt: "Fire gear rack with American flag patch", label: "First Response", tag: "Safety" },
  { src: "/cc/photos/gallery-kodiak-crew.jpg", alt: "Kodiak field crew in hard hats", label: "Permian Basin", tag: "Upstream" },
  { src: "/cc/photos/gallery-lineman-boom.jpg", alt: "Lineman with boom mic reflector", label: "Wind Farm", tag: "Production" },
  { src: "/cc/photos/gallery-campus-sunflare.jpg", alt: "Corporate campus walkway at golden hour", label: "BP Houston", tag: "Corporate" },
  { src: "/cc/photos/gallery-ceraweek-speaker.jpg", alt: "CeraWeek conference speaker", label: "CeraWeek", tag: "Events" },
  // Stock industrial B-roll stills
  { src: "/cc/photos/fowler-wind-turbine.jpg", alt: "Wind turbine blade assembly at Fowler Ridge", label: "Fowler Ridge", tag: "Wind" },
  { src: "/cc/photos/whiting-refinery-sunset.jpg", alt: "Whiting Refinery skyline at golden hour", label: "Whiting Refinery", tag: "Downstream" },
  { src: "/cc/photos/gallery-wind-turbine-crane.jpg", alt: "Wind turbine crane lift at height", label: "Crane Lift", tag: "Wind" },
  { src: "/cc/photos/gallery-refinery-mountains.jpg", alt: "Refinery with snow-capped mountains", label: "Cherry Point", tag: "Downstream" },
  { src: "/cc/photos/gallery-helipad-sunset.jpg", alt: "Offshore helipad at golden hour", label: "Atlantis", tag: "Offshore" },
  { src: "/cc/photos/gallery-aerial-solar.jpg", alt: "Aerial view of solar farm", label: "Solar Array", tag: "Renewables" },
  { src: "/cc/photos/gallery-bp-tower-drone.jpg", alt: "BP tower drone shot at dusk", label: "Houston HQ", tag: "Corporate" },
  { src: "/cc/photos/gallery-desert-tanks.jpg", alt: "Desert storage tanks at golden hour", label: "Permian Basin", tag: "Upstream" },
  { src: "/cc/photos/gallery-refinery-pink-sunset.jpg", alt: "Refinery skyline with pink sunset and steam", label: "Whiting", tag: "Downstream" },
  { src: "/cc/photos/gallery-gas-station-sunset.jpg", alt: "Gas station at sunset", label: "Retail", tag: "Downstream" },
  { src: "/cc/photos/seagull-rope-access.jpg", alt: "Rope access workers on offshore platform", label: "Project Seagull", tag: "Offshore" },
];

export default function HomePage() {
  return (
    <main className="page">
      <Nav surface="home" />

      {/* ─── S1: Hero — rotating B-roll clips ─── */}
      <section className="hero">
        <AmbientVideo
          src={heroClips}
          poster="/cc/video/ambient-hero-poster.jpg"
          label="Industrial energy production footage"
        />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-content">
          <h1>
            <span className="hero-thin">Minimal stage,</span>
            <br />
            <em>maximum signal.</em>
          </h1>
          <a className="button light" href="/onboard">
            Begin Onboarding
          </a>
        </div>
      </section>

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
      <RotatingGallery images={gallery} columns={3} interval={6000} />

      {/* ─── S4: Products ─── */}
      <section className="products">
        <AmbientVideo
          src="/cc/video/ambient-products.mp4"
          poster="/cc/video/ambient-products-poster.jpg"
          label="Industrial refinery at sunset"
        />
        <div className="products-overlay" aria-hidden="true" />
        <div className="products-content">
          <p className="products-kicker">Script. Create. Proof.</p>
          <div className="products-grid">
            <a className="product-card" href="https://coscript.contentco-op.com">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Script
              </div>
              <p className="product-stage">Pre-Production</p>
              <p>Watchlists. Outlier detection. Publish-ready scripts.</p>
              <span className="product-cta">Open Co-Script &rarr;</span>
            </a>
            <a className="product-card" href="https://contentco-op.com/cocreate">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Create
              </div>
              <p className="product-stage">Production</p>
              <p>Rapid sound-bite editing. Waveform-first. Interview-ready cuts.</p>
              <span className="product-cta">Coming Soon</span>
            </a>
            <a className="product-card" href="https://coproof.contentco-op.com">
              <div className="product-wordmark">
                <span className="product-co">Co-</span>Proof
              </div>
              <p className="product-stage">Delivery</p>
              <p>Timecoded review. Version control. Stakeholder sign-off.</p>
              <span className="product-cta">Open Co-Proof &rarr;</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── S5: Trust / Quote ─── */}
      <section className="trust">
        <div className="trust-card">
          <div className="trust-text">
            <span className="trust-quote-mark" aria-hidden="true">&ldquo;</span>
            <blockquote>
              Twelve years in energy production. Every frame is a decision.
              We deliver on time — from strategy to final cut.
            </blockquote>
            <span className="trust-quote-mark trust-quote-close" aria-hidden="true">&rdquo;</span>
            <div className="trust-attribution">
              <span className="trust-name">Bailey Eubanks</span>
              <span className="trust-role">Content Co-op</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="trust-signature"
              src="/cc/signature-bailey.png"
              alt="Bailey Eubanks signature"
              width={220}
              height={82}
            />
          </div>
          <div className="trust-photo">
            <Image
              src="/cc/photos/bailey-headshot.jpg"
              alt="Bailey Eubanks"
              fill
              sizes="300px"
              quality={85}
            />
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="cc-footer">
        <div className="cc-footer-inner">
          <div className="cc-footer-brand">
            <Image src="/logos/lockup-3408.png" alt="Content Co-op" width={180} height={48} />
            <p className="muted">&copy; {new Date().getFullYear()} Content Co-op. All rights reserved.</p>
          </div>
          <nav className="cc-footer-links" aria-label="Footer links">
            <a href="/">Home</a>
            <a href="/portfolio">Portfolio</a>
            <a href="https://coscript.contentco-op.com">Co-Script</a>
            <a href="https://coproof.contentco-op.com">Co-Proof</a>
            <a href="/login">Client Login</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
