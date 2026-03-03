"use client";

import { useState, useRef, useEffect } from "react";
import { Nav } from "@contentco-op/ui";

interface PortfolioItem {
  id: string;
  title: string;
  client: string;
  category: string;
  description: string;
  thumbnail: string;       // hero clip (video) for grid preview
  poster: string;          // still image for initial display / lightbox poster
  videoUrl: string;        // full clip (same as thumbnail for now)
  year: string;
  duration?: string;       // e.g. "2:04"
}

const CATEGORIES = ["All", "Energy", "Industrial", "Corporate", "Aerial", "Event"];

// ── Portfolio Items ─────────────────────────────────────────────
// Master sources live in ~/Desktop/CC_PORTFOLIO/
// hero-N.mp4 clips are web-optimized transcodes (1080p H.264)
// Poster stills from Figma handoff (3 per source, _t1/_t2/_t3)
const ITEMS: PortfolioItem[] = [
  {
    id: "accurate-meter",
    title: "Accurate Meter",
    client: "Accurate Meter & Supply",
    category: "Energy",
    description:
      "Full production brand film showcasing precision measurement solutions for the energy sector. Multi-day shoot spanning facilities, field operations, and executive interviews.",
    thumbnail: "/cc/video/hero-1.mp4",
    poster: "/cc/portfolio/accurate-meter_final-x_t2.jpg",
    videoUrl: "/cc/video/hero-1.mp4",
    year: "2025",
    duration: "1:43",
  },
  {
    id: "gno",
    title: "GNO Campaign",
    client: "GNO Inc.",
    category: "Corporate",
    description:
      "Multi-part corporate storytelling campaign for energy industry leadership. Cinematic interviews and facility coverage across multiple locations.",
    thumbnail: "/cc/video/hero-3.mp4",
    poster: "/cc/portfolio/gno_03_t1.jpg",
    videoUrl: "/cc/video/hero-3.mp4",
    year: "2025",
    duration: "0:53",
  },
  {
    id: "blankets",
    title: "Industrial Safety",
    client: "BBB Industrial",
    category: "Industrial",
    description:
      "Safety-focused industrial process documentation and training content. High-detail capture of manufacturing procedures for compliance and onboarding.",
    thumbnail: "/cc/video/hero-5.mp4",
    poster: "/cc/portfolio/bbb_03_t1.jpg",
    videoUrl: "/cc/video/hero-5.mp4",
    year: "2025",
    duration: "0:34",
  },
  {
    id: "tray30",
    title: "Tray30",
    client: "Tray Manufacturing",
    category: "Energy",
    description:
      "High-end facility walkthrough and process demonstration for tray manufacturing. Precision engineering captured with cinematic production value.",
    thumbnail: "/cc/video/hero-7.mp4",
    poster: "/cc/portfolio/tray30-01-v1_t2.jpg",
    videoUrl: "/cc/video/hero-7.mp4",
    year: "2024",
    duration: "0:27",
  },
  {
    id: "bpms-drone",
    title: "BPMS150 Aerial",
    client: "BP MS 150",
    category: "Aerial",
    description:
      "Cinematic drone coverage of the BP MS 150 finish line. Large-scale aerial storytelling capturing thousands of riders crossing the finish.",
    thumbnail: "/cc/video/hero-9.mp4",
    poster: "/cc/portfolio/bpms150_drone_finishline1_t1.jpg",
    videoUrl: "/cc/video/hero-9.mp4",
    year: "2024",
    duration: "0:18",
  },
  {
    id: "title-promo",
    title: "Jumbotron Promo",
    client: "Houston Texans",
    category: "Corporate",
    description:
      "Promotional content designed for jumbotron and large format display at NRG Stadium. High-impact visuals optimized for massive LED screens.",
    thumbnail: "/cc/video/hero-11.mp4",
    poster: "/cc/portfolio/the-title-promo_x_2_t2.jpg",
    videoUrl: "/cc/video/hero-11.mp4",
    year: "2024",
    duration: "0:28",
  },
  {
    id: "hlsr",
    title: "HLSR Coverage",
    client: "Houston Livestock Show & Rodeo",
    category: "Event",
    description:
      "Full event coverage with multiple camera angles and highlight reels for one of the world\u2019s largest livestock exhibitions and rodeo events.",
    thumbnail: "/cc/video/hero-13.mp4",
    poster: "",
    videoUrl: "/cc/video/hero-13.mp4",
    year: "2024",
    duration: "0:36",
  },
  {
    id: "schneider",
    title: "Schneider Electric",
    client: "Schneider Electric",
    category: "Energy",
    description:
      "Technical facility tour and product demonstration for global energy management and automation solutions. Engineering precision meets cinematic quality.",
    thumbnail: "/cc/video/hero-15.mp4",
    poster: "",
    videoUrl: "/cc/video/hero-15.mp4",
    year: "2024",
    duration: "0:27",
  },
  {
    id: "adaptive",
    title: "Adaptive Solutions",
    client: "Adaptive",
    category: "Corporate",
    description:
      "Brand story film highlighting adaptive technology solutions for the energy sector. Narrative-driven piece combining interviews and field footage.",
    thumbnail: "/cc/video/hero-17.mp4",
    poster: "",
    videoUrl: "/cc/video/hero-17.mp4",
    year: "2023",
    duration: "0:24",
  },
];

