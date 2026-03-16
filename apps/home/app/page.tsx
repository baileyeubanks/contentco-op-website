import Link from "next/link";
import Image from "next/image";
import { Nav } from "@contentco-op/ui";
import { AmbientVideo } from "./ambient-video";
import { RotatingGallery } from "./rotating-gallery";
import { HeroSection } from "./hero-section";

// Core hero B-roll + screened portfolio clips (clean single shots, no graphics)
// Excluded: hero-4 (blur pan), hero-15 (office workers), hero-16 (Wild Bean Cafe),
//           hero-22 (AI monitor wall), hero-34 (picture wall AI hallucination), hero-37 (blur pan)
const heroClips = [
  // Core hero B-roll — individually vetted clean shots
  "/cc/video/hero-1.mp4",
  "/cc/video/hero-2.mp4",
  "/cc/video/hero-3.mp4",
  "/cc/video/hero-5.mp4",
  "/cc/video/hero-6.mp4",
  "/cc/video/hero-7.mp4",
  "/cc/video/hero-8.mp4",
  "/cc/video/hero-9.mp4",
  "/cc/video/hero-10.mp4",
  "/cc/video/hero-11.mp4",
  "/cc/video/hero-12.mp4",
  "/cc/video/hero-13.mp4",
  "/cc/video/hero-14.mp4",
  "/cc/video/hero-17.mp4",
  "/cc/video/hero-18.mp4",
  "/cc/video/hero-19.mp4",
  // BP Orlando AI B-roll — clean cinematic, no text overlays
  "/cc/video/hero-20.mp4",  // Industrial facility under blue sky
  "/cc/video/hero-21.mp4",  // Oil rig in open ocean
  "/cc/video/hero-23.mp4",  // Helicopter over offshore platform at sunset
  "/cc/video/hero-24.mp4",  // Worker overlooking industrial refinery
  "/cc/video/hero-25.mp4",  // Industrial skyline at dusk pink/blue
  "/cc/video/hero-26.mp4",  // Worker on offshore platform stairs + ocean
  "/cc/video/hero-27.mp4",  // Refinery with snow-capped mountain backdrop
  "/cc/video/hero-28.mp4",  // Offshore wind farm open ocean aerial
  "/cc/video/hero-29.mp4",  // Wind turbine top — workers on nacelle
  "/cc/video/hero-30.mp4",  // Wind turbine construction crane close-up
  "/cc/video/hero-31.mp4",  // Wind turbine blade installation aerial
  "/cc/video/hero-32.mp4",  // Crane operator in cab — offshore vessel
  "/cc/video/hero-33.mp4",  // Worker in coveralls at industrial facility
  "/cc/video/hero-35.mp4",  // Refinery at golden sunset — aerial
  "/cc/video/hero-38.mp4",  // Yellow helicopter on offshore platform helipad — aerial zoom to golden sunset crew silhouettes
  "/cc/video/hero-36.mp4",  // Workers inspecting gas facility in desert
  // Portfolio preview clips — verified clean: no title cards, no logos, no talking heads
  "/cc/portfolio-cdn/preview_citgo_ep5.mp4",   // Refinery worker walking through pipework
  "/cc/portfolio-cdn/preview_citgo_ep9.mp4",   // Workers in respirators / hard hats
];

const gallery = [
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
              fill
              sizes="300px"
              quality={85}
              style={{ pointerEvents: "none" }}
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
