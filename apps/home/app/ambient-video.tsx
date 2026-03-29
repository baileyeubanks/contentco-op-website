"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientVideoProps {
  src: string | readonly string[];
  /** Single looping video for Safari (avoids multi-element crossfade issues). */
  safariFallback?: string;
  poster: string;
  label?: string;
  forcePlayback?: boolean;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
}

function configureVideo(video: HTMLVideoElement) {
  video.defaultMuted = true;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.loop = true;
  video.controls = false;
  video.preload = "metadata";
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("loop", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.removeAttribute("controls");
}

async function attemptPlay(video: HTMLVideoElement) {
  configureVideo(video);
  try {
    await video.play();
  } catch {
    // Safari can reject autoplay until metadata is ready.
  }
}

function waitForPlaybackStart(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (!video.paused && video.currentTime > 0.01) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const check = () => {
      if (!video.paused && video.currentTime > 0.01) {
        finish();
      }
    };
    const cleanup = () => {
      video.removeEventListener("playing", check);
      video.removeEventListener("timeupdate", check);
      video.removeEventListener("canplay", check);
      window.clearTimeout(timeoutId);
    };

    video.addEventListener("playing", check);
    video.addEventListener("timeupdate", check);
    video.addEventListener("canplay", check);
    const timeoutId = window.setTimeout(finish, 1200);
  });
}

function waitForVideoReady(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }

    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      video.removeEventListener("loadeddata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("error", finish);
      video.removeEventListener("stalled", finish);
    };

    video.addEventListener("loadeddata", finish, { once: true });
    video.addEventListener("canplay", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
    video.addEventListener("stalled", finish, { once: true });
  });
}

async function loadClip(video: HTMLVideoElement, src: string, shouldPlay: boolean) {
  configureVideo(video);
  if (video.getAttribute("src") !== src) {
    video.src = src;
  }
  video.load();
  await waitForVideoReady(video);
  if (shouldPlay) {
    await attemptPlay(video);
  }
}

