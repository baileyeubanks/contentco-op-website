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

  const briefActive = surface === "brief";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="cc-nav" data-surface={surface}>
      <div className="cc-nav-inner">
        <Link
          href={u.home}
          className="cc-nav-brand"
          aria-label="Content Co-op home"
          onClick={() => setMenuOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cc-nav-logo"
            src="/logos/lockup-3408.png"
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

        <>
          <div className="cc-nav-mobile-row">
            <button
              type="button"
              className={`cc-nav-menu-btn ${menuOpen ? "active" : ""}`}
              aria-expanded={menuOpen}
              aria-controls="cc-nav-mobile-panel"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "close" : "menu"}
            </button>
          </div>

          {menuOpen ? (
            <nav
              id="cc-nav-mobile-panel"
              className="cc-nav-mobile-panel"
              aria-label="Mobile navigation"
            >
              <Link
                href={u.home}
                className={`cc-nav-mobile-link ${surface === "home" ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href={u.portfolio}
                className={`cc-nav-mobile-link ${surface === "portfolio" ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                Portfolio
              </Link>
              <Link
                href={u.brief}
                className={`cc-nav-mobile-link ${briefActive ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                Creative Brief
              </Link>
            </nav>
          ) : null}
        </>
      </div>
    </header>
  );
}
