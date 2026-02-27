"use client";

interface NavProps {
  surface: "home" | "portfolio" | "coedit" | "coscript" | "codeliver" | "cocreate";
  urls?: {
    home?: string;
    portfolio?: string;
    coedit?: string;
    coscript?: string;
    codeliver?: string;
    cocreate?: string;
  };
}

const prodUrls = {
  home: "https://contentco-op.com",
  portfolio: "https://contentco-op.com/portfolio",
  coedit: "https://coedit.contentco-op.com",
  coscript: "https://coscript.contentco-op.com",
  codeliver: "https://codeliver.contentco-op.com",
  cocreate: "https://contentco-op.com/cocreate",
};

export function Nav({ surface, urls }: NavProps) {
  const u = { ...prodUrls, ...urls };

  return (
    <header className="cc-nav">
      <div className="cc-nav-inner">
        <a href={u.home} className="cc-nav-brand" aria-label="Content Co-op home">
          <span className="cc-nav-wordmark">Content Co-op</span>
        </a>

        <nav className="cc-nav-links" aria-label="Primary navigation">
          <a href={u.home} className={`cc-nav-link ${surface === "home" ? "active" : ""}`}>
            Home
          </a>
          <a href={u.portfolio} className={`cc-nav-link ${surface === "portfolio" ? "active" : ""}`}>
            Portfolio
          </a>
          <a href={u.coedit} className={`cc-nav-link ${surface === "coedit" ? "active" : ""}`}>
            Co-Edit
          </a>
          <a href={u.coscript} className={`cc-nav-link ${surface === "coscript" ? "active" : ""}`}>
            Co-Script
          </a>
          <a href={u.codeliver} className={`cc-nav-link ${surface === "codeliver" ? "active" : ""}`}>
            Co-Deliver
          </a>
          <a href={u.cocreate} className={`cc-nav-link ${surface === "cocreate" ? "active" : ""}`}>
            Co-Create
          </a>
        </nav>

        <div className="cc-nav-actions">
          <a href={`${u.home}/login`} className="button small">
            Client Login
          </a>
        </div>
      </div>
    </header>
  );
}