async function fetchVideoBlobUrl(src: string, signal: AbortSignal) {
  const response = await fetch(src, {
    cache: "force-cache",
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(`hero_video_fetch_failed:${response.status}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function AmbientVideo({
  src,
  safariFallback,
  poster,
  label = "Ambient background video",
  forcePlayback = false,
}: AmbientVideoProps) {
  const clips = Array.isArray(src) ? src : [src];
  const isMulti = clips.length > 1;
  const [preferSafariSingle, setPreferSafariSingle] = useState(false);

  useEffect(() => {
    setPreferSafariSingle(Boolean(isMulti && safariFallback && isSafari()));
  }, [isMulti, safariFallback]);

  // Safari chokes on dual-element crossfade — fall back to single looping video.
  if (preferSafariSingle && safariFallback) {
    return <SingleClipVideo src={safariFallback} poster={poster} label={label} forcePlayback={forcePlayback} />;
  }

  if (isMulti) {
    return <MultiClipVideo clips={clips} poster={poster} label={label} forcePlayback={forcePlayback} />;
  }

  return <SingleClipVideo src={clips[0]} poster={poster} label={label} forcePlayback={forcePlayback} />;
}

/* ── Single clip: loop forever ── */
function SingleClipVideo({
  src,
  poster,
  label,
  forcePlayback,
}: {
  src: string;
  poster: string;
  label: string;
  forcePlayback: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [sourceMode, setSourceMode] = useState<"direct" | "blob">("direct");
  const [activeSrc, setActiveSrc] = useState(src);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setHasStartedPlayback(false);
    setSourceMode("direct");
    setActiveSrc(src);
    const shouldPlay = forcePlayback || !shouldPause();
    if (!shouldPlay) {
      configureVideo(video);
      video.pause();
      return;
    }

    let cancelled = false;
    let activeBlobUrl: string | null = null;
    let blobFallbackAttempted = false;
    const blobController = new AbortController();
    video.loop = true;

    const releaseBlobUrl = () => {
      if (!activeBlobUrl) return;
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = null;
    };

    const playbackHasStarted = () => !video.paused && video.currentTime > 0.01;
    const directSourceFailed = () =>
      !playbackHasStarted()
      && !src.startsWith("blob:")
      && (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
        || video.readyState === HTMLMediaElement.HAVE_NOTHING);

    const tryPlay = () => {
      if (cancelled) return;
      void attemptPlay(video);
    };

    const syncPlaybackState = () => {
      if (!cancelled) {
        const started = !video.paused && video.currentTime > 0.01;
        if (started) {
          setHasStartedPlayback(true);
        }
      }
    };

    const tryBlobFallback = async () => {
      if (cancelled || blobFallbackAttempted || !isSafari() || src.startsWith("blob:")) {
        return;
      }
      blobFallbackAttempted = true;

      try {
        const blobUrl = await fetchVideoBlobUrl(src, blobController.signal);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        releaseBlobUrl();
        activeBlobUrl = blobUrl;
        setActiveSrc(blobUrl);
        setSourceMode("blob");
        await loadClip(video, blobUrl, shouldPlay);
        syncPlaybackState();
        tryPlay();
      } catch {
        if (!cancelled) {
          setSourceMode("direct");
        }
      }
    };

    void loadClip(video, src, shouldPlay).then(() => {
      if (!cancelled) {
        syncPlaybackState();
        if (directSourceFailed()) {
          void tryBlobFallback();
        }
      }
    });

    const frameId = window.requestAnimationFrame(tryPlay);
    const timeoutIds = [
      window.setTimeout(tryPlay, 24),
      window.setTimeout(tryPlay, 120),
      window.setTimeout(tryPlay, 360),
      window.setTimeout(tryPlay, 900),
      window.setTimeout(tryPlay, 1800),
      window.setTimeout(tryPlay, 2800),
      window.setTimeout(() => {
        if (directSourceFailed()) {
          void tryBlobFallback();
        }
      }, 1200),
      window.setTimeout(() => {
        if (directSourceFailed()) {
          void tryBlobFallback();
        }
      }, 2800),
    ];
    const playbackGuardId = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible" || !video.paused) return;
      tryPlay();
    }, 1200);
    const playbackStateId = window.setInterval(() => {
      if (cancelled) return;
      syncPlaybackState();
    }, 250);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
      }
    };

    const handlePageShow = () => {
      tryPlay();
    };

    const handleFirstInteraction = () => {
      tryPlay();
    };

    const handleSourceStall = () => {
      tryPlay();
      if (directSourceFailed()) {
        void tryBlobFallback();
      }
    };

    const handleSourceError = () => {
      if (directSourceFailed()) {
        void tryBlobFallback();
      }
    };

    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("canplaythrough", tryPlay);
    video.addEventListener("suspend", handleSourceStall);
    video.addEventListener("stalled", handleSourceStall);
    video.addEventListener("error", handleSourceError);
    video.addEventListener("playing", syncPlaybackState);
    video.addEventListener("timeupdate", syncPlaybackState);
    video.addEventListener("pause", syncPlaybackState);
    video.addEventListener("waiting", syncPlaybackState);
    video.addEventListener("stalled", syncPlaybackState);
    video.addEventListener("emptied", syncPlaybackState);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("load", handlePageShow);
    window.addEventListener("pointerdown", handleFirstInteraction, { passive: true, once: true });
    window.addEventListener("mousemove", handleFirstInteraction, { passive: true, once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { passive: true, once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });
    window.addEventListener("scroll", handleFirstInteraction, { passive: true, once: true });
    tryPlay();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.clearInterval(playbackGuardId);
      window.clearInterval(playbackStateId);
      blobController.abort();
      releaseBlobUrl();
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("canplaythrough", tryPlay);
      video.removeEventListener("suspend", handleSourceStall);
      video.removeEventListener("stalled", handleSourceStall);
      video.removeEventListener("error", handleSourceError);
      video.removeEventListener("playing", syncPlaybackState);
      video.removeEventListener("timeupdate", syncPlaybackState);
      video.removeEventListener("pause", syncPlaybackState);
      video.removeEventListener("waiting", syncPlaybackState);
      video.removeEventListener("stalled", syncPlaybackState);
      video.removeEventListener("emptied", syncPlaybackState);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("load", handlePageShow);
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("mousemove", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("scroll", handleFirstInteraction);
    };
  }, [forcePlayback, src]);

  return (
    <div
      className="ambient-video-frame"
      data-playback-status={hasStartedPlayback ? "playing" : "pending"}
      data-source-mode={sourceMode}
    >
      {/* Keep Safari from surfacing a paused play glyph before autoplay catches. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        className={`ambient-video-fallback ${hasStartedPlayback ? "ambient-video-fallback-hidden" : ""}`}
        aria-hidden="true"
      />
      <video
        ref={ref}
        className="ambient-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        src={activeSrc}
        poster={poster}
        disablePictureInPicture
        disableRemotePlayback
        aria-label={label}
      />
    </div>
  );
}

/* ── Multi clip: crossfade rotation ── */
function MultiClipVideo({
  clips,
  poster,
  label,
  forcePlayback,
}: {
  clips: readonly string[];
  poster: string;
  label: string;
  forcePlayback: boolean;
}) {
  const [playlist] = useState(() => [...clips]);
  const initialClip = playlist[0] ?? "";
  const indexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const [showB, setShowB] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const activeLayerRef = useRef(false);
  const isVisibleRef = useRef(true);
  const transitionRef = useRef(false);

  useEffect(() => {
    activeLayerRef.current = showB;
  }, [showB]);

  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    const container = containerRef.current;
    if (!videoA || !videoB || !container) return;
    configureVideo(videoA);
    configureVideo(videoB);
    if (!forcePlayback && shouldPause()) {
      videoA.pause();
      videoB.pause();
      return;
    }

    let cancelled = false;
    setHasStartedPlayback(false);
    transitionRef.current = false;
    const frameIds: number[] = [];
    const timeoutIds: number[] = [];
    const syncPlaybackState = () => {
      if (cancelled) return;
      const active = activeLayerRef.current ? videoB : videoA;
      const started = !active.paused && active.currentTime > 0.01;
      if (started) {
        setHasStartedPlayback(true);
      }
    };
    const playbackGuardId = window.setInterval(() => {
      if (cancelled || !isVisibleRef.current) return;
      const active = activeLayerRef.current ? videoB : videoA;
      if (!active.paused) return;
      void attemptPlay(active);
    }, 1200);

    const schedulePlayback = (video: HTMLVideoElement) => {
      frameIds.push(window.requestAnimationFrame(() => {
        if (!cancelled && isVisibleRef.current) {
          void attemptPlay(video);
        }
      }));
      for (const delay of [24, 120, 360, 900, 1800, 2800]) {
        timeoutIds.push(
          window.setTimeout(() => {
            if (!cancelled && isVisibleRef.current) {
              void attemptPlay(video);
            }
          }, delay),
        );
      }
    };

    const queueUpcomingClip = (video: HTMLVideoElement, clipIndex: number) => {
      const nextSrc = playlist[clipIndex % playlist.length];
      return loadClip(video, nextSrc, false);
    };

    // Kickstart Safari's media pipeline immediately
    videoA.load();
    void attemptPlay(videoA);

    void loadClip(videoA, initialClip, true).then(() => {
      if (!cancelled) {
        schedulePlayback(videoA);
        syncPlaybackState();
        if (playlist.length > 1) {
          void queueUpcomingClip(videoB, 1);
        }
      }
    });

    // Intersection observer: play/pause based on visibility
    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        const active = activeLayerRef.current ? videoB : videoA;
        if (entry.isIntersecting) {
          void attemptPlay(active);
        } else {
          videoA.pause();
          videoB.pause();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(container);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const active = activeLayerRef.current ? videoB : videoA;
        void attemptPlay(active);
        schedulePlayback(active);
      }
    };

    const handlePageShow = () => {
      const active = activeLayerRef.current ? videoB : videoA;
      void attemptPlay(active);
      schedulePlayback(active);
    };

    const handleFirstInteraction = () => {
      const active = activeLayerRef.current ? videoB : videoA;
      void attemptPlay(active);
      schedulePlayback(active);
    };

    const handleReadyA = () => {
      if (!activeLayerRef.current && isVisibleRef.current) {
        void attemptPlay(videoA);
      }
      syncPlaybackState();
    };

    const handleReadyB = () => {
      if (activeLayerRef.current && isVisibleRef.current) {
        void attemptPlay(videoB);
      }
      syncPlaybackState();
    };

    const handlePlaybackEvent = () => {
      syncPlaybackState();
    };

    const handleClipEnded = () => {
      if (cancelled || transitionRef.current || playlist.length <= 1) return;
      void crossfadeTo(activeLayerRef.current ? videoARef.current : videoBRef.current, !activeLayerRef.current);
    };

    for (const eventName of ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "suspend", "stalled"] as const) {
      videoA.addEventListener(eventName, handleReadyA);
      videoB.addEventListener(eventName, handleReadyB);
    }
    for (const eventName of ["playing", "timeupdate", "pause", "waiting", "stalled", "emptied"] as const) {
      videoA.addEventListener(eventName, handlePlaybackEvent);
      videoB.addEventListener(eventName, handlePlaybackEvent);
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("load", handlePageShow);
    window.addEventListener("pointerdown", handleFirstInteraction, { passive: true, once: true });
    window.addEventListener("mousemove", handleFirstInteraction, { passive: true, once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { passive: true, once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });
    window.addEventListener("scroll", handleFirstInteraction, { passive: true, once: true });
    videoA.addEventListener("ended", handleClipEnded);
    videoB.addEventListener("ended", handleClipEnded);

    async function crossfadeTo(nextVideo: HTMLVideoElement | null, toB: boolean) {
      if (!nextVideo || transitionRef.current) return;
      transitionRef.current = true;
      const previousActive = activeLayerRef.current ? videoBRef.current : videoARef.current;
      const nextIndex = (indexRef.current + 1) % playlist.length;
      try {
        await loadClip(nextVideo, playlist[nextIndex], false);
        if (cancelled) return;
        await attemptPlay(nextVideo);
        await waitForPlaybackStart(nextVideo);
        if (cancelled) return;
      } finally {
        if (cancelled) {
          transitionRef.current = false;
        }
      }

      indexRef.current = nextIndex;
      activeLayerRef.current = toB;
      setShowB(toB);
      schedulePlayback(nextVideo);
      syncPlaybackState();
      window.setTimeout(() => {
        if (!previousActive) return;
        previousActive.pause();
        previousActive.currentTime = 0;
        if (playlist.length > 2) {
          void queueUpcomingClip(previousActive, nextIndex + 1);
        }
      }, 1250);
      transitionRef.current = false;
    }

    return () => {
      cancelled = true;
      for (const frameId of frameIds) {
        window.cancelAnimationFrame(frameId);
      }
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.clearInterval(playbackGuardId);
      obs.disconnect();
      for (const eventName of ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "suspend", "stalled"] as const) {
        videoA.removeEventListener(eventName, handleReadyA);
        videoB.removeEventListener(eventName, handleReadyB);
      }
      for (const eventName of ["playing", "timeupdate", "pause", "waiting", "stalled", "emptied"] as const) {
        videoA.removeEventListener(eventName, handlePlaybackEvent);
        videoB.removeEventListener(eventName, handlePlaybackEvent);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("load", handlePageShow);
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("mousemove", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("scroll", handleFirstInteraction);
      videoA.removeEventListener("ended", handleClipEnded);
      videoB.removeEventListener("ended", handleClipEnded);
    };
  }, [forcePlayback, playlist]);

  return (
    <div
      ref={containerRef}
      className={`ambient-video-stack ${hasStartedPlayback ? "ambient-video-stack-ready" : ""}`}
    >
      {/* Keep Safari from showing a paused first frame or blank surface before autoplay catches. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        className={`ambient-video-fallback ${hasStartedPlayback ? "ambient-video-fallback-hidden" : ""}`}
        aria-hidden="true"
      />
      <video
        ref={videoARef}
        src={initialClip}
        className={`ambient-video ambient-video-layer ${!showB ? "ambient-video-visible" : ""}`}
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={label}
        onLoadedData={() => { if (videoARef.current) void attemptPlay(videoARef.current); }}
      />
      <video
        ref={videoBRef}
        className={`ambient-video ambient-video-layer ${showB ? "ambient-video-visible" : ""}`}
        autoPlay
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    </div>
  );
}

/* ── Helpers ── */
function shouldPause(): boolean {
  if (typeof window === "undefined") return true;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return prefersReducedMotion || Boolean(nav.connection?.saveData);
}
