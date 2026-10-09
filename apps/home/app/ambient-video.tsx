"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientVideoProps {
  src: string;
  /** Lighter rendition served to small screens. */
  mobileSrc?: string;
  poster?: string;
  width?: number;
  height?: number;
  label?: string;
  forcePlayback?: boolean;
}

const MOBILE_MAX_WIDTH = 640;

export function AmbientVideo({
  src,
  mobileSrc,
  poster,
  width = 1920,
  height = 1080,
  label = "Ambient background video",
  forcePlayback = false,
}: AmbientVideoProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState("pending");

  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    // Playback starts only behind an already sized poster.
    if (!frame || !video || !poster || width <= 0 || height <= 0) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let visible = false;
    let cancelled = false;
    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;
    video.preload = "metadata";

    const update = () => {
      if (cancelled) return;
      if (!visible || document.visibilityState === "hidden" || (!forcePlayback && (motion.matches || connection?.saveData))) {
        video.pause();
        return;
      }
      const small = Math.min(window.innerWidth, window.screen.width) <= MOBILE_MAX_WIDTH;
      const activeSource = mobileSrc && small ? mobileSrc : src;
      if (video.getAttribute("src") !== activeSource) {
        video.src = activeSource;
        video.load();
      }
      void video.play().catch(() => {});
    };
    const syncPlaybackState = () => {
      if (!cancelled && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setPlaybackStatus("playing");
      }
    };
    const checkVisibility = () => {
      const bounds = frame.getBoundingClientRect();
      visible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight;
      update();
    };
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        update();
      }, { threshold: 0.01 })
      : null;
    if (observer) observer.observe(frame);
    else {
      checkVisibility();
      window.addEventListener("scroll", checkVisibility, { passive: true });
      window.addEventListener("resize", checkVisibility);
    }
    motion.addEventListener("change", update);
    connection?.addEventListener?.("change", update);
    video.addEventListener("playing", syncPlaybackState);
    video.addEventListener("timeupdate", syncPlaybackState);
    document.addEventListener("visibilitychange", update);
    document.addEventListener("pointerdown", update, { passive: true });
    window.addEventListener("pageshow", update);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      motion.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
      video.removeEventListener("playing", syncPlaybackState);
      video.removeEventListener("timeupdate", syncPlaybackState);
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("pointerdown", update);
      window.removeEventListener("pageshow", update);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [forcePlayback, src, mobileSrc, poster, width, height]);

  return (
    <div ref={frameRef} className="ambient-video-frame" data-playback-status={playbackStatus}>
      <video
        ref={videoRef}
        data-ambient-video="single"
        className="ambient-video"
        width={width}
        height={height}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback"
        aria-label={label}
      />
    </div>
  );
}
