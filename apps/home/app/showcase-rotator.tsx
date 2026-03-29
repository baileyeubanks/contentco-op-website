"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";

const SLIDES = [
  {
    src: "/cc/photos/seagull-rope-access-deep-water-orange.jpg",
    alt: "Offshore rope access crew",
    line1: "We build content systems",
    line2: "that survive the boardroom.",
  },
  {
    src: "/cc/photos/4G9A4069.jpg",
    alt: "Drone launch on platform",
    line1: "Every story starts",
    line2: "where the work happens.",
  },
  {
    src: "/cc/photos/IMG_7109.jpg",
    alt: "Control room operations",
    line1: "Twelve years of",
    line2: "industrial production.",
  },
  {
    src: "/cc/photos/4G9A1137.jpg",
    alt: "Helipad operations at sunset",
    line1: "From strategy",
    line2: "to final cut.",
  },
  {
    src: "/cc/photos/P1700037.jpeg",
    alt: "Field crew on location",
    line1: "Real stories,",
    line2: "real operators.",
  },
];

export function ShowcaseRotator() {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  const advance = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setIdx((prev) => (prev + 1) % SLIDES.length);
      setFading(false);
    }, 700);
  }, []);

  useEffect(() => {
    const timer = setInterval(advance, 8000);
    return () => clearInterval(timer);
  }, [advance]);

  const slide = SLIDES[idx];

  return (
    <section className="showcase-rotator">
      <div className="showcase-image-wrap">
        <Image
          src={slide.src}
          alt={slide.alt}
          fill
          sizes="100vw"
          quality={80}
          priority={idx === 0}
          className="showcase-image"
          style={{
            objectFit: "cover",
            transition: "opacity 0.7s ease",
            opacity: fading ? 0 : 1,
          }}
        />
        <div className="showcase-overlay" />
      </div>
      <div className="showcase-text" style={{ transition: "opacity 0.7s ease", opacity: fading ? 0 : 1 }}>
        <h2 className="showcase-line">{slide.line1}</h2>
        <h2 className="showcase-line-accent">{slide.line2}</h2>
      </div>
    </section>
  );
}
