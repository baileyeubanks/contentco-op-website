"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

interface GalleryImage {
  src: string;
  alt: string;
  label: string;
  tag: string;
}

interface RotatingGalleryProps {
  images: GalleryImage[];
  columns?: number;
  interval?: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RotatingGallery({ images, columns = 3, interval = 5000 }: RotatingGalleryProps) {
  // Distribute images across slots, shuffled
  const [pools] = useState(() => {
    const shuffled = shuffle(images);
    const slots: GalleryImage[][] = Array.from({ length: columns }, () => []);
    shuffled.forEach((img, i) => slots[i % columns].push(img));
    return slots;
  });

  return (
    <section className="gallery">
      {pools.map((pool, i) => (
        <GallerySlot key={i} images={pool} delay={i * 2000} interval={interval} />
      ))}
    </section>
  );
}

function GallerySlot({ images, delay, interval }: { images: GalleryImage[]; delay: number; interval: number }) {
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

    const startTimer = setTimeout(() => {
      const timer = setInterval(advance, interval);
      return () => clearInterval(timer);
    }, delay);

    // Also set a recurring interval after delay
    let timer: ReturnType<typeof setInterval>;
    const delayTimer = setTimeout(() => {
      timer = setInterval(advance, interval);
    }, delay);

    return () => {
      obs.disconnect();
      clearTimeout(startTimer);
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

  return (
    <figure ref={containerRef} className="gallery-item">
      <div className={`gallery-layer ${!showB ? "gallery-layer-visible" : ""}`}>
        <Image
          src={layerA.src}
          alt={layerA.alt}
          fill
          sizes="(max-width: 980px) 100vw, 33vw"
          quality={82}
        />
      </div>
      <div className={`gallery-layer ${showB ? "gallery-layer-visible" : ""}`}>
        <Image
          src={layerB.src}
          alt={layerB.alt}
          fill
          sizes="(max-width: 980px) 100vw, 33vw"
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
