import Link from "next/link";
import Image from "next/image";
import { CCO_URLS, Nav } from "@contentco-op/ui";
import { BOOKING_PAGE_PATH, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";
import { HOME_PAGE_CONTENT } from "@/lib/content/site-content";
import { AmbientVideo } from "./ambient-video";
import { RotatingGallery } from "./rotating-gallery";

export default function HomePage() {
  return (
    <main className="page">
      <Nav surface="home" />

      <section className="hero">
        <AmbientVideo
          src="/cc/video/ambient-hero.mp4"
          poster="/cc/video/ambient-hero-poster.jpg"
          label="Industrial energy production footage"
        />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-content">
          <p className="hero-kicker">{HOME_PAGE_CONTENT.hero.kicker}</p>
          <h1>{HOME_PAGE_CONTENT.hero.headline}</h1>
          <p className="hero-lede">
            {HOME_PAGE_CONTENT.hero.body}
          </p>
          <div className="hero-actions">
            <Link className="button light" href={HOME_PAGE_CONTENT.hero.primaryCta.href}>
              {HOME_PAGE_CONTENT.hero.primaryCta.label}
            </Link>
            <Link className="button hero-tertiary" href={HOME_PAGE_CONTENT.hero.secondaryCta.href}>
              {HOME_PAGE_CONTENT.hero.secondaryCta.label}
            </Link>
          </div>
          <p className="hero-note">
            Have scope already? <Link href={HOME_PAGE_CONTENT.hero.noteHref}>{HOME_PAGE_CONTENT.hero.noteLabel}</Link>.
          </p>
        </div>
      </section>

      <section className="path-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Why teams bring us in</p>
            <h2 className="section-title">Credible environments, disciplined production, and delivery that holds up in review.</h2>
          </div>
          <p className="section-copy">
            The work needs to read clearly for crews, communications teams, and leadership without losing the feel of the real environment.
          </p>
        </div>
        <div className="path-grid">
          {HOME_PAGE_CONTENT.focusCards.map((card) => (
            <article key={card.title} className="path-card">
              <p className="path-label">{card.label}</p>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof">
        <div className="section-head proof-head">
          <div>
            <p className="section-kicker">{HOME_PAGE_CONTENT.proof.kicker}</p>
            <h2 className="section-title">{HOME_PAGE_CONTENT.proof.title}</h2>
          </div>
          <div className="proof-copy">
            <p>{HOME_PAGE_CONTENT.proof.body}</p>
            <Link href={HOME_PAGE_CONTENT.proof.ctaHref} className="proof-link">
              {HOME_PAGE_CONTENT.proof.ctaLabel} &rarr;
            </Link>
          </div>
        </div>
        <RotatingGallery images={[...HOME_PAGE_CONTENT.gallery]} columns={3} interval={6000} />
      </section>

      <section className="path-section">
          <div className="section-head">
            <div>
              <p className="section-kicker">Start here</p>
              <h2 className="section-title">Pick the clearest next move.</h2>
            </div>
            <p className="section-copy">
            Review the proof, book a call, or send the brief when the scope is already clear.
          </p>
        </div>
        <div className="path-grid">
          {HOME_PAGE_CONTENT.startCards.map((card) => (
            <Link key={card.title} href={card.href} className="path-card">
              <p className="path-label">{card.label}</p>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <span className="path-cta">{card.cta} &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="trust">
        <div className="trust-card">
          <div className="trust-text">
            <span className="trust-quote-mark" aria-hidden="true">&ldquo;</span>
            <blockquote>
              Twelve years in energy production. Every frame is a decision. We deliver work that reads
              clearly in the field, in review, and in the boardroom.
            </blockquote>
            <span className="trust-quote-mark trust-quote-close" aria-hidden="true">&rdquo;</span>
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
                <span className="trust-role">Founder, Content Co-op</span>
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

      <footer className="cc-footer">
        <div className="cc-footer-inner">
          <div className="cc-footer-brand">
            <Image src="/logos/lockup-3408.png" alt="Content Co-op" width={180} height={48} />
            <p className="muted">
              Content Co-op helps industrial teams plan, produce, and deliver high-stakes visual work with clarity.
            </p>
            <p className="muted">&copy; {new Date().getFullYear()} Content Co-op. All rights reserved.</p>
          </div>

          <div className="cc-footer-columns">
            <nav className="cc-footer-group" aria-label="Public site">
              <span className="cc-footer-heading">Public Site</span>
              <Link href={CCO_URLS.home}>Home</Link>
              <Link href={CCO_URLS.portfolio}>Portfolio</Link>
              <Link href={BOOKING_PAGE_PATH}>Book a Strategy Call</Link>
              <Link href={CREATIVE_BRIEF_PATH}>Creative Brief</Link>
            </nav>

            <nav className="cc-footer-group" aria-label="Next steps">
              <span className="cc-footer-heading">Next Steps</span>
              <Link href={CCO_URLS.portfolio}>Selected Work</Link>
              <Link href={BOOKING_PAGE_PATH}>Book a Strategy Call</Link>
              <Link href={CREATIVE_BRIEF_PATH}>Send the Creative Brief</Link>
            </nav>

            <nav className="cc-footer-group" aria-label="Access">
              <span className="cc-footer-heading">Access</span>
              <Link href="/login">Client Login</Link>
              <span className="cc-footer-note">Need to start a project first? Book the call or send the brief.</span>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
