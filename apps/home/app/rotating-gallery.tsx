"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

interface GalleryImage {
  src: string;
  alt: string;
  label: string;
  tag: string;
}

interface SlotSpan {
  col: number;
  row: number;
}

interface RotatingGalleryProps {
  images: readonly GalleryImage[];
  columns?: number;
  rows?: number;
  interval?: number;
  baseHref?: string;
  initialSelectedSrc?: string | null;
  closeHref?: string;
}

/**
 * HOME-3 — editorial mosaic (not equal contact-sheet).
 * Two 8×2 bands; each band: two 2×2 featured tiles + eight 1×1 tiles = 16 units.
 */
const GALLERY_LAYOUT_8x4: readonly SlotSpan[] = [
  { col: 2, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
];

export function RotatingGallery({
  images,
  columns = 8,
  rows = 4,
  interval = 5000,
  baseHref = "/",
  initialSelectedSrc = null,
  closeHref = "/",
}: RotatingGalleryProps) {
  const layout = columns === 8 && rows === 4 ? GALLERY_LAYOUT_8x4 : null;
  const [pools] = useState<GalleryImage[][]>(() => {
    const slotCount = layout ? layout.length : rows * columns;
    const slots: GalleryImage[][] = Array.from({ length: slotCount }, () => []);
    images.forEach((img, i) => slots[i % slotCount].push(img));
    slots.forEach((slot, i) => {
      if (slot.length === 0 && images.length > 0) slot.push(images[i % images.length]);
    });
    return slots;
  });
  const bodyOverflowRef = useRef<string>("");
  const selectedImage = initialSelectedSrc
    ? images.find((img) => img.src === initialSelectedSrc) ?? null
    : null;

  useEffect(() => {
    if (selectedImage) {
      bodyOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = bodyOverflowRef.current;
    }

    return () => {
      document.body.style.overflow = bodyOverflowRef.current;
    };
  }, [selectedImage]);

  return (
    <>
      <section
        className="gallery gallery--mosaic"
        style={{ "--gallery-columns": columns } as CSSProperties}
        data-gallery-hierarchy="mosaic"
      >
        {pools.map((pool, i) => {
          const span = layout?.[i] ?? { col: 1, row: 1 };
          const featured = span.col > 1 || span.row > 1;
          return (
            <GallerySlot
              key={i}
              images={pool}
              delay={(i % columns) * 220 + Math.floor(i / columns) * 650}
              interval={interval}
              baseHref={baseHref}
              colSpan={span.col}
              rowSpan={span.row}
              featured={featured}
            />
          );
        })}
      </section>

      {selectedImage ? (
        <GalleryLightbox image={selectedImage} closeHref={closeHref} />
      ) : null}
    </>
  );
}

function GallerySlot({
  images,
  delay,
  interval,
  baseHref,
  colSpan = 1,
  rowSpan = 1,
  featured = false,
}: {
  images: GalleryImage[];
  delay: number;
  interval: number;
  baseHref: string;
  colSpan?: number;
  rowSpan?: number;
  featured?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showB, setShowB] = useState(false);
  const indexRef = useRef(0);
  const containerRef = useRef<HTMLElement>(null);
  const isVisibleRef = useRef(false);

  const advance = useCallback(() => {
    if (!isVisibleRef.current || images.length <= 1) return;
    const next = (indexRef.current + 1) % images.length;
    indexRef.current = next;
    setActiveIndex(next);
    setShowB((prev) => !prev);
  }, [images.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.15 }
    );
    obs.observe(el);

    let timer: ReturnType<typeof setInterval> | undefined;
    const delayTimer = setTimeout(() => {
      advance();
      timer = setInterval(advance, interval);
    }, delay);

    return () => {
      obs.disconnect();
      clearTimeout(delayTimer);
      if (timer) clearInterval(timer);
    };
  }, [advance, delay, interval]);

  const currentImage = images[activeIndex];
  const prevIndex = (activeIndex - 1 + images.length) % images.length;
  const prevImage = images[prevIndex];

  // Two layers: A (bottom) and B (top), alternate which is visible
  const layerA = showB ? prevImage : currentImage;
  const layerB = showB ? currentImage : prevImage;
  const openHref = `${baseHref}?photo=${encodeURIComponent(currentImage.src)}`;

  const sizes = featured
    ? "(max-width: 980px) 50vw, 25vw"
    : "(max-width: 980px) 25vw, 12.5vw";

  return (
    <figure
      ref={containerRef}
      className={`gallery-item${featured ? " gallery-item--featured" : ""}`}
      style={
        {
          "--gallery-col-span": colSpan,
          "--gallery-row-span": rowSpan,
        } as CSSProperties
      }
      data-gallery-featured={featured ? "true" : "false"}
    >
      <Link
        href={openHref}
        scroll={false}
        className="gallery-open"
        aria-label={`Open full-size photo: ${currentImage.label}`}
      >
        <span className="gallery-open-indicator" aria-hidden="true" />
        <span className="sr-only">Open full-size photo</span>
      </Link>
      <div className={`gallery-layer ${!showB ? "gallery-layer-visible" : ""}`}>
        <Image
          src={layerA.src}
          alt={layerA.alt}
          fill
          sizes={sizes}
          loading="lazy"
          fetchPriority="low"
          quality={82}
        />
      </div>
      <div className={`gallery-layer ${showB ? "gallery-layer-visible" : ""}`}>
        <Image
          src={layerB.src}
          alt={layerB.alt}
          fill
          sizes={sizes}
          loading="lazy"
          fetchPriority="low"
          quality={82}
        />
      </div>
      <figcaption>
        <span className="gallery-tag">{currentImage.tag}</span>
        <span className="gallery-label">{currentImage.label}</span>
      </figcaption>
    </figure>
  );
}

function GalleryLightbox({ image, closeHref }: { image: GalleryImage; closeHref: string }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.location.assign(closeHref);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeHref]);

  return (
    <div
      className="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${image.label} photo viewer`}
      onClick={() => window.location.assign(closeHref)}
    >
      <div className="gallery-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <Link href={closeHref} scroll={false} className="gallery-lightbox-close" aria-label="Close photo viewer">
          <span aria-hidden="true">&times;</span>
        </Link>

        <div className="gallery-lightbox-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-lightbox-image" src={image.src} alt={image.alt} loading="eager" decoding="async" />
          <div className="gallery-lightbox-caption">
            <span className="gallery-lightbox-tag">{image.tag} </span>
            <span className="gallery-lightbox-label">{image.label} </span>
            <span className="gallery-lightbox-alt">{image.alt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
