"use client";

import { useEffect, useRef, useState } from "react";

interface HeroVideoSequenceProps {
  firstSrc: string;
  nextSrc: string;
  nextMobileSrc: string;
  poster: string;
}

// Source-pixel centers of the weather station, then the authored facility/tablet shots.
const weatherFocalAnchors = [[0, 625], [2, 880], [4, 900], [6, 950], [7, 960], [9, 960], [11, 900], [13.7, 725]] as const;

function updateWeatherFocal(video: HTMLVideoElement) {
  if (window.innerWidth > 760 || !video.videoWidth || !video.videoHeight) return;
  const frame = video.getBoundingClientRect();
  if (!Number.isFinite(frame.width) || !Number.isFinite(frame.height) || frame.width <= 0 || frame.height <= 0) return;
  const visibleWidth = Math.min(video.videoWidth, frame.width * video.videoHeight / frame.height);
  const cropWidth = video.videoWidth - visibleWidth;
  if (cropWidth <= 0) return;
  let center = weatherFocalAnchors[weatherFocalAnchors.length - 1][1] as number;
  for (let index = 1; index < weatherFocalAnchors.length; index += 1) {
    const [time, x] = weatherFocalAnchors[index];
    if (video.currentTime <= time) {
      const [previousTime, previousX] = weatherFocalAnchors[index - 1];
      const progress = Math.max(0, (video.currentTime - previousTime) / (time - previousTime));
      center = previousX + (x - previousX) * progress;
      break;
    }
  }
  const position = Math.max(0, Math.min(100, (center - visibleWidth / 2) / cropWidth * 100));
  video.style.setProperty("--weather-focal-x", `${position}%`);
}

