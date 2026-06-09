"use client";

import { useEffect, useRef, useState } from "react";

interface AmbientVideoProps {
  src: string;
  /** Lighter rendition served to small screens and save-data connections. */
  mobileSrc?: string;
  poster?: string;
  label?: string;
  forcePlayback?: boolean;
}

const MOBILE_MAX_WIDTH = 640;

const inlineAutoplayAttributes = {
  defaultmuted: "",
  fetchPriority: "high",
  "webkit-playsinline": "",
  "x-webkit-airplay": "deny",
} as Record<string, string>;

const earlyAutoplayScript = `
(() => {
  const script = document.currentScript;
  const video = script && script.previousElementSibling instanceof HTMLVideoElement
    ? script.previousElementSibling
    : null;
  if (!video) return;

  const mobileSrc = video.dataset.mobileSrc;
  if (mobileSrc) {
    const saveData = navigator.connection && navigator.connection.saveData;
    const small = Math.min(window.innerWidth, window.screen ? window.screen.width : Infinity) <= ${MOBILE_MAX_WIDTH};
    if ((small || saveData) && video.getAttribute("src") !== mobileSrc) {
      video.setAttribute("src", mobileSrc);
      video.load();
    }
  }

  const frame = video.parentElement;
  const markReady = () => {
    if (!frame) return;
    if (!video.paused && (video.currentTime > 0.01 || video.readyState >= 2)) {
      frame.dataset.playbackStatus = "playing";
    } else if (video.readyState >= 2) {
      frame.dataset.playbackStatus = "ready";
    }
  };

  const play = () => {
    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.preload = "auto";
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("defaultmuted", "");
    video.setAttribute("loop", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.removeAttribute("controls");
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
    markReady();
  };

  ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "progress", "suspend", "playing", "timeupdate"].forEach((eventName) => {
    video.addEventListener(eventName, () => {
      markReady();
      play();
    }, { passive: true });
  });
  ["pageshow", "focus", "load"].forEach((eventName) => {
    window.addEventListener(eventName, play, { passive: true });
  });
  ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, play, { passive: true, capture: true });
  });
  if ("requestVideoFrameCallback" in video) {
    video.requestVideoFrameCallback(() => {
      markReady();
      play();
    });
  }

  play();
  requestAnimationFrame(play);
  [16, 32, 48, 64, 96, 128, 160, 192, 224, 256, 320, 480, 640, 900].forEach((delay) => window.setTimeout(play, delay));
})();
`;

