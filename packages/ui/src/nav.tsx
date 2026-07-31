"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CCO_URLS, type CcoNavSurface, type CcoUrls } from "./cco-nav-config";

interface NavProps {
  surface: CcoNavSurface;
  urls?: Partial<CcoUrls>;
}

export function Nav({ surface, urls }: NavProps) {
  const u = { ...CCO_URLS, ...urls };
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  const briefActive = surface === "brief";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="cc-nav" data-surface={surface}>
      <div className="cc-nav-inner">
        <Link
          href={u.home}
          className="cc-nav-brand"
          aria-label="Content Co-op home"
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cc-nav-logo"
            src="/logos/lockup-3408.png?v=2"
            alt="Content Co-op"
            width="164"
            height="44"
            decoding="async"
            fetchPriority="high"
          />
        </Link>

        <nav className="cc-nav-links" aria-label="Primary navigation">
          <Link href={u.home} className={`cc-nav-link ${surface === "home" ? "active" : ""}`}>
            home
          </Link>
          <Link href={u.portfolio} className={`cc-nav-link ${surface === "portfolio" ? "active" : ""}`}>
            portfolio
          </Link>
          <Link href={u.brief} className={`cc-nav-link ${briefActive ? "active" : ""}`}>
            creative brief
          </Link>
        </nav>

        <div className="cc-nav-actions">
          <button
            type="button"
            className={`cc-nav-rail-trigger ${menuOpen ? "active" : ""}`}
            aria-expanded={menuOpen}
            aria-controls="cc-nav-mobile-panel"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="cc-nav-rail-trigger-lines" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="cc-nav-rail-trigger-label">Menu</span>
          </button>
        </div>
      </div>

      <div
        className={`cc-nav-rail-backdrop ${menuOpen ? "open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <aside
        id="cc-nav-mobile-panel"
        className={`cc-nav-rail ${menuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <div className="cc-nav-rail-top">
          <button
            type="button"
            className="cc-nav-rail-close"
            onClick={close}
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="cc-nav-rail-nav" aria-label="Site">
          <Link href={u.home} className={`cc-nav-rail-link ${surface === "home" ? "active" : ""}`} onClick={close}>
            <span className="cc-nav-rail-index">01</span>
            <span>Home</span>
          </Link>
          <Link href={u.portfolio} className={`cc-nav-rail-link ${surface === "portfolio" ? "active" : ""}`} onClick={close}>
            <span className="cc-nav-rail-index">02</span>
            <span>Portfolio</span>
          </Link>
          <Link href={u.brief} className={`cc-nav-rail-link ${briefActive ? "active" : ""}`} onClick={close}>
            <span className="cc-nav-rail-index">03</span>
            <span>Creative Brief</span>
          </Link>
        </nav>

        <Link href={u.brief} className="cc-nav-rail-cta" onClick={close}>
          <span>Start a project</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>

        <div className="cc-nav-rail-foot">
          <a href="mailto:service@contentco-op.com" className="cc-nav-rail-contact">
            service@contentco-op.com
          </a>
          <span className="cc-nav-rail-loc">Houston, TX</span>
        </div>
      </aside>
    </header>
  );
}
