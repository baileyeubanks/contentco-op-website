"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PortfolioCaseStudy } from "@contentco-op/types";
import { Nav } from "@contentco-op/ui";
import { portfolioPublicStudies } from "@/lib/content/portfolio";

type PortfolioCategory = "Energy" | "Industrial" | "Event" | "B2B";

interface PortfolioItem {
  id: string;
  title: string;
  client: string;
  category: PortfolioCategory;
  description: string;
  headline: string;
  thumb: string;
  previewFile: string;
  masterFile: string;
  year: string;
  meta: string;
  proofPoints: string[];
}

const CATEGORY_ORDER: PortfolioCategory[] = ["Energy", "Industrial", "Event", "B2B"];
const ENERGY_CLIENT_HINTS = [
  "bp",
  "citgo",
  "abb",
  "schneider",
  "accurate meter",
  "kodiak",
  "industrial contractors",
];

const C = {
  bg: "#0c1322",
  card: "#101b2e",
  cardBorder: "#1e3454",
  cardHover: "#4c8ef5",
  accent: "#4c8ef5",
  label: "#5a7ea8",
  muted: "#7a9bc4",
  text: "#edf3ff",
  dim: "#4a6888",
};

function classifyStudy(study: PortfolioCaseStudy): PortfolioCategory {
  const sector = study.sector.toLowerCase();
  const client = study.client.toLowerCase();

  if (sector.includes("industrial")) return "Industrial";
  if (sector.includes("event")) return "Event";
  if (sector.includes("energy")) return "Energy";
  if (ENERGY_CLIENT_HINTS.some((hint) => client.includes(hint))) return "Energy";
  return "B2B";
}

function toPortfolioItem(study: PortfolioCaseStudy): PortfolioItem | null {
  const thumb = study.thumbnail || study.gallery[0]?.src || "";
  const previewFile = study.preview || study.video || study.remoteMediaUrl || "";
  const masterFile = study.video || study.remoteMediaUrl || study.preview || "";
  if (!thumb || !previewFile || !masterFile) return null;

  return {
    id: study.id,
    title: study.title,
    client: study.client,
    category: classifyStudy(study),
    description: study.summary,
    headline: study.headline,
    thumb,
    previewFile,
    masterFile,
    year: study.year,
    meta: study.format,
    proofPoints: study.proofPoints,
  };
}

const ITEMS = portfolioPublicStudies.map(toPortfolioItem).filter((item): item is PortfolioItem => item !== null);
const CATEGORIES = ["All", ...CATEGORY_ORDER.filter((category) => ITEMS.some((item) => item.category === category))];

export default function PortfolioPage() {
  return (
    <Suspense>
      <PortfolioContent />
    </Suspense>
  );
}

function PortfolioContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    const portfolioId = searchParams.get("v");
    if (!portfolioId) {
      setLightbox(null);
      return;
    }

    const found = ITEMS.find((item) => item.id === portfolioId) || null;
    setLightbox(found);
  }, [searchParams]);

  const replaceSearch = useCallback(
    (params: URLSearchParams) => {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const openLightbox = useCallback(
    (item: PortfolioItem) => {
      setLightbox(item);
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", item.id);
      params.delete("ep");
      replaceSearch(params);
    },
    [replaceSearch, searchParams],
  );

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("v");
    params.delete("ep");
    replaceSearch(params);
  }, [replaceSearch, searchParams]);

  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  const filtered = filter === "All" ? ITEMS : ITEMS.filter((item) => item.category === filter);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <Nav surface="portfolio" />

      <header style={{ textAlign: "center", padding: "5rem 1rem 2rem" }}>
        <p
          style={{
            fontSize: ".72rem",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: C.accent,
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
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: ".4rem",
          flexWrap: "wrap",
          padding: "0 1rem 2.5rem",
        }}
      >
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            style={{
              padding: ".42rem .88rem",
              border: `1px solid ${filter === category ? C.accent : C.cardBorder}`,
              borderRadius: 999,
              background: filter === category ? "rgba(107, 159, 212, 0.14)" : C.card,
              color: filter === category ? C.text : C.muted,
              fontSize: ".76rem",
              fontWeight: 600,
              letterSpacing: ".03em",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
            }}
          >
            {category}
          </button>
        ))}
      </div>

      <div
        style={{
          width: "min(1200px, 94vw)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "1.2rem",
          padding: "0 0 3rem",
        }}
      >
        {filtered.map((item) => (
          <PortfolioCard key={item.id} item={item} onSelect={openLightbox} />
        ))}
      </div>

      <footer style={{ borderTop: `1px solid ${C.cardBorder}`, padding: "1.5rem 1rem", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: ".72rem", color: C.dim }}>
          &copy; {new Date().getFullYear()} &nbsp;|&nbsp; Houston, TX
        </p>
      </footer>

      {lightbox ? <Lightbox item={lightbox} onClose={closeLightbox} /> : null}
    </div>
  );
}

