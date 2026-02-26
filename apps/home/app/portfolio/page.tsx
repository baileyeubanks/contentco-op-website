"use client";

import { useState } from "react";
import Link from "next/link";

interface PortfolioItem {
  id: string;
  title: string;
  client: string;
  category: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  year: string;
}

const CATEGORIES = ["All", "Energy", "Industrial", "Corporate", "Aerial", "Event"];

// Portfolio items — update videoUrl once hosting is configured
const ITEMS: PortfolioItem[] = [
  {
    id: "accurate-meter",
    title: "Accurate Meter",
    client: "Accurate Meter & Supply",
    category: "Industrial",
    description: "Full production brand film showcasing precision measurement solutions for the energy sector.",
    thumbnail: "/cc/video/hero-1.mp4",
    videoUrl: "",
    year: "2025",
  },
  {
    id: "gno",
    title: "GNO Campaign",
    client: "GNO Inc.",
    category: "Corporate",
    description: "Multi-part corporate storytelling campaign for energy industry leadership.",
    thumbnail: "/cc/video/hero-3.mp4",
    videoUrl: "",
    year: "2025",
  },
  {
    id: "blankets",
    title: "Blankets",
    client: "Industrial Client",
    category: "Industrial",
    description: "Safety-focused industrial process documentation and training content.",
    thumbnail: "/cc/video/hero-5.mp4",
    videoUrl: "",
    year: "2025",
  },
  {
    id: "tray30",
    title: "Tray30",
    client: "Energy Client",
    category: "Energy",
    description: "High-end facility walkthrough and process demonstration for tray manufacturing.",
    thumbnail: "/cc/video/hero-7.mp4",
    videoUrl: "",
    year: "2024",
  },
  {
    id: "bpms-drone",
    title: "BPMS150 Aerial",
    client: "BPMS",
    category: "Aerial",
    description: "Cinematic drone coverage of the BP MS 150 finish line. Aerial storytelling at scale.",
    thumbnail: "/cc/video/hero-9.mp4",
    videoUrl: "",
    year: "2024",
  },
  {
    id: "title-promo",
    title: "The Title Promo",
    client: "Client",
    category: "Corporate",
    description: "Promotional content designed for jumbotron and large format display.",
    thumbnail: "/cc/video/hero-11.mp4",
    videoUrl: "",
    year: "2024",
  },
  {
    id: "hlsr",
    title: "HLSR Coverage",
    client: "Houston Livestock Show",
    category: "Event",
    description: "Full event coverage with multiple camera angles and highlight reels.",
    thumbnail: "/cc/video/hero-13.mp4",
    videoUrl: "",
    year: "2024",
  },
  {
    id: "schneider",
    title: "Schneider Electric",
    client: "Schneider Electric",
    category: "Energy",
    description: "Technical facility tour and product demonstration for global energy solutions.",
    thumbnail: "/cc/video/hero-15.mp4",
    videoUrl: "",
    year: "2024",
  },
  {
    id: "adaptive",
    title: "Adaptive Solutions",
    client: "Adaptive",
    category: "Corporate",
    description: "Brand story film highlighting adaptive technology solutions for the energy sector.",
    thumbnail: "/cc/video/hero-17.mp4",
    videoUrl: "",
    year: "2023",
  },
];

