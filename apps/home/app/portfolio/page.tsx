"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Nav } from "@contentco-op/ui";

// ── CDN Base ─────────────────────────────────────────────────────
// Update this after deploying CC_PORTFOLIO_WEB to Netlify
const CDN = "https://cc-portfolio-cdn.netlify.app";

// ── Types ────────────────────────────────────────────────────────
interface Episode {
  title: string;
  file: string;
  thumb: string;
  duration: string;
  /** Native aspect ratio, e.g. "16/9" or "5.28/1". Defaults to "16/9". */
  ar?: string;
}

interface PortfolioItem {
  id: string;
  title: string;
  client: string;
  category: string;
  description: string;
  /** Poster image path (relative to CDN) used as card thumbnail and lightbox poster */
  thumb: string;
  /** Primary video file path (relative to CDN) */
  file: string;
  year: string;
  duration: string;
  /** Native aspect ratio for lightbox player. Defaults to "16/9" */
  ar?: string;
  /** If true, this is a multi-episode series. `episodes` must be set. */
  isGroup?: boolean;
  episodes?: Episode[];
  tags?: string[];
}

// ── Categories ───────────────────────────────────────────────────
const CATEGORIES = ["All", "Energy", "Industrial", "Sports", "Event", "B2B"];

// ── Portfolio Data ───────────────────────────────────────────────
const ITEMS: PortfolioItem[] = [

  // ── GROUP: CITGO Life Critical Rules ──────────────────────────
  {
    id: "citgo-lcr",
    title: "Life Critical Rules",
    client: "CITGO Petroleum",
    category: "Energy",
    description:
      "Nine-episode animated safety series covering CITGO's Life Critical Rules — the essential safety standards governing permit work, energy isolation, confined spaces, PPE, working at heights, lifting, and more. Produced with cinematic animation and in-field footage.",
    thumb: `${CDN}/instagram-video-1761251931353_1_iris3.jpg`,
    file: `${CDN}/CITGO_LCR_Ep1_web.mp4`,
    year: "2024",
    duration: "2:41",
    isGroup: true,
    episodes: [
      { title: "Ep. 1 — A Valid Permit",       file: `${CDN}/CITGO_LCR_Ep1_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep1_web.jpg`,  duration: "2:41" },
      { title: "Ep. 2 — Energy Isolation",     file: `${CDN}/CITGO_LCR_Ep2_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep2_web.jpg`,  duration: "2:42" },
      { title: "Ep. 3 — Confined Spaces",      file: `${CDN}/CITGO_LCR_Ep3_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep3_web.jpg`,  duration: "2:03" },
      { title: "Ep. 4 — Required PPE",         file: `${CDN}/CITGO_LCR_Ep4_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep4_web.jpg`,  duration: "2:09" },
      { title: "Ep. 5 — Working at Heights",   file: `${CDN}/CITGO_LCR_Ep5_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep5_web.jpg`,  duration: "1:48" },
      { title: "Ep. 6 — Lifting Operations",   file: `${CDN}/CITGO_LCR_Ep6_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep6_web.jpg`,  duration: "2:01" },
      { title: "Ep. 7 — Permit Overriding",    file: `${CDN}/CITGO_LCR_Ep7_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep7_web.jpg`,  duration: "1:49" },
      { title: "Ep. 8 — Abandoning Hazards",   file: `${CDN}/CITGO_LCR_Ep8_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep8_web.jpg`,  duration: "2:16" },
      { title: "Ep. 9 — Line of Fire",         file: `${CDN}/CITGO_LCR_Ep9_web.mp4`, thumb: `${CDN}/CITGO_LCR_Ep9_web.jpg`,  duration: "2:47" },
    ],
    tags: ["animation", "safety", "oil & gas"],
  },

  // ── GROUP: BP / HLSR & NRG Stadium ────────────────────────────
  {
    id: "bp-hlsr-rodeo",
    title: "BP at the Rodeo",
    client: "BP",
    category: "Event",
    description:
      "A suite of content produced for BP's presence at the Houston Livestock Show & Rodeo at NRG Stadium. Includes cinematic broadcast spots, a recap of the on-site event, and large-format jumbotron pieces mastered for NRG's main screen.",
    thumb: `${CDN}/HLSR_2025_v.1.jpg`,
    file: `${CDN}/HLSR_2025_v.1.mp4`,
    year: "2025",
    duration: "0:30",
    isGroup: true,
    episodes: [
      { title: "HLSR 2025 Spot",          file: `${CDN}/HLSR_2025_v.1.mp4`,          thumb: `${CDN}/HLSR_2025_v.1.jpg`,          duration: "0:30" },
      { title: "HLSR 2024 — Volunteers",  file: `${CDN}/HLSR_2024_web.mp4`,           thumb: `${CDN}/HLSR_2024_web.jpg`,           duration: "0:30" },
      { title: "Rodeo Recap",             file: `${CDN}/Rodeo_Recap_BP_web.mp4`,      thumb: `${CDN}/Rodeo_Recap_BP_web.jpg`,      duration: "0:49" },
      { title: "NRG Jumbotron Grid",      file: `${CDN}/XXX_Final_Jumbotron.mp4`,     thumb: `${CDN}/XXX_Final_Jumbotron.jpg`,     duration: "0:20", ar: "5.28/1" },
      { title: "NRG Wide Promo",          file: `${CDN}/The_Title_Promo_X_2.mp4`,     thumb: `${CDN}/The_Title_Promo_X_2.jpg`,     duration: "0:37", ar: "2.08/1" },
    ],
    tags: ["event", "broadcast", "jumbotron"],
  },

  // ── GROUP: CERAWeek — Energy Conference ───────────────────────
  {
    id: "ceraweek-abb-schneider",
    title: "CERAWeek Coverage",
    client: "ABB + Schneider Electric",
    category: "Energy",
    description:
      "Conference coverage produced for ABB and Schneider Electric at CERAWeek and related energy industry summits. Executive interviews, brand sizzles, and event recaps — capturing the energy industry's biggest ideas from the world's leading energy conference.",
    thumb: `${CDN}/Schneider_2024_Recap_v.XX.jpg`,
    file: `${CDN}/Schneider_2024_Recap_v.XX.mp4`,
    year: "2024",
    duration: "2:18",
    isGroup: true,
    episodes: [
      { title: "Schneider Electric — 2024 Recap",   file: `${CDN}/Schneider_2024_Recap_v.XX.mp4`,              thumb: `${CDN}/Schneider_2024_Recap_v.XX.jpg`,              duration: "2:18" },
      { title: "ABB at CERAWeek",                    file: `${CDN}/instagram-video-1761251591061_1_prob4.mp4`,   thumb: `${CDN}/instagram-video-1761251591061_1_prob4.jpg`,   duration: "1:36" },
      { title: "ABB — #HerStory",                   file: `${CDN}/instagram-video-1761251505774_1_prob4.mp4`,   thumb: `${CDN}/instagram-video-1761251505774_1_prob4.jpg`,   duration: "1:17" },
    ],
    tags: ["conference", "B2B", "energy"],
  },

  // ── STANDALONE: Accurate Meter ────────────────────────────────
  {
    id: "accurate-meter",
    title: "Accurate Meter",
    client: "Accurate Meter & Supply",
    category: "Energy",
    description:
      "Full production brand film showcasing precision measurement solutions for the energy sector. Multi-day shoot spanning facilities, field operations, and executive interviews.",
    thumb: `${CDN}/Accurate_Meter_FINAL_X.jpg`,
    file: `${CDN}/Accurate_Meter_FINAL_X_web.mp4`,
    year: "2018",
    duration: "2:17",
    tags: ["oil & gas", "brand film", "B2B"],
  },

  // ── STANDALONE: Adaptive Stainless ───────────────────────────
  {
    id: "adaptive-stainless",
    title: "Adaptive Stainless",
    client: "Adaptive Stainless",
    category: "Industrial",
    description:
      "Industrial brand film for Adaptive Stainless — a Texas-based custom fabrication and metalwork company. Cinematic coverage of the shop floor, fabrication process, and team.",
    thumb: `${CDN}/Adaptive_Stainless_v.16.jpg`,
    file: `${CDN}/Adaptive_Stainless_v.16.mp4`,
    year: "2024",
    duration: "1:45",
    tags: ["fabrication", "industrial", "brand film"],
  },

  // ── STANDALONE: Kodiak Gas Services ─────────────────────────
  {
    id: "kodiak-gas",
    title: "Kodiak Gas Services",
    client: "Kodiak Gas Services",
    category: "Energy",
    description:
      "Recruitment video for Kodiak Gas Services highlighting field operations, equipment, and team culture. Produced to attract skilled technicians and operators to one of the largest gas compression service companies in the U.S.",
    thumb: `${CDN}/Kodiak_Recruitment_web.jpg`,
    file: `${CDN}/Kodiak_Recruitment_web.mp4`,
    year: "2022",
    duration: "3:30",
    tags: ["recruitment", "oil & gas", "energy"],
  },

  // ── STANDALONE: ICA / Arkansas ───────────────────────────────
  {
    id: "ica-aerial",
    title: "ICA — Energy Corridor",
    client: "Industrial Contractors of Arkansas",
    category: "Energy",
    description:
      "Aerial and ground-level production for Industrial Contractors of Arkansas featuring refinery operations, CEO interview, and facility coverage across the Arkansas energy corridor.",
    thumb: `${CDN}/EIR30_12mb.jpg`,
    file: `${CDN}/EIR30_12mb.mp4`,
    year: "2023",
    duration: "0:30",
    tags: ["aerial", "refinery", "corporate"],
  },

  // ── STANDALONE: ICA — CEO Interview ─────────────────────────
  {
    id: "ica-ceo",
    title: "ICA — CEO Interview",
    client: "Industrial Contractors of Arkansas",
    category: "Energy",
    description:
      "Executive interview with CEO Michael Kirkland of Industrial Contractors of Arkansas — covering the company's growth, capabilities, and approach to large-scale energy construction projects.",
    thumb: `${CDN}/instagram-video-1761251546096_1_prob4.jpg`,
    file: `${CDN}/instagram-video-1761251546096_1_prob4.mp4`,
    year: "2023",
    duration: "1:30",
    tags: ["interview", "corporate", "oil & gas"],
  },

  // ── STANDALONE: BP STEM Education ────────────────────────────
  {
    id: "bp-stem",
    title: "BP STEM Education",
    client: "BP",
    category: "Sports",
    description:
      "Animated content produced for BP's youth STEM education initiative — showcasing kids engaged in art, science, and creative learning through BP's community investment programs.",
    thumb: `${CDN}/instagram-video-1761252052423_1_iris3.jpg`,
    file: `${CDN}/instagram-video-1761252052423_1_iris3.mp4`,
    year: "2024",
    duration: "1:00",
    tags: ["animation", "education", "community"],
  },

  // ── STANDALONE: Swimming ─────────────────────────────────────
  {
    id: "swimming",
    title: "Swimming",
    client: "Athletics",
    category: "Sports",
    description:
      "Competition swimming coverage capturing athletes in the water. Slow-motion underwater sequences and poolside coverage for athletic content.",
    thumb: `${CDN}/instagram-video-1761252126160_1_iris3.jpg`,
    file: `${CDN}/instagram-video-1761252126160_1_iris3.mp4`,
    year: "2024",
    duration: "1:00",
    tags: ["sports", "swimming"],
  },

  // ── STANDALONE: Gymnastics ────────────────────────────────────
  {
    id: "gymnastics",
    title: "Gymnastics",
    client: "Athletics",
    category: "Sports",
    description:
      "Gymnastics competition coverage featuring floor routines, apparatus work, and performance moments. Cinematic slow-motion and live action capture.",
    thumb: `${CDN}/instagram-video-1761252107336_iris3.jpg`,
    file: `${CDN}/instagram-video-1761252107336_iris3.mp4`,
    year: "2024",
    duration: "0:57",
    tags: ["sports", "gymnastics"],
  },

  // ── STANDALONE: Basketball ────────────────────────────────────
  {
    id: "basketball",
    title: "Basketball",
    client: "Athletics",
    category: "Sports",
    description:
      "Basketball game coverage including scoreboard action and in-game moments. Multi-camera sports production for athletic content.",
    thumb: `${CDN}/instagram-video-1761251765870_1_prob4.jpg`,
    file: `${CDN}/instagram-video-1761251765870_1_prob4.mp4`,
    year: "2024",
    duration: "1:12",
    tags: ["sports", "basketball"],
  },
];

