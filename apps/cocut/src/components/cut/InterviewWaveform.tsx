import { useEffect, useRef, useState, useCallback } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore, registerSeekCallback, registerPlayCallback } from '../../store/cutStore';
import { analyzeWaveform, type WaveformData } from '../../services/vadAnalyzer';
import { formatTime } from '../../utils/formatTime';

export function InterviewWaveform() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [loadingWaveform, setLoadingWaveform] = useState(false);

  const audioUrl = useCutStore((s) => s.audioUrl);
  const fileName = useCutStore((s) => s.fileName);
  const currentTime = useCutStore((s) => s.currentTime);
  const isPlaying = useCutStore((s) => s.isPlaying);
  const duration = useCutStore((s) => s.duration);
  const markers = useCutStore((s) => s.markers);

  const setCurrentTime = useCutStore((s) => s.setCurrentTime);
  const setIsPlaying = useCutStore((s) => s.setIsPlaying);
  const setDuration = useCutStore((s) => s.setDuration);
  const setMarkerIn = useCutStore((s) => s.setMarkerIn);
  const setMarkerOut = useCutStore((s) => s.setMarkerOut);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);
  const markers_in = markers.in;
  const markers_out = markers.out;

  // Register seek and play callbacks so cutStore can drive the audio element
  useEffect(() => {
    registerSeekCallback((t) => {
      if (audioRef.current) {
        audioRef.current.currentTime = t;
      }
    });
    registerPlayCallback((v) => {
      if (!audioRef.current) return;
      if (v) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    });
  }, []);

  // Load waveform data when audio URL changes
  useEffect(() => {
    if (!audioUrl) return;
    setWaveform(null);
    setLoadingWaveform(true);
    analyzeWaveform(audioUrl)
      .then((wf) => setWaveform(wf))
      .catch((e) => console.warn('Waveform analysis failed:', e))
      .finally(() => setLoadingWaveform(false));
  }, [audioUrl]);

  // Sync audio element play state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // requestAnimationFrame sync for currentTime
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      if (!audio.paused) {
        setCurrentTime(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [setCurrentTime]);

  // Draw waveform canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const midY = H / 2;

    ctx.clearRect(0, 0, W, H);

    // In/out range highlight
    if (markers_in !== null && markers_out !== null && duration > 0) {
      const x1 = (markers_in / duration) * W;
      const x2 = (markers_out / duration) * W;
      ctx.fillStyle = `${C.accent}28`;
      ctx.fillRect(x1, 0, x2 - x1, H);
    }

    // Waveform bars
    if (waveform && waveform.rms.length > 0) {
      const rms = waveform.rms;
      const playheadX = duration > 0 ? (currentTime / duration) * W : 0;

      for (let px = 0; px < W; px++) {
        const dataIdx = Math.floor((px / W) * rms.length);
        const val = Math.min(rms[dataIdx] * 8, 1);
        const barH = Math.max(1, val * midY * 0.85);

        // Color: played = bright, upcoming = dim
        const isPast = px < playheadX;
        ctx.fillStyle = isPast ? C.accent2 : C.border2;
        ctx.fillRect(px, midY - barH, 1, barH * 2);
      }
    } else if (!waveform) {
      // No waveform — draw flat placeholder line
      ctx.fillStyle = C.border2;
      ctx.fillRect(0, midY - 1, W, 2);
    }

    // In marker
    if (markers_in !== null && duration > 0) {
      const x = (markers_in / duration) * W;
      ctx.fillStyle = C.green;
      ctx.fillRect(x - 1, 0, 2, H);
      // Label
      ctx.fillStyle = C.green;
      ctx.font = '9px monospace';
      ctx.fillText('I', x + 3, 12);
    }

    // Out marker
    if (markers_out !== null && duration > 0) {
      const x = (markers_out / duration) * W;
      ctx.fillStyle = C.orange;
      ctx.fillRect(x - 1, 0, 2, H);
      ctx.fillStyle = C.orange;
      ctx.font = '9px monospace';
      ctx.fillText('O', x + 3, 12);
    }

    // Playhead
    if (duration > 0) {
      const px = (currentTime / duration) * W;
      ctx.fillStyle = C.text;
      ctx.fillRect(px - 1, 0, 2, H);
    }
  }, [waveform, currentTime, duration, markers_in, markers_out]);

  // Redraw on every relevant state change
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Re-draw on resize
  useEffect(() => {
    const obs = new ResizeObserver(() => drawWaveform());
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [drawWaveform]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const seekTime = ratio * duration;
    useCutStore.getState().seekToTime(seekTime);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleMarkIn = () => setMarkerIn(currentTime);
  const handleMarkOut = () => {
    setMarkerOut(currentTime);
    // Auto-open save modal if both markers are set
    if (markers_in !== null) {
      setTimeout(() => setShowSaveModal(true), 50);
    }
  };

  const clearMarkers = () => {
    setMarkerIn(null);
    setMarkerOut(null);
  };

  return (
    <div
      style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      {/* File name bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <Icon d={Icons.music} size={12} color={C.accent2} />
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT_FAMILY, flex: 1 }}>
          {fileName ?? 'untitled'}
        </span>
        {loadingWaveform && (
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_FAMILY }}>
            analyzing waveform...
          </span>
        )}
        {/* Current time / duration */}
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: FONT_FAMILY_MONO }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: 80,
          display: 'block',
          cursor: 'pointer',
        }}
      />

      {/* Transport controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {/* Play/Pause */}
        <Button small accent onClick={togglePlay}>
          <Icon d={isPlaying ? Icons.pause : Icons.play} size={12} />
          {isPlaying ? 'Pause' : 'Play'}
        </Button>

        <div style={{ width: 1, height: 18, background: C.border, margin: '0 2px' }} />

        {/* Marker controls */}
        <Button
          small
          onClick={handleMarkIn}
          title="Mark In point (I)"
          style={{ color: C.green }}
        >
          <Icon d={Icons.scissors} size={12} color={C.green} />
          Mark In
        </Button>
        <Button
          small
          onClick={handleMarkOut}
          title="Mark Out point (O)"
          style={{ color: C.orange }}
        >
          <Icon d={Icons.blade} size={12} color={C.orange} />
          Mark Out
        </Button>

        {/* Marker timestamps */}
        {(markers_in !== null || markers_out !== null) && (
          <span
            style={{
              fontSize: 10,
              color: C.textDim,
              fontFamily: FONT_FAMILY_MONO,
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {markers_in !== null ? formatTime(markers_in) : '–'}
            {' → '}
            {markers_out !== null ? formatTime(markers_out) : '–'}
          </span>
        )}

        {/* Save soundbite */}
        {markers_in !== null && markers_out !== null && (
          <Button small accent onClick={() => setShowSaveModal(true)} title="Save soundbite (Enter)">
            <Icon d={Icons.plus} size={12} />
            Save Clip
          </Button>
        )}

        {(markers_in !== null || markers_out !== null) && (
          <Button small onClick={clearMarkers} title="Clear markers">
            ✕ Clear
          </Button>
        )}

        <div style={{ flex: 1 }} />

        {/* Keyboard hints */}
        <span style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_FAMILY }}>
          Space play/pause · I mark in · O mark out · Enter save · ⌘E export
        </span>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
    </div>
  );
}