// ── Colors ──────────────────────────────────────────────────────
const C = {
  bg: "#0c1322",
  card: "#101b2e",
  cardBorder: "#1e3454",
  cardHover: "#6b9fd4",
  accent: "#6b9fd4",
  label: "#5a7ea8",
  muted: "#7a9bc4",
  text: "#edf3ff",
  dim: "#4a6888",
};

export default function PortfolioPage() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<PortfolioItem | null>(null);

  const filtered =
    filter === "All" ? ITEMS : ITEMS.filter((i) => i.category === filter);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (selected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <Nav surface="portfolio" />

      {/* Header */}
      <header style={{ textAlign: "center", padding: "5rem 1rem 2rem" }}>
        <p style={{ fontSize: ".72rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.accent, fontWeight: 700, margin: "0 0 .4rem" }}>
          Portfolio
        </p>
        <h1 style={{ margin: "0 0 .5rem", fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-.03em", fontWeight: 700, lineHeight: 1 }}>
          Our Work
        </h1>
        <p style={{ color: C.muted, fontSize: ".92rem", lineHeight: 1.5, maxWidth: 540, margin: "0 auto" }}>
          Energy. Industrial. Corporate. Every frame tells a story.
        </p>
      </header>

      {/* Category filter */}
      <div style={{ display: "flex", justifyContent: "center", gap: ".4rem", flexWrap: "wrap", padding: "0 1rem 2.5rem" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: ".42rem .88rem",
              border: `1px solid ${filter === cat ? C.accent : C.cardBorder}`,
              borderRadius: 999,
              background: filter === cat ? "rgba(107, 159, 212, 0.14)" : C.card,
              color: filter === cat ? C.text : C.muted,
              fontSize: ".76rem",
              fontWeight: 600,
              letterSpacing: ".03em",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video grid */}
      <div style={{ width: "min(1200px, 94vw)", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.2rem", padding: "0 0 3rem" }}>
        {filtered.map((item) => (
          <PortfolioCard key={item.id} item={item} onSelect={setSelected} />
        ))}
      </div>

      {/* CTA section */}
      <section style={{ textAlign: "center", padding: "2rem 1rem 5rem" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "2.5rem 2rem", background: "linear-gradient(160deg, #131f36, #0d1828)", border: `1px solid ${C.cardBorder}`, borderRadius: 20 }}>
          <h2 style={{ margin: "0 0 .6rem", fontSize: "1.4rem", fontWeight: 700 }}>
            Ready to tell your story?
          </h2>
          <p style={{ margin: "0 0 1.4rem", color: C.muted, fontSize: ".88rem", lineHeight: 1.5 }}>
            From concept to delivery, Content Co-op produces cinematic content for energy, industrial, and corporate clients.
          </p>
          <a
            href="mailto:bailey@contentco-op.com?subject=Project%20Inquiry"
            style={{
              display: "inline-block",
              padding: ".7rem 1.8rem",
              background: C.accent,
              color: "#fff",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: ".82rem",
              letterSpacing: ".03em",
              textDecoration: "none",
              transition: "opacity 150ms ease",
            }}
          >
            Start a Project
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.cardBorder}`, padding: "1.5rem 1rem", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: ".72rem", color: C.dim }}>
          &copy; {new Date().getFullYear()} Content Co-op. All rights reserved. &nbsp;|&nbsp; Houston, TX
        </p>
      </footer>

      {/* Lightbox */}
      {selected && <Lightbox item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Card Component ──────────────────────────────────────────────
function PortfolioCard({ item, onSelect }: { item: PortfolioItem; onSelect: (i: PortfolioItem) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <button
      onClick={() => onSelect(item)}
      style={{
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        background: `linear-gradient(160deg, ${C.card}, #0d1828)`,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
        transition: "transform 200ms ease, border-color 200ms ease",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = C.cardHover;
        videoRef.current?.play();
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = C.cardBorder;
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      {/* Video thumbnail with poster */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a1524", overflow: "hidden" }}>
        <video
          ref={videoRef}
          src={item.thumbnail}
          poster={item.poster || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Play icon overlay */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(12, 19, 34, 0.25)", pointerEvents: "none" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(107, 159, 212, 0.25)", border: "1px solid rgba(107, 159, 212, 0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={C.accent}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
        {/* Duration badge */}
        {item.duration && (
          <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: ".65rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: ".02em" }}>
            {item.duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "1rem 1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".3rem" }}>
          <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>
            {item.category}
          </span>
          <span style={{ fontSize: ".62rem", color: C.dim }}>
            {item.year}
          </span>
        </div>
        <h3 style={{ margin: "0 0 .2rem", fontSize: "1rem", fontWeight: 700, color: C.text, letterSpacing: "-.01em" }}>
          {item.title}
        </h3>
        <p style={{ margin: 0, fontSize: ".78rem", color: C.label, lineHeight: 1.4 }}>
          {item.client}
        </p>
      </div>
    </button>
  );
}

// ── Lightbox ────────────────────────────────────────────────────
function Lightbox({ item, onClose }: { item: PortfolioItem; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0, 0, 0, 0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: 960, width: "100%", background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 18, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video player */}
        <div style={{ aspectRatio: "16/9", background: "#000", position: "relative" }}>
          <video
            src={item.videoUrl || item.thumbnail}
            poster={item.poster || undefined}
            controls
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Info panel */}
        <div style={{ padding: "1.4rem 1.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
              <span style={{ fontSize: ".65rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>
                {item.category}
              </span>
              <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
              <span style={{ fontSize: ".65rem", color: C.dim }}>{item.year}</span>
              {item.duration && (
                <>
                  <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
                  <span style={{ fontSize: ".65rem", color: C.dim }}>{item.duration}</span>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 999, padding: ".3rem .8rem", color: C.muted, fontSize: ".68rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
            >
              Close
            </button>
          </div>
          <h2 style={{ margin: "0 0 .3rem", fontSize: "1.3rem", fontWeight: 700, color: C.text }}>
            {item.title}
          </h2>
          <p style={{ margin: "0 0 .4rem", fontSize: ".82rem", color: C.accent, fontWeight: 600 }}>
            {item.client}
          </p>
          <p style={{ margin: 0, fontSize: ".86rem", color: C.muted, lineHeight: 1.6 }}>
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );
}