// ── Colors ───────────────────────────────────────────────────────
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
  group: "#f0a500",        // amber for group badge
  groupBg: "rgba(240,165,0,0.12)",
};

// ── Main Page ────────────────────────────────────────────────────
export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState("All");

  // Track which lightbox item + episode index is open
  const [lightbox, setLightbox] = useState<{ item: PortfolioItem; epIdx: number } | null>(null);

  // Deep-link: ?v=item-id&ep=0
  useEffect(() => {
    const vid = searchParams.get("v");
    const ep = parseInt(searchParams.get("ep") || "0", 10);
    if (vid) {
      const found = ITEMS.find((i) => i.id === vid);
      if (found) setLightbox({ item: found, epIdx: isNaN(ep) ? 0 : ep });
    }
  }, [searchParams]);

  // Sync URL when lightbox opens/closes
  const openLightbox = useCallback((item: PortfolioItem, epIdx = 0) => {
    setLightbox({ item, epIdx });
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", item.id);
    params.set("ep", String(epIdx));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("v");
    params.delete("ep");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  const filtered = filter === "All" ? ITEMS : ITEMS.filter((i) => i.category === filter);

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
          <PortfolioCard key={item.id} item={item} onSelect={(it, ep) => openLightbox(it, ep)} />
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
            style={{ display: "inline-block", padding: ".7rem 1.8rem", background: C.accent, color: "#fff", borderRadius: 999, fontWeight: 700, fontSize: ".82rem", letterSpacing: ".03em", textDecoration: "none" }}
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
      {lightbox && (
        <Lightbox
          item={lightbox.item}
          epIdx={lightbox.epIdx}
          onEpChange={(idx) => openLightbox(lightbox.item, idx)}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}

// ── Card Component ────────────────────────────────────────────────
function PortfolioCard({ item, onSelect }: { item: PortfolioItem; onSelect: (i: PortfolioItem, epIdx: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  // For groups, show the first episode's thumb on hover
  const hoverSrc = item.isGroup && item.episodes?.[0] ? item.episodes[0].file : item.file;

  return (
    <button
      onClick={() => onSelect(item, 0)}
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
      {/* Thumbnail area — always 16:9 in grid regardless of native AR */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a1524", overflow: "hidden" }}>
        {/* Poster image */}
        {!hovered && (
          <img
            src={item.thumb}
            alt={item.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {/* Hover preview video */}
        <video
          ref={videoRef}
          src={hoverSrc}
          muted
          loop
          playsInline
          preload="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: hovered ? 1 : 0, transition: "opacity 200ms ease" }}
        />
        {/* Group badge */}
        {item.isGroup && (
          <div style={{ position: "absolute", top: 8, left: 8, background: C.groupBg, border: `1px solid rgba(240,165,0,0.4)`, borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill={C.group}><rect x="2" y="4" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="16" width="20" height="4" rx="1"/></svg>
            <span style={{ fontSize: ".6rem", fontWeight: 700, color: C.group, letterSpacing: ".06em", textTransform: "uppercase" }}>
              {item.episodes?.length} Episodes
            </span>
          </div>
        )}
        {/* Play icon overlay */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(12, 19, 34, 0.2)", pointerEvents: "none" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(107, 159, 212, 0.25)", border: "1px solid rgba(107, 159, 212, 0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={C.accent}><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
        </div>
        {/* Duration badge */}
        <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: ".65rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>
          {item.duration}
        </span>
      </div>

      {/* Card info */}
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
        <p style={{ margin: 0, fontSize: ".78rem", color: C.label, lineHeight: 1.4 }}>
          {item.client}
        </p>
      </div>
    </button>
  );
}

// ── Lightbox Component ────────────────────────────────────────────
function Lightbox({
  item,
  epIdx,
  onEpChange,
  onClose,
}: {
  item: PortfolioItem;
  epIdx: number;
  onEpChange: (idx: number) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isGroup = item.isGroup && item.episodes && item.episodes.length > 0;
  const episodes = item.episodes ?? [];
  const currentEp = isGroup ? episodes[epIdx] : null;

  // Resolve current video file, thumb, ar, duration
  const videoFile   = currentEp ? currentEp.file     : item.file;
  const videoThumb  = currentEp ? currentEp.thumb     : item.thumb;
  const videoAr     = currentEp ? (currentEp.ar ?? "16/9") : (item.ar ?? "16/9");
  const videoTitle  = currentEp ? currentEp.title     : item.title;
  const videoDur    = currentEp ? currentEp.duration  : item.duration;

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (isGroup && e.key === "ArrowRight") onEpChange(Math.min(epIdx + 1, episodes.length - 1));
      if (isGroup && e.key === "ArrowLeft")  onEpChange(Math.max(epIdx - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onEpChange, epIdx, isGroup, episodes.length]);

  // Reload video when source changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [videoFile]);

  // Share URL copy
  const [copied, setCopied] = useState(false);
  const copyShareUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?v=${item.id}&ep=${epIdx}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(1040px, 96vw)", background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 18, overflow: "hidden", maxHeight: "96vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Video player ── */}
        <div style={{ position: "relative", background: "#000", width: "100%", aspectRatio: videoAr, maxHeight: "62vh", overflow: "hidden" }}>
          <video
            ref={videoRef}
            key={videoFile}
            poster={videoThumb}
            controls
            autoPlay
            playsInline
            controlsList="nodownload nofullscreen"
            onContextMenu={(e) => e.preventDefault()}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          >
            <source src={videoFile} type="video/mp4" />
          </video>

          {/* Group nav arrows */}
          {isGroup && (
            <>
              {epIdx > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEpChange(epIdx - 1); }}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}
              {epIdx < episodes.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEpChange(epIdx + 1); }}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Episode selector strip (groups only) ── */}
        {isGroup && (
          <div style={{ overflowX: "auto", display: "flex", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.cardBorder}`, scrollbarWidth: "thin" }}>
            {episodes.map((ep, idx) => (
              <button
                key={idx}
                onClick={() => onEpChange(idx)}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${idx === epIdx ? C.accent : C.cardBorder}`,
                  background: idx === epIdx ? "rgba(107,159,212,0.18)" : C.card,
                  color: idx === epIdx ? C.text : C.muted,
                  fontSize: ".68rem",
                  fontWeight: idx === epIdx ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  transition: "border-color 120ms, background 120ms",
                }}
              >
                {ep.title}
              </button>
            ))}
          </div>
        )}

        {/* ── Info panel ── */}
        <div style={{ padding: "1.2rem 1.4rem", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: ".5rem" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: ".6rem", alignItems: "center", marginBottom: ".3rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: ".65rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>{item.category}</span>
                <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
                <span style={{ fontSize: ".65rem", color: C.dim }}>{item.year}</span>
                <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
                <span style={{ fontSize: ".65rem", color: C.dim }}>{videoDur}</span>
                {isGroup && (
                  <>
                    <span style={{ fontSize: ".6rem", color: C.dim }}>&middot;</span>
                    <span style={{ fontSize: ".65rem", color: C.group, fontWeight: 600 }}>{epIdx + 1} of {episodes.length}</span>
                  </>
                )}
              </div>
              <h2 style={{ margin: "0 0 .15rem", fontSize: "1.2rem", fontWeight: 700, color: C.text }}>
                {isGroup ? videoTitle : item.title}
              </h2>
              <p style={{ margin: 0, fontSize: ".82rem", color: C.accent, fontWeight: 600 }}>{item.client}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {/* Share button */}
              <button
                onClick={copyShareUrl}
                title="Copy shareable link"
                style={{ background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 999, padding: ".3rem .8rem", color: copied ? "#6dde85" : C.muted, fontSize: ".68rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "color 150ms" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                {copied ? "Copied!" : "Share"}
              </button>
              {/* Close button */}
              <button
                onClick={onClose}
                style={{ background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 999, padding: ".3rem .8rem", color: C.muted, fontSize: ".68rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
              >
                Close
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: ".84rem", color: C.muted, lineHeight: 1.6 }}>
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );
}
