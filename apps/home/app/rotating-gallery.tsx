"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Maximize2, X } from "lucide-react";
import type { CSSProperties } from "react";

interface GalleryImage {
  src: string;
  alt: string;
  label: string;
  tag: string;
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

export function RotatingGallery({
  images,
  columns = 8,
  rows = 4,
  interval = 5000,
  baseHref = "/",
  initialSelectedSrc = null,
  closeHref = "/",
}: RotatingGalleryProps) {
  const [pools] = useState<GalleryImage[][]>(() => {
    const slotCount = rows * columns;
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
        className="gallery"
        style={{ "--gallery-columns": columns } as CSSProperties}
      >
        {pools.map((pool, i) => (
          <GallerySlot
            key={i}
            images={pool}
            delay={(i % columns) * 220 + Math.floor(i / columns) * 650}
            interval={interval}
            baseHref={baseHref}
          />
        ))}
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
}: {
  images: GalleryImage[];
  delay: number;
  interval: number;
  baseHref: string;
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

  return (
    <figure ref={containerRef} className="gallery-item">
      <Link
        href={openHref}
        scroll={false}
        className="gallery-open"
        aria-label={`Open full-size photo: ${currentImage.label}`}
      >
        <span className="gallery-open-indicator" aria-hidden="true">
          <Maximize2 size={14} strokeWidth={2.2} />
        </span>
        <span className="sr-only">Open full-size photo</span>
      </Link>
      <div className={`gallery-layer ${!showB ? "gallery-layer-visible" : ""}`}>
        <Image
          src={layerA.src}
          alt={layerA.alt}
          fill
          sizes="(max-width: 980px) 25vw, 12.5vw"
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
          sizes="(max-width: 980px) 25vw, 12.5vw"
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
          <X size={18} strokeWidth={2.25} />
        </Link>

        <div className="gallery-lightbox-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-lightbox-image" src={image.src} alt={image.alt} loading="eager" decoding="async" />
          <div className="gallery-lightbox-caption">
            <span className="gallery-lightbox-tag">{image.tag}</span>
            <span className="gallery-lightbox-label">{image.label}</span>
            <span className="gallery-lightbox-alt">{image.alt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
