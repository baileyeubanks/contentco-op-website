"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PortfolioCaseStudy } from "@contentco-op/types";
import { portfolioPublicStudies } from "@/lib/content/portfolio";
import { formatPortfolioStudyDisplayTitle, formatPortfolioStudyName } from "@/lib/seo";
import s from "./portfolio.module.css";

type PortfolioCategory = "Energy" | "Industrial" | "Event" | "Recruitment" | "B2B";
type PortfolioUseCase =
  | "Brand Film"
  | "Safety / Training"
  | "Recruiting"
  | "Event"
  | "Product / Explainer"
  | "Executive Comms";

interface PortfolioItem {
  id: string;
  title: string;
  displayTitle: string;
  studyName: string;
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
  useCase: PortfolioUseCase;
}

const CATEGORY_ORDER: PortfolioCategory[] = ["Energy", "Industrial", "Event", "Recruitment", "B2B"];
const USE_CASE_ORDER: PortfolioUseCase[] = [
  "Brand Film",
  "Safety / Training",
  "Recruiting",
  "Event",
  "Product / Explainer",
  "Executive Comms",
];
const ENERGY_CLIENT_HINTS = [
  "bp", "citgo", "abb", "schneider", "accurate meter", "kodiak", "industrial contractors",
];

function classifyStudy(study: PortfolioCaseStudy): PortfolioCategory {
  const sector = study.sector.toLowerCase();
  const format = study.format.toLowerCase();
  const client = study.client.toLowerCase();
  if (sector.includes("industrial")) return "Industrial";
  if (sector.includes("event")) return "Event";
  if (sector.includes("recruit") || format.includes("recruit")) return "Recruitment";
  if (sector.includes("energy")) return "Energy";
  if (ENERGY_CLIENT_HINTS.some((hint) => client.includes(hint))) return "Energy";
  return "B2B";
}

function classifyUseCase(study: PortfolioCaseStudy): PortfolioUseCase {
  const haystack = [
    study.title,
    study.client,
    study.sector,
    study.format,
    study.scope,
    study.headline,
    study.summary,
    ...study.deliverables,
    ...study.proofPoints,
  ].join(" ").toLowerCase();

  if (haystack.includes("safety") || haystack.includes("training") || haystack.includes("instruction")) {
    return "Safety / Training";
  }
  if (haystack.includes("recruit") || haystack.includes("hiring") || haystack.includes("culture")) {
    return "Recruiting";
  }
  if (haystack.includes("event") || haystack.includes("conference") || haystack.includes("recap") || haystack.includes("summit")) {
    return "Event";
  }
  if (haystack.includes("product") || haystack.includes("explainer") || haystack.includes("service overview") || haystack.includes("capabilities")) {
    return "Product / Explainer";
  }
  if (haystack.includes("executive") || haystack.includes("leadership") || haystack.includes("message")) {
    return "Executive Comms";
  }
  return "Brand Film";
}

function toPortfolioItem(study: PortfolioCaseStudy): PortfolioItem | null {
  const thumb = study.thumbnail || study.gallery[0]?.src || "";
  if (!thumb) return null;
  const previewFile = study.preview || study.video || study.remoteMediaUrl || thumb;
  const masterFile = study.video || study.remoteMediaUrl || study.preview || thumb;

  return {
    id: study.id,
    title: study.title,
    displayTitle: formatPortfolioStudyDisplayTitle(study),
    studyName: formatPortfolioStudyName(study),
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
    useCase: classifyUseCase(study),
  };
}

const ITEMS = portfolioPublicStudies.map(toPortfolioItem).filter((item): item is PortfolioItem => item !== null);
const USE_CASES = ["All", ...USE_CASE_ORDER.filter((useCase) => ITEMS.some((item) => item.useCase === useCase))];

function getPortfolioItem(id: string | null | undefined) {
  return id ? ITEMS.find((item) => item.id === id) ?? null : null;
}

export default function PortfolioClient({ initialPortfolioId }: { initialPortfolioId?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [useCaseFilter, setUseCaseFilter] = useState("All");
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(() => getPortfolioItem(initialPortfolioId));

  const syncLightboxFromLocation = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setLightbox(getPortfolioItem(params.get("v")));
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", syncLightboxFromLocation);
    return () => window.removeEventListener("popstate", syncLightboxFromLocation);
  }, [syncLightboxFromLocation]);

  const replaceSearch = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
      mutate(params);
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const openLightbox = useCallback(
    (item: PortfolioItem) => {
      setLightbox(item);
      replaceSearch((params) => {
        params.set("v", item.id);
        params.delete("ep");
      });
    },
    [replaceSearch],
  );

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    replaceSearch((params) => {
      params.delete("v");
      params.delete("ep");
    });
  }, [replaceSearch]);

  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  const filtered = ITEMS.filter((item) => {
    const useCaseMatch = useCaseFilter === "All" || item.useCase === useCaseFilter;
    return useCaseMatch;
  });

  return (
    <div className={s.page}>
      <header className={s.header}>
        <p className={s.kicker}>Portfolio</p>
        <h1 className={s.title}>Our <em>Work</em></h1>
        <div className={s.titleDivider} aria-hidden="true" />
      </header>

      <section className={s.filterDeck} aria-label="Portfolio filters">
        <div className={s.filters}>
          {USE_CASES.map((useCase) => (
            <button
              key={useCase}
              onClick={() => setUseCaseFilter(useCase)}
              className={useCaseFilter === useCase ? s.filterBtnActive : s.filterBtn}
            >
              {useCase}
            </button>
          ))}
        </div>
      </section>

      <div className={s.grid}>
        {filtered.map((item, i) => (
          <PortfolioCard
            key={item.id}
            item={item}
            onSelect={openLightbox}
            index={i}
          />
        ))}
      </div>

      {lightbox ? <Lightbox item={lightbox} items={filtered} onClose={closeLightbox} onSelect={openLightbox} /> : null}
    </div>
  );
}

