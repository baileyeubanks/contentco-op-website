"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientVideoProps {
  src: string | string[];
  poster: string;
  label?: string;
}

function shuffle<T>(arr: T[], keepFirst = 0): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > keepFirst; i--) {
    const j = keepFirst + Math.floor(Math.random() * (i - keepFirst + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function AmbientVideo({ src, poster, label = "Ambient background video" }: AmbientVideoProps) {
  const clips = Array.isArray(src) ? src : [src];
  const isMulti = clips.length > 1;

  if (isMulti) {
    return <MultiClipVideo clips={clips} poster={poster} label={label} />;
  }

  return <SingleClipVideo src={clips[0]} poster={poster} label={label} />;
}

/* ── Single clip: loop forever ── */
function SingleClipVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (shouldPause()) { video.pause(); return; }

    const obs = createPlayPauseObserver(video);
    obs.observe(video);
    return () => obs.disconnect();
  }, []);

  return (
    <video ref={ref} className="ambient-video" autoPlay muted loop playsInline poster={poster} aria-label={label}>
      <source src={src} type="video/mp4" />
    </video>
  );
}

/* ── Multi clip: crossfade rotation ── */
function MultiClipVideo({ clips, poster, label }: { clips: string[]; poster: string; label: string }) {
  const [playlist] = useState(() => shuffle(clips, 3));
  const indexRef = useRef(0);
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const [showB, setShowB] = useState(false);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;
    if (shouldPause()) { videoA.pause(); return; }

    // Start first clip
    videoA.src = playlist[0];
    videoA.load();
    void videoA.play().catch(() => undefined);

    // Intersection observer: play/pause based on visibility
    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        const active = showB ? videoB : videoA;
        if (entry.isIntersecting) {
          void active.play().catch(() => undefined);
        } else {
          videoA.pause();
          videoB.pause();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(videoA);

    // On clip end: crossfade to next — each clip plays once, full duration
    function onEndedA() { crossfadeTo(videoBRef.current, true); }
    function onEndedB() { crossfadeTo(videoARef.current, false); }

    function crossfadeTo(nextVideo: HTMLVideoElement | null, toB: boolean) {
      if (!nextVideo) return;
      indexRef.current = (indexRef.current + 1) % playlist.length;
      nextVideo.src = playlist[indexRef.current];
      nextVideo.load();
      if (isVisibleRef.current) {
        void nextVideo.play().catch(() => undefined);
      }
      setShowB(toB);
    }

    videoA.addEventListener("ended", onEndedA);
    videoB.addEventListener("ended", onEndedB);

    return () => {
      obs.disconnect();
      videoA.removeEventListener("ended", onEndedA);
      videoB.removeEventListener("ended", onEndedB);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <video
        ref={videoARef}
        className={`ambient-video ambient-video-layer ${!showB ? "ambient-video-visible" : ""}`}
        muted
        playsInline
        poster={poster}
        aria-label={label}
      />
      <video
        ref={videoBRef}
        className={`ambient-video ambient-video-layer ${showB ? "ambient-video-visible" : ""}`}
        muted
        playsInline
        aria-hidden="true"
      />
    </>
  );
}

/* ── Helpers ── */
function shouldPause(): boolean {
  if (typeof window === "undefined") return true;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return prefersReducedMotion || Boolean(nav.connection?.saveData);
}

function createPlayPauseObserver(video: HTMLVideoElement): IntersectionObserver {
  return new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    },
    { threshold: 0.15 }
  );
}