function configureVideo(video: HTMLVideoElement) {
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.controls = false;
  video.preload = "auto";
  video.setAttribute("autoplay", "");
  video.setAttribute("muted", "");
  video.setAttribute("defaultmuted", "");
  video.setAttribute("loop", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("fetchpriority", "high");
  video.removeAttribute("controls");
}

function normalizeMediaUrl(src: string) {
  return new URL(src, window.location.href).href;
}

async function attemptPlay(video: HTMLVideoElement) {
  configureVideo(video);
  try {
    await video.play();
  } catch {
    // Mobile Safari may wait for the stream pipeline before accepting play().
  }
}

function hasVisiblePlayback(video: HTMLVideoElement) {
  return !video.paused
    && (video.currentTime > 0.01 || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
}

function shouldPause(): boolean {
  if (typeof window === "undefined") return true;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return prefersReducedMotion || Boolean(nav.connection?.saveData);
}

function prefersMobileRendition(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  const screenWidth = window.screen?.width ?? Infinity;
  const small = Math.min(window.innerWidth, screenWidth) <= MOBILE_MAX_WIDTH;
  return small || Boolean(nav.connection?.saveData);
}

export function AmbientVideo({
  src,
  mobileSrc,
  poster,
  label = "Ambient background video",
  forcePlayback = false,
}: AmbientVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false);
  const playbackStatus = hasStartedPlayback ? "playing" : hasLoadedFrame ? "ready" : "pending";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const shouldPlay = forcePlayback || !shouldPause();
    configureVideo(video);
    if (!shouldPlay) {
      video.pause();
      return;
    }

    let cancelled = false;
    const activeSource = mobileSrc && prefersMobileRendition() ? mobileSrc : src;

    const applySource = (nextSource: string) => {
      const nextUrl = normalizeMediaUrl(nextSource);
      const attrSrc = video.getAttribute("src");
      const attrUrl = attrSrc ? normalizeMediaUrl(attrSrc) : "";
      const browserAlreadySelectedSource = video.currentSrc === nextUrl || attrUrl === nextUrl;

      if (!browserAlreadySelectedSource) {
        video.src = nextSource;
        video.load();
      }
    };

    const tryPlay = () => {
      if (!cancelled) {
        void attemptPlay(video);
      }
    };

    const syncPlaybackState = () => {
      if (cancelled) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setHasLoadedFrame(true);
      }
      if (hasVisiblePlayback(video)) {
        setHasStartedPlayback(true);
      }
    };

    applySource(activeSource);
    tryPlay();

    const frameId = window.requestAnimationFrame(tryPlay);
    const timeoutIds = [
      window.setTimeout(tryPlay, 16),
      window.setTimeout(tryPlay, 24),
      window.setTimeout(tryPlay, 48),
      window.setTimeout(tryPlay, 80),
      window.setTimeout(tryPlay, 120),
      window.setTimeout(tryPlay, 170),
      window.setTimeout(tryPlay, 220),
      window.setTimeout(tryPlay, 280),
      window.setTimeout(tryPlay, 360),
      window.setTimeout(tryPlay, 520),
      window.setTimeout(tryPlay, 900),
      window.setTimeout(tryPlay, 1800),
      window.setTimeout(tryPlay, 2800),
    ];
    const stateIntervalId = window.setInterval(syncPlaybackState, 180);
    const playIntervalId = window.setInterval(() => {
      if (document.visibilityState === "visible" && video.paused) {
        tryPlay();
      }
    }, 900);

    const handleReady = () => {
      syncPlaybackState();
      tryPlay();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
      }
    };
    const handleSourceIssue = () => {
      syncPlaybackState();
      tryPlay();
    };
    const handleInteraction = () => {
      tryPlay();
    };

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("canplaythrough", handleReady);
    video.addEventListener("playing", syncPlaybackState);
    video.addEventListener("timeupdate", syncPlaybackState);
    video.addEventListener("waiting", syncPlaybackState);
    video.addEventListener("stalled", handleSourceIssue);
    video.addEventListener("error", handleSourceIssue);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("pointerdown", handleInteraction, { capture: true });
    document.addEventListener("touchstart", handleInteraction, { capture: true });
    document.addEventListener("keydown", handleInteraction, { capture: true });
    window.addEventListener("pageshow", tryPlay);
    window.addEventListener("focus", tryPlay);
    window.addEventListener("load", tryPlay);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.clearInterval(stateIntervalId);
      window.clearInterval(playIntervalId);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("canplaythrough", handleReady);
      video.removeEventListener("playing", syncPlaybackState);
      video.removeEventListener("timeupdate", syncPlaybackState);
      video.removeEventListener("waiting", syncPlaybackState);
      video.removeEventListener("stalled", handleSourceIssue);
      video.removeEventListener("error", handleSourceIssue);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("pointerdown", handleInteraction, { capture: true });
      document.removeEventListener("touchstart", handleInteraction, { capture: true });
      document.removeEventListener("keydown", handleInteraction, { capture: true });
      window.removeEventListener("pageshow", tryPlay);
      window.removeEventListener("focus", tryPlay);
      window.removeEventListener("load", tryPlay);
    };
  }, [forcePlayback, src, mobileSrc]);

  return (
    <div
      className="ambient-video-frame"
      data-playback-status={playbackStatus}
      suppressHydrationWarning
    >
      <video
        ref={videoRef}
        data-ambient-video="single"
        data-mobile-src={mobileSrc}
        className="ambient-video"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback"
        {...inlineAutoplayAttributes}
        aria-label={label}
        suppressHydrationWarning
        onLoadedMetadata={(event) => { void attemptPlay(event.currentTarget); }}
        onLoadedData={(event) => { void attemptPlay(event.currentTarget); }}
        onCanPlay={(event) => { void attemptPlay(event.currentTarget); }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <script dangerouslySetInnerHTML={{ __html: earlyAutoplayScript }} />
    </div>
  );
}
