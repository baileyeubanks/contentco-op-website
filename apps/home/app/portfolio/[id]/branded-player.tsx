"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./branded-player.module.css";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type FullscreenCapable = HTMLElement & { webkitRequestFullscreen?: () => void };
type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Minimal branded player: poster + play overlay until started, then a thin
 * control bar that shows on hover, keyboard focus, touch, or while paused.
 * Plain <video>, no dependencies. The video element is only mounted after the
 * first play, so the page loads just the poster.
 */
export function BrandedPlayer({
  src,
  poster,
  title,
}: {
  src: string;
  poster?: string;
  title: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [awake, setAwake] = useState(false);
  const [failed, setFailed] = useState(false);

  const wake = useCallback(() => {
    setAwake(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setAwake(false), 2500);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Autoplay once the video mounts after the first click.
  useEffect(() => {
    if (started) videoRef.current?.play().catch(() => setPlaying(false));
  }, [started]);

  const toggle = useCallback(() => {
    if (!started) {
      setStarted(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    wake();
  }, [started, wake]);

  const seek = (value: number) => {
    if (videoRef.current) videoRef.current.currentTime = value;
    setTime(value);
  };

  const toggleFullscreen = () => {
    const frame = frameRef.current as FullscreenCapable | null;
    const doc = document as FullscreenDoc;
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
    } else if (frame?.requestFullscreen) {
      frame.requestFullscreen().catch(() => {});
    } else if (frame?.webkitRequestFullscreen) {
      frame.webkitRequestFullscreen();
    } else {
      (videoRef.current as IosVideo | null)?.webkitEnterFullscreen?.();
    }
  };

  const barVisible = started && (!playing || awake);

  return (
    <div
      ref={frameRef}
      className={`${s.frame}${barVisible ? ` ${s.barVisible}` : ""}`}
      onPointerMove={started ? wake : undefined}
      onFocus={started ? wake : undefined}
    >
      {started ? (
        <video
          ref={videoRef}
          className={s.video}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          aria-label={title}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onError={() => setFailed(true)}
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={s.poster} src={poster} alt="" />
      ) : null}

      {!started ? (
        <button type="button" className={s.playOverlay} onClick={toggle} aria-label={`Play film: ${title}`}>
          <span className={s.playCircle} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="7 4 20 12 7 20 7 4" />
            </svg>
          </span>
        </button>
      ) : null}

      {failed ? <p className={s.error} role="alert">This film could not be loaded. Please try again shortly.</p> : null}

      {started ? (
        <div className={s.bar} role="group" aria-label="Video controls">
          <button type="button" className={s.btn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="7 4 20 12 7 20 7 4" />
              </svg>
            )}
          </button>
          <span className={s.time} aria-hidden="true">{formatTime(time)}</span>
          <input
            className={s.seek}
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          />
          <span className={s.time} aria-hidden="true">{formatTime(duration)}</span>
          <button
            type="button"
            className={s.btn}
            onClick={() => {
              if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              {muted ? (
                <>
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </>
              ) : (
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              )}
            </svg>
          </button>
          <button type="button" className={s.btn} onClick={toggleFullscreen} aria-label="Fullscreen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
      ) : null}

      <noscript>
        <video className={s.video} controls src={src} poster={poster} />
      </noscript>
    </div>
  );
}
