import { useEffect, useRef, useCallback } from 'react';
import { usePlaybackStore } from '../store/playbackStore';
import { useElementStore } from '../store/elementStore';

const videoRefs = new Map<string, HTMLVideoElement>();

export function registerVideo(elementId: string, video: HTMLVideoElement) {
  videoRefs.set(elementId, video);
}

export function unregisterVideo(elementId: string) {
  videoRefs.delete(elementId);
}

function syncVideos(currentTime: number, isPlaying: boolean) {
  const elements = useElementStore.getState().elements;
  videoRefs.forEach((video, elId) => {
    const el = elements.find((e) => e.id === elId);
    if (!el || el.type !== 'video') return;

    const isInTime = currentTime >= el.startTime && currentTime < el.startTime + el.duration;
    if (!isInTime) {
      if (!video.paused) video.pause();
      return;
    }

    // Calculate where in the source video we should be
    const elapsedInClip = currentTime - el.startTime;
    const sourceTime = el.trimIn + elapsedInClip * (el.playbackRate || 1);

    // Sync position (only if drifted more than 0.15s)
    if (Math.abs(video.currentTime - sourceTime) > 0.15) {
      video.currentTime = sourceTime;
    }

    // Sync play state
    if (isPlaying && video.paused) {
      video.playbackRate = el.playbackRate || 1;
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }

    // Sync volume
    video.volume = el.muted ? 0 : el.volume;
  });
}

export function usePlayback() {
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const duration = usePlaybackStore((s) => s.duration);
  const loopEnabled = usePlaybackStore((s) => s.loopEnabled);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const pause = usePlaybackStore((s) => s.pause);

  // Main rAF playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = null;
      // Pause all videos
      syncVideos(usePlaybackStore.getState().currentTime, false);
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = ((timestamp - lastTimeRef.current) / 1000) * playbackRate;
      lastTimeRef.current = timestamp;

      const currentTime = usePlaybackStore.getState().currentTime;
      const next = currentTime + delta;

      if (next >= duration) {
        if (loopEnabled) {
          setCurrentTime(0);
          syncVideos(0, true);
        } else {
          setCurrentTime(duration);
          syncVideos(duration, false);
          pause();
          return;
        }
      } else {
        setCurrentTime(next);
        syncVideos(next, true);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    // Sync videos on play start
    syncVideos(usePlaybackStore.getState().currentTime, true);
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playbackRate, duration, loopEnabled, setCurrentTime, pause]);

  // Sync videos on seek (when not playing)
  const handleSeek = useCallback(() => {
    if (!usePlaybackStore.getState().isPlaying) {
      syncVideos(usePlaybackStore.getState().currentTime, false);
    }
  }, []);

  useEffect(() => {
    let prevTime = usePlaybackStore.getState().currentTime;
    return usePlaybackStore.subscribe((state) => {
      if (state.currentTime !== prevTime) {
        prevTime = state.currentTime;
        handleSeek();
      }
    });
  }, [handleSeek]);
}
