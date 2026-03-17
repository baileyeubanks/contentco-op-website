"use client";

import { CCO_URLS, type CcoNavSurface, type CcoUrls } from "./cco-nav-config";

interface NavProps {
  surface: CcoNavSurface;
  urls?: Partial<CcoUrls>;
}

export function Nav({ surface, urls }: NavProps) {
  const u = { ...CCO_URLS, ...urls };

  return (
    <header className="cc-nav">
      <div className="cc-nav-inner">
        <a href={u.home} className="cc-nav-brand" aria-label="Content Co-op home">
          <img
            className="cc-nav-logo"
            src="/logos/lockup-3408.png"
            alt="Content Co-op"
            width="120"
            height="32"
          />
        </a>

        <nav className="cc-nav-links" aria-label="Primary navigation">
          <a
            href={u.monorepo}
            target="_blank"
            rel="noreferrer"
            className={`cc-nav-link ${surface === "monorepo" ? "active" : ""}`}
          >
            monorepo
          </a>
          <a href={u.home} className={`cc-nav-link ${surface === "home" ? "active" : ""}`}>
            home
          </a>
          <a href={u.portfolio} className={`cc-nav-link ${surface === "portfolio" ? "active" : ""}`}>
            portfolio
          </a>
          <a href={u.brief} className={`cc-nav-link ${surface === "brief" ? "active" : ""}`}>
            brief
          </a>
          <a href={u.booking} className={`cc-nav-link ${surface === "booking" ? "active" : ""}`}>
            book
          </a>
          <a href={u.cocut} className={`cc-nav-link ${surface === "cocut" ? "active" : ""}`}>
            co-cut
          </a>
          <a href={u.coscript} className={`cc-nav-link ${surface === "coscript" ? "active" : ""}`}>
            co-script
          </a>
          <a href={u.codeliver} className={`cc-nav-link ${surface === "codeliver" ? "active" : ""}`}>
            co-deliver
          </a>
        </nav>

        <div className="cc-nav-actions">
          <a href={u.client} className={`button small ${surface === "login" ? "active" : ""}`}>
            client login
          </a>
        </div>
      </div>
    </header>
  );
}