export default function PortfolioPage() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<PortfolioItem | null>(null);

  const filtered =
    filter === "All" ? ITEMS : ITEMS.filter((i) => i.category === filter);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c1322",
        color: "#edf3ff",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Nav */}
      <div
        style={{
          width: "min(1200px, 94vw)",
          margin: "0 auto",
          padding: "1.4rem 0 0",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: ".4rem",
            fontSize: ".72rem",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "#5a7ea8",
            textDecoration: "none",
          }}
        >
          &larr; Back to Home
        </Link>
      </div>

      {/* Header */}
      <header
        style={{
          textAlign: "center",
          padding: "3rem 1rem 2rem",
        }}
      >
        <p
          style={{
            fontSize: ".72rem",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "#6b9fd4",
            fontWeight: 700,
            margin: "0 0 .4rem",
          }}
        >
          Portfolio
        </p>
        <h1
          style={{
            margin: "0 0 .5rem",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            letterSpacing: "-.03em",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          Our Work
        </h1>
        <p
          style={{
            color: "#7a9bc4",
            fontSize: ".92rem",
            lineHeight: 1.5,
            maxWidth: 500,
            margin: "0 auto",
          }}
        >
          Energy. Industrial. Corporate. Every frame tells a story.
        </p>
      </header>

      {/* Category filter */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: ".4rem",
          flexWrap: "wrap",
          padding: "0 1rem 2rem",
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: ".42rem .88rem",
              border: `1px solid ${filter === cat ? "#6b9fd4" : "#2b4263"}`,
              borderRadius: 999,
              background:
                filter === cat
                  ? "rgba(107, 159, 212, 0.14)"
                  : "#0d1a2e",
              color: filter === cat ? "#edf3ff" : "#7a9bc4",
              fontSize: ".76rem",
              fontWeight: 600,
              letterSpacing: ".03em",
              cursor: "pointer",
              fontFamily: "inherit",
              transition:
                "border-color 120ms ease, background 120ms ease, color 120ms ease",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Video grid */}
      <div
        style={{
          width: "min(1200px, 94vw)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "1.2rem",
          padding: "0 0 4rem",
        }}
      >
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            style={{
              border: "1px solid #2b4263",
              borderRadius: 16,
              background: "linear-gradient(160deg, #101b2e, #0d1828)",
              overflow: "hidden",
              cursor: "pointer",
              textAlign: "left",
              padding: 0,
              transition: "transform 200ms ease, border-color 200ms ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = "#6b9fd4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = "#2b4263";
            }}
          >
            {/* Video thumbnail */}
            <div
              style={{
                position: "relative",
                aspectRatio: "16/9",
                background: "#0a1524",
                overflow: "hidden",
              }}
            >
              <video
                src={item.thumbnail}
                muted
                loop
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {/* Play icon overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(12, 19, 34, 0.3)",
                  transition: "opacity 200ms ease",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(107, 159, 212, 0.25)",
                    border: "1px solid rgba(107, 159, 212, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="#6b9fd4"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: "1rem 1.2rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: ".3rem",
                }}
              >
                <span
                  style={{
                    fontSize: ".62rem",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "#6b9fd4",
                    fontWeight: 700,
                  }}
                >
                  {item.category}
                </span>
                <span
                  style={{
                    fontSize: ".62rem",
                    color: "#4a6888",
                  }}
                >
                  {item.year}
                </span>
              </div>
              <h3
                style={{
                  margin: "0 0 .2rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#edf3ff",
                  letterSpacing: "-.01em",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: ".78rem",
                  color: "#5a7ea8",
                  lineHeight: 1.4,
                }}
              >
                {item.client}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              maxWidth: 900,
              width: "100%",
              background: "#0c1322",
              border: "1px solid #2b4263",
              borderRadius: 18,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video player */}
            <div
              style={{
                aspectRatio: "16/9",
                background: "#000",
                position: "relative",
              }}
            >
              <video
                src={selected.thumbnail}
                controls
                autoPlay
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>

            {/* Info */}
            <div style={{ padding: "1.4rem 1.6rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: ".4rem",
                }}
              >
                <span
                  style={{
                    fontSize: ".65rem",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "#6b9fd4",
                    fontWeight: 700,
                  }}
                >
                  {selected.category} &middot; {selected.year}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: "none",
                    border: "1px solid #2b4263",
                    borderRadius: 999,
                    padding: ".3rem .8rem",
                    color: "#7a9bc4",
                    fontSize: ".68rem",
                    fontWeight: 700,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Close
                </button>
              </div>
              <h2
                style={{
                  margin: "0 0 .3rem",
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color: "#edf3ff",
                }}
              >
                {selected.title}
              </h2>
              <p
                style={{
                  margin: "0 0 .4rem",
                  fontSize: ".82rem",
                  color: "#6b9fd4",
                  fontWeight: 600,
                }}
              >
                {selected.client}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: ".86rem",
                  color: "#7a9bc4",
                  lineHeight: 1.6,
                }}
              >
                {selected.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
