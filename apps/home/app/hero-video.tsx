"use client";

import { useEffect, useRef } from "react";

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const posterRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const saveData = Boolean(nav.connection?.saveData);
    const shouldUsePosterOnly = prefersReducedMotion || saveData;

    if (shouldUsePosterOnly) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!video) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function handleTapToPlay() {
    const video = ref.current;
    if (!video) return;
    void video.play().catch(() => undefined);
    if (posterRef.current) {
      posterRef.current.style.opacity = "0";
      posterRef.current.style.pointerEvents = "none";
    }
  }

  return (
    <>
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        poster="/media/hero-poster.jpg"
        aria-label="Industrial production hero video"
      >
        <source src="/media/hero-1080.webm" type="video/webm" />
        <source src="/media/hero-1080.mp4" type="video/mp4" />
      </video>
      <img
        ref={posterRef}
        className="poster"
        src="/media/hero-poster.jpg"
        alt=""
        aria-hidden="true"
      />
      <button type="button" className="mobile-play" onClick={handleTapToPlay}>
        Play hero
      </button>
    </>
  );
}
