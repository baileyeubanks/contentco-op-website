"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type RotatingBleedProps = {
  images: readonly string[];
  alt: string;
  interval?: number;
};

export function RotatingBleed({ images, alt, interval = 7000 }: RotatingBleedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showB, setShowB] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || images.length <= 1) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.2 },
    );

    observer.observe(container);

    const timer = window.setInterval(() => {
      if (!isVisibleRef.current) return;
      setActiveIndex((current) => (current + 1) % images.length);
      setShowB((current) => !current);
    }, interval);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [images.length, interval]);

  const previousIndex = (activeIndex - 1 + images.length) % images.length;
  const layerA = showB ? images[previousIndex] : images[activeIndex];
  const layerB = showB ? images[activeIndex] : images[previousIndex];

  return (
    <div ref={containerRef} className="bleed-media" aria-hidden="true">
      <div className={`bleed-layer ${!showB ? "bleed-layer-visible" : ""}`}>
        <Image src={layerA} alt={alt} fill sizes="100vw" quality={85} priority />
      </div>
      <div className={`bleed-layer ${showB ? "bleed-layer-visible" : ""}`}>
        <Image src={layerB} alt="" fill sizes="100vw" quality={85} />
      </div>
    </div>
  );
}
