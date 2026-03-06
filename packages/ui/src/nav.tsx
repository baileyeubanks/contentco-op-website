"use client";

interface NavProps {
  /** Which product surface is active. "cocut" replaces the old "coedit"/"cocreate" surfaces. */
  surface: "home" | "portfolio" | "cocut" | "coscript" | "codeliver";
  urls?: {
    home?: string;
    portfolio?: string;
    cocut?: string;
    coscript?: string;
    codeliver?: string;
  };
}

const prodUrls = {
  home: "https://contentco-op.com",
  portfolio: "https://contentco-op.com/portfolio",
  cocut: "https://cut.contentco-op.com",
  coscript: "https://script.contentco-op.com",
  codeliver: "https://deliver.contentco-op.com",
};

export function Nav({ surface, urls }: NavProps) {
  const u = { ...prodUrls, ...urls };

  return (
    <header className="cc-nav">
      <div className="cc-nav-inner">
        <a href={u.home} className="cc-nav-brand" aria-label="Content Co-op home">
          <span className="cc-nav-wordmark">content co-op</span>
        </a>

        <nav className="cc-nav-links" aria-label="Primary navigation">
          <a href={u.home} className={`cc-nav-link ${surface === "home" ? "active" : ""}`}>
            home
          </a>
          <a href={u.portfolio} className={`cc-nav-link ${surface === "portfolio" ? "active" : ""}`}>
            portfolio
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
          <a href={`${u.home}/login`} className="button small">
            client login
          </a>
        </div>
      </div>
    </header>
  );
}