/** Keep the outgoing frame visible until the next clip actually starts. */
export function HeroVideoSequence({ firstSrc, nextSrc, nextMobileSrc, poster }: HeroVideoSequenceProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(false);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [sources, setSources] = useState<readonly string[]>([]);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [handoff, setHandoff] = useState<number | null>(null);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const failedRef = useRef([false, false]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const mountedVideos = videos.current;
    const update = () => {
      videos.current.forEach((video) => video?.pause());
      activeRef.current = 0;
      pendingRef.current = null;
      failedRef.current = [false, false];
      setActive(0);
      setStarted(false);
      setHandoff(null);
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      if (motion.matches || connection?.saveData) {
        setSources([]);
        return;
      }
      if (visibleRef.current && document.visibilityState !== "hidden") {
        const mobile = Math.min(window.innerWidth, window.screen.width) <= 640;
        setSources([firstSrc, mobile ? nextMobileSrc : nextSrc]);
      } else {
        setSources([]);
      }
    };
    const resumeVisible = () => {
      if (!visibleRef.current || document.visibilityState === "hidden" || motion.matches || connection?.saveData) {
        videos.current.forEach((video) => video?.pause());
        return;
      }
      const video = videos.current[pendingRef.current ?? activeRef.current];
      if (!video) update();
      else {
        if (!video.getAttribute("src") && video.dataset.src) {
          video.src = video.dataset.src;
          video.load();
        }
        void video.play().catch(() => {});
      }
    };
    update();
    const checkVisibility = () => {
      const bounds = frameRef.current?.getBoundingClientRect();
      visibleRef.current = Boolean(bounds && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight);
      resumeVisible();
    };
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
        visibleRef.current = entry.isIntersecting;
        resumeVisible();
      }, { threshold: 0.01 })
      : null;
    if (observer && frameRef.current) observer.observe(frameRef.current);
    else {
      checkVisibility();
      window.addEventListener("scroll", checkVisibility, { passive: true });
      window.addEventListener("resize", checkVisibility);
    }
    motion.addEventListener("change", update);
    connection?.addEventListener("change", update);
    document.addEventListener("visibilitychange", resumeVisible);
    window.addEventListener("pageshow", resumeVisible);
    document.addEventListener("pointerdown", resumeVisible, { passive: true });
    return () => {
      observer?.disconnect();
      visibleRef.current = false;
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
      motion.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", resumeVisible);
      window.removeEventListener("pageshow", resumeVisible);
      document.removeEventListener("pointerdown", resumeVisible);
      mountedVideos.forEach((video) => video?.pause());
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    };
  }, [firstSrc, nextSrc, nextMobileSrc]);

  useEffect(() => {
    if (!sources.length) return;
    const mountedVideos = [...videos.current];
    const first = mountedVideos[0];
    let focalFrame: number | undefined;
    const updateFocal = () => {
      if (first && activeRef.current === 0) updateWeatherFocal(first);
    };
    const trackFocalFrame = () => {
      updateFocal();
      focalFrame = undefined;
      if (first?.requestVideoFrameCallback && !first.paused && !first.ended && activeRef.current === 0) {
        focalFrame = first.requestVideoFrameCallback(trackFocalFrame);
      }
    };
    const stopFocalFrames = () => {
      if (first && focalFrame !== undefined) first.cancelVideoFrameCallback(focalFrame);
      focalFrame = undefined;
    };
    const startFocalFrames = () => {
      stopFocalFrames();
      if (first?.requestVideoFrameCallback) focalFrame = first.requestVideoFrameCallback(trackFocalFrame);
    };
    if (first) {
      first.addEventListener("playing", startFocalFrames);
      first.addEventListener("pause", stopFocalFrames);
      first.addEventListener("ended", stopFocalFrames);
      first.muted = true;
      if (visibleRef.current && document.visibilityState !== "hidden") void first.play().catch(() => {});
    }
    window.addEventListener("resize", updateFocal);
    return () => {
      mountedVideos.forEach((video) => video?.pause());
      window.removeEventListener("resize", updateFocal);
      stopFocalFrames();
      first?.removeEventListener("playing", startFocalFrames);
      first?.removeEventListener("pause", stopFocalFrames);
      first?.removeEventListener("ended", stopFocalFrames);
    };
  }, [sources]);

  const advance = (index: number) => {
    const preferred = (index + 1) % 2;
    const nextIndex = failedRef.current[preferred] ? index : preferred;
    if (failedRef.current[nextIndex]) {
      setStarted(false);
      setSources([]);
      pendingRef.current = null;
      return;
    }
    const next = videos.current[nextIndex];
    if (!next) return;
    pendingRef.current = nextIndex;
    next.currentTime = 0;
    if (!visibleRef.current || document.visibilityState === "hidden") return;
    if (!next.getAttribute("src")) {
      next.src = sources[nextIndex];
      next.load();
    }
    next.muted = true;
    void next.play().catch(() => {});
  };

  return (
    <div ref={frameRef} className="ambient-video-frame hero-video-sequence" data-hero-sequence="weather-vane,existing-drone" data-playback-status={started ? "playing" : "poster"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-sequence-poster" src={poster} width={1920} height={1080} alt="Weather vane at sunset" fetchPriority="high" />
      {sources.map((source, index) => (
        <video
          key={source}
          ref={(video) => { videos.current[index] = video; }}
          className={`ambient-video hero-sequence-video${index === 0 ? " hero-sequence-video--wide" : ""}${active === index && started ? " is-active" : ""}${handoff === index ? " is-outgoing" : ""}${handoff !== null && active === index ? " is-incoming" : ""}`}
          data-src={source}
          src={index === 0 ? source : undefined}
          width={1920}
          height={1080}
          poster={poster}
          muted
          playsInline
          preload={index === 0 ? "metadata" : "none"}
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          onLoadedMetadata={(event) => { if (index === 0) updateWeatherFocal(event.currentTarget); }}
          onSeeked={(event) => { if (index === 0) updateWeatherFocal(event.currentTarget); }}
          onTimeUpdate={(event) => {
            if (index === 0 && activeRef.current === 0) updateWeatherFocal(event.currentTarget);
          }}
          onCanPlay={(event) => {
            if (index === 0 && !started && visibleRef.current && document.visibilityState !== "hidden") void event.currentTarget.play().catch(() => {});
          }}
          onPlaying={(event) => {
            if (!visibleRef.current || document.visibilityState === "hidden") {
              event.currentTarget.pause();
              return;
            }
            if (index === 0 && videos.current[0]) updateWeatherFocal(videos.current[0]);
            const previousIndex = activeRef.current;
            const previous = videos.current[previousIndex];
            if (previousIndex !== index) {
              previous?.pause();
              setHandoff(previousIndex);
              if (handoffTimer.current) clearTimeout(handoffTimer.current);
              // Animation cleanup only: clip advancement remains exclusively onEnded/onError.
              handoffTimer.current = setTimeout(() => setHandoff(null), 420);
            }
            activeRef.current = index;
            pendingRef.current = null;
            setActive(index);
            setStarted(true);
          }}
          onEnded={() => advance(index)}
          onError={() => {
            failedRef.current[index] = true;
            // Failed background preloading must not rewind the currently playing clip.
            if (index === activeRef.current || index === pendingRef.current) advance(index);
          }}
        />
      ))}
    </div>
  );
}