function PortfolioCard({
  item,
  onSelect,
  index,
}: {
  item: PortfolioItem;
  onSelect: (item: PortfolioItem) => void;
  index: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const detailHref = `/portfolio/${item.id}`;

  return (
    <article
      className={s.card}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        type="button"
        className={s.cardBtn}
        onClick={() => onSelect(item)}
        aria-label={`Quick view ${item.studyName}`}
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
        <div className={s.thumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumb}
            alt={item.studyName}
            loading={index < 3 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 3 ? "high" : "low"}
            className={s.thumbImg}
            style={{ opacity: hovered && item.previewFile !== item.thumb ? 0 : 1 }}
          />
          <video
            ref={videoRef}
            src={item.previewFile}
            muted
            loop
            playsInline
            preload="none"
            className={hovered ? s.thumbVideoVisible : s.thumbVideo}
          />
          <div className={s.tileOverlay}>
            <div className={s.playCircle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#0c1322">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
          <span className={s.metaBadge}>{item.meta}</span>
        </div>

        <div className={s.cardBody}>
          <div className={s.cardMeta}>
            <span className={s.cardCategory}>{item.category}</span>
            <span className={s.cardYear}>{item.year}</span>
          </div>
          <h3 className={s.cardTitle}>{item.displayTitle}</h3>
          <p className={s.cardClient}>{item.client}</p>
          <p className={s.cardHeadline}>{item.headline}</p>
        </div>
      </button>

      <div className={s.cardFooter}>
        <button
          type="button"
          className={s.quickViewBtn}
          onClick={() => onSelect(item)}
        >
          Quick view
        </button>
        <Link href={detailHref} className={s.caseStudyLink}>
          Case study &rarr;
        </Link>
      </div>
    </article>
  );
}

function Lightbox({
  item,
  items,
  onClose,
  onSelect,
}: {
  item: PortfolioItem;
  items: PortfolioItem[];
  onClose: () => void;
  onSelect: (item: PortfolioItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [shareFallbackUrl, setShareFallbackUrl] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const currentIndex = Math.max(0, items.findIndex((candidate) => candidate.id === item.id));
  const previousItem = items.length > 1 ? items[(currentIndex - 1 + items.length) % items.length] : null;
  const nextItem = items.length > 1 ? items[(currentIndex + 1) % items.length] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && previousItem) onSelect(previousItem);
      if (e.key === "ArrowRight" && nextItem) onSelect(nextItem);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextItem, onClose, onSelect, previousItem]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [item.masterFile]);

  // Collapse the details back down whenever a different study is opened.
  useEffect(() => {
    setShowDetails(false);
  }, [item.id]);

  const copyShareUrl = async () => {
    const url = `${window.location.origin}${window.location.pathname}?v=${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShareFallbackUrl("");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setShareFallbackUrl(url);
    }
  };

  return (
    <div className={s.lightbox} onClick={onClose}>
      <div className={s.lightboxPanel} onClick={(e) => e.stopPropagation()}>
        <div className={s.lightboxVideo}>
          <button
            type="button"
            className={s.lightboxClose}
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
          <video
            ref={videoRef}
            key={item.masterFile}
            poster={item.thumb}
            controls
            autoPlay
            playsInline
            controlsList="nodownload nofullscreen"
            onContextMenu={(e) => e.preventDefault()}
          >
            <source src={item.masterFile} type="video/mp4" />
          </video>
        </div>

        <div className={s.lightboxBody}>
          <div className={s.lightboxHead}>
            <div style={{ minWidth: 0 }}>
              <div className={s.lightboxMetaRow}>
                <span className={s.lightboxMetaItem} style={{ color: "#c4722a" }}>{item.category}</span>
                <span className={s.lightboxMetaDot}>&middot;</span>
                <span className={s.lightboxMetaItem} style={{ color: "#999" }}>{item.year}</span>
                <span className={s.lightboxMetaDot}>&middot;</span>
                <span className={s.lightboxMetaItem} style={{ color: "#999" }}>{item.meta}</span>
              </div>
              <h2 className={s.lightboxTitle}>{item.displayTitle}</h2>
              <p className={s.lightboxClient}>{item.client}</p>
            </div>
            <div className={s.lightboxActions}>
              <button onClick={copyShareUrl} title="Copy shareable link" className={s.lbActionBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {copied ? "Copied!" : "Share"}
              </button>
              {previousItem ? (
                <button onClick={() => onSelect(previousItem)} className={s.lbActionBtn}>Prev</button>
              ) : null}
              {nextItem ? (
                <button onClick={() => onSelect(nextItem)} className={s.lbActionBtn}>Next</button>
              ) : null}
              <button onClick={onClose} className={s.lbActionBtn}>Close</button>
            </div>
          </div>
          {shareFallbackUrl ? (
            <label className={s.shareFallback}>
              <span>Copy share link</span>
              <input value={shareFallbackUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            </label>
          ) : null}
          <p className={s.lightboxHeadline}>{item.headline}</p>

          <button
            type="button"
            className={s.detailsToggle}
            onClick={() => setShowDetails((value) => !value)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Hide details" : "Show details"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showDetails ? (
            <div className={s.lightboxDetails}>
              <p className={s.lightboxDesc}>{item.description}</p>
              <div className={s.proofPoints}>
                {item.proofPoints.map((point) => (
                  <span key={point} className={s.proofPoint}>{point}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