function PortfolioCard({ item, onSelect }: { item: PortfolioItem; onSelect: (item: PortfolioItem) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(item)}
      style={{
        border: `1px solid ${hovered ? C.cardHover : C.cardBorder}`,
        borderRadius: 16,
        background: `linear-gradient(160deg, ${C.card}, #0d1828)`,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
        transform: hovered ? "translateY(-4px)" : "none",
        transition: "transform 200ms ease, border-color 200ms ease",
        fontFamily: "inherit",
        width: "100%",
      }}
      onMouseEnter={() => {
        setHovered(true);
        videoRef.current?.play().catch(() => {});
      }}
      onMouseLeave={() => {
        setHovered(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a1524", overflow: "hidden" }}>
        {!hovered ? (
          <img
            src={item.thumb}
            alt={item.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <video
          ref={videoRef}
          src={item.previewFile}
          muted
          loop
          playsInline
          preload="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: hovered ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(12, 19, 34, 0.2)",
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill={C.accent}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
        <span
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            fontSize: ".65rem",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {item.meta}
        </span>
      </div>

      <div style={{ padding: "1rem 1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".3rem" }}>
          <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>
            {item.category}
          </span>
          <span style={{ fontSize: ".62rem", color: C.dim }}>{item.year}</span>
        </div>
        <h3 style={{ margin: "0 0 .2rem", fontSize: "1rem", fontWeight: 700, color: C.text, letterSpacing: "-.01em" }}>
          {item.title}
        </h3>
        <p style={{ margin: "0 0 .45rem", fontSize: ".78rem", color: C.label, lineHeight: 1.4 }}>{item.client}</p>
        <p style={{ margin: 0, fontSize: ".76rem", color: C.muted, lineHeight: 1.5 }}>{item.headline}</p>
      </div>
    </button>
  );
}

function Lightbox({ item, onClose }: { item: PortfolioItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [item.masterFile]);

  const copyShareUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?v=${item.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(1040px, 96vw)",
          background: C.bg,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 18,
          overflow: "hidden",
          maxHeight: "96vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            position: "relative",
            background: "#000",
            width: "100%",
            aspectRatio: "16/9",
            maxHeight: "62vh",
            overflow: "hidden",
          }}
        >
          <video
            ref={videoRef}
            key={item.masterFile}
            poster={item.thumb}
            controls
            autoPlay
            playsInline
            controlsList="nodownload nofullscreen"
            onContextMenu={(event) => event.preventDefault()}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          >
            <source src={item.masterFile} type="video/mp4" />
          </video>
        </div>

        <div style={{ padding: "1.2rem 1.4rem", overflowY: "auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: ".5rem",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: ".6rem", alignItems: "center", marginBottom: ".3rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: ".65rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>
                  {item.category}
                </span>
                <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
                <span style={{ fontSize: ".65rem", color: C.dim }}>{item.year}</span>
                <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
                <span style={{ fontSize: ".65rem", color: C.dim }}>{item.meta}</span>
              </div>
              <h2 style={{ margin: "0 0 .15rem", fontSize: "1.2rem", fontWeight: 700, color: C.text }}>{item.title}</h2>
              <p style={{ margin: 0, fontSize: ".82rem", color: C.accent, fontWeight: 600 }}>{item.client}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={copyShareUrl}
                title="Copy shareable link"
                style={{
                  background: "none",
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 999,
                  padding: ".3rem .8rem",
                  color: copied ? "#6dde85" : C.muted,
                  fontSize: ".68rem",
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "color 150ms",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {copied ? "Copied!" : "Share"}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 999,
                  padding: ".3rem .8rem",
                  color: C.muted,
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
          </div>
          <p style={{ margin: "0 0 .75rem", fontSize: ".9rem", color: C.text, lineHeight: 1.55 }}>{item.headline}</p>
          <p style={{ margin: "0 0 1rem", fontSize: ".84rem", color: C.muted, lineHeight: 1.6 }}>{item.description}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem" }}>
            {item.proofPoints.map((point) => (
              <span
                key={point}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: ".35rem .6rem",
                  borderRadius: 999,
                  border: `1px solid ${C.cardBorder}`,
                  background: C.card,
                  color: C.label,
                  fontSize: ".68rem",
                  fontWeight: 600,
                }}
              >
                {point}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
