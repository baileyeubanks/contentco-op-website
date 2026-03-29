"use client";

import { useEffect, useState } from "react";
import { CCO_URLS, type CcoNavSurface, type CcoUrls } from "./cco-nav-config";

interface NavProps {
  surface: CcoNavSurface;
  urls?: Partial<CcoUrls>;
}

export function Nav({ surface, urls }: NavProps) {
  const u = { ...CCO_URLS, ...urls };
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const suiteActive =
    surface === "suite" ||
    surface === "cocut" ||
    surface === "coscript" ||
    surface === "codeliver";
  const briefActive = surface === "brief" || surface === "booking";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const sync = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setMenuOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
        <a
          href={u.home}
          className="cc-nav-brand"
          aria-label="Content Co-op home"
          onClick={() => setMenuOpen(false)}
        >
          <img
            className="cc-nav-logo"
            src="/logos/lockup-3408.png"
            alt="Content Co-op"
            width="164"
            height="44"
          />
        </a>

        {!isMobile ? (
          <nav className="cc-nav-links" aria-label="Primary navigation">
            <a href={u.portfolio} className={`cc-nav-link ${surface === "portfolio" ? "active" : ""}`}>
              portfolio
            </a>
            <a href={u.suite} className={`cc-nav-link ${suiteActive ? "active" : ""}`}>
              product suite
            </a>
            <a href={u.brief} className={`cc-nav-link ${briefActive ? "active" : ""}`}>
              creative brief
            </a>
            <a href={u.bookingAlias} className={`cc-nav-link ${surface === "booking" ? "active" : ""}`}>
              book a call
            </a>
          </nav>
        ) : (
          <>
            <div className="cc-nav-mobile-row">
              <a href={u.bookingAlias} className="cc-nav-action-cta">
                book a call
              </a>
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
                <a
                  href={u.portfolio}
                  className={`cc-nav-mobile-link ${surface === "portfolio" ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  Portfolio
                </a>
                <a
                  href={u.suite}
                  className={`cc-nav-mobile-link ${suiteActive ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  Product Suite
                </a>
                <a
                  href={u.brief}
                  className={`cc-nav-mobile-link ${briefActive ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  Creative Brief
                </a>
                <a
                  href={u.bookingAlias}
                  className={`cc-nav-mobile-link ${surface === "booking" ? "active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  Book a Call
                </a>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}
