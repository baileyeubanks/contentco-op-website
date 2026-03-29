import { useState, useRef } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useUIStore } from '../../store/uiStore';
import { usePlaybackStore } from '../../store/playbackStore';
import {
  exportProject,
  downloadBlob,
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  type ExportProgress,
} from '../../services/exportPipeline';
import { formatTime } from '../../utils/formatTime';

interface ExportPreset {
  label: string;
  description: string;
  settings: Partial<ExportSettings>;
}

const EXPORT_PRESETS: ExportPreset[] = [
  {
    label: 'YouTube',
    description: '1080p H.264 High Quality',
    settings: { width: 1920, height: 1080, fps: 30, videoBitrate: '10M', audioBitrate: '192k', format: 'mp4' },
  },
  {
    label: 'YouTube 4K',
    description: '2160p H.264 Ultra',
    settings: { width: 3840, height: 2160, fps: 30, videoBitrate: '20M', audioBitrate: '192k', format: 'mp4' },
  },
  {
    label: 'TikTok / Reels',
    description: '1080×1920 Vertical H.264',
    settings: { width: 1080, height: 1920, fps: 30, videoBitrate: '5M', audioBitrate: '128k', format: 'mp4' },
  },
  {
    label: 'Instagram Feed',
    description: '1080×1080 Square H.264',
    settings: { width: 1080, height: 1080, fps: 30, videoBitrate: '5M', audioBitrate: '128k', format: 'mp4' },
  },
  {
    label: 'Instagram Feed (4:5)',
    description: '1080×1350 H.264',
    settings: { width: 1080, height: 1350, fps: 30, videoBitrate: '5M', audioBitrate: '128k', format: 'mp4' },
  },
  {
    label: 'X / Twitter',
    description: '1280×720 Fast Upload',
    settings: { width: 1280, height: 720, fps: 30, videoBitrate: '5M', audioBitrate: '128k', format: 'mp4' },
  },
  {
    label: 'LinkedIn',
    description: '1920×1080 Professional',
    settings: { width: 1920, height: 1080, fps: 30, videoBitrate: '10M', audioBitrate: '192k', format: 'mp4' },
  },
  {
    label: 'Web / WebM',
    description: '1080p VP9 Optimized',
    settings: { width: 1920, height: 1080, fps: 30, videoBitrate: '5M', audioBitrate: '128k', format: 'webm' },
  },
];

export function ExportDialog() {
  const exportDialogOpen = useUIStore((s) => s.exportDialogOpen);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const canvasWidth = useUIStore((s) => s.canvasWidth);
  const canvasHeight = useUIStore((s) => s.canvasHeight);
  const duration = usePlaybackStore((s) => s.duration);

  const [settings, setSettings] = useState<ExportSettings>({
    ...DEFAULT_EXPORT_SETTINGS,
    width: canvasWidth,
    height: canvasHeight,
  });
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!exportDialogOpen) return null;

  const isExporting = progress !== null && progress.phase !== 'done' && progress.phase !== 'error';

  const handleExport = async () => {
    setError(null);
    abortRef.current = new AbortController();
    try {
      const blob = await exportProject(settings, setProgress, abortRef.current.signal);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadBlob(blob, `coedit-export-${timestamp}.${settings.format}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      if (message === 'Export cancelled') {
        setProgress(null);
      } else {
        setError(message);
        setProgress({ phase: 'error', percent: 0, currentFrame: 0, totalFrames: 0, message });
      }
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setProgress(null);
  };

  const handleClose = () => {
    if (!isExporting) {
      setExportDialogOpen(false);
      setProgress(null);
      setError(null);
    }
  };

  const applyPreset = (preset: ExportPreset) => {
    setSettings((s) => ({ ...s, ...preset.settings }));
    setActivePreset(preset.label);
  };

  const totalFrames = Math.ceil(duration * settings.fps);
  const bitrateNum = parseFloat(settings.videoBitrate) * (settings.videoBitrate.endsWith('M') ? 1 : 0.001);
  const estFileSizeMB = ((bitrateNum * duration) / 8).toFixed(1);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 5000, fontFamily: FONT_FAMILY,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: 520, maxHeight: '85vh',
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 18px',
          borderBottom: `1px solid ${C.border}`, gap: 8,
        }}>
          <Icon d={Icons.download} size={16} color={C.accent} />
          <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 14, fontWeight: 600, flex: 1 }}>
            Export Video
          </span>
          <span style={{ fontSize: 16, color: C.textDim, cursor: 'pointer', lineHeight: 1 }} onClick={handleClose}>
            ✕
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>
          {!isExporting && progress?.phase !== 'done' && (
            <>
              {/* Platform Presets */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                  Platform Presets
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EXPORT_PRESETS.map((p) => (
                    <div
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${activePreset === p.label ? C.accent : C.border}`,
                        background: activePreset === p.label ? `${C.accent}15` : 'transparent',
                        fontSize: 10, color: activePreset === p.label ? C.accent2 : C.text,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{p.label}</div>
                      <div style={{ fontSize: 8, color: C.textDim, marginTop: 1 }}>{p.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>
                  Resolution
                </label>
                <Select
                  value={`${settings.width}x${settings.height}`}
                  onChange={(v) => {
                    const [w, h] = v.split('x').map(Number);
                    setSettings((s) => ({ ...s, width: w, height: h }));
                    setActivePreset(null);
                  }}
                  options={[
                    { label: '3840 × 2160 (4K UHD)', value: '3840x2160' },
                    { label: '1920 × 1080 (Full HD)', value: '1920x1080' },
                    { label: '1280 × 720 (HD)', value: '1280x720' },
                    { label: '1080 × 1920 (Vertical)', value: '1080x1920' },
                    { label: '1080 × 1350 (4:5)', value: '1080x1350' },
                    { label: '1080 × 1080 (Square)', value: '1080x1080' },
                    { label: `${canvasWidth} × ${canvasHeight} (Canvas)`, value: `${canvasWidth}x${canvasHeight}` },
                  ]}
                  style={{ width: '100%' }}
                />
              </div>

              {/* FPS + Quality + Format */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>Frame Rate</label>
                  <Select
                    value={String(settings.fps)}
                    onChange={(v) => { setSettings((s) => ({ ...s, fps: Number(v) })); setActivePreset(null); }}
                    options={[
                      { label: '24 fps (Film)', value: '24' },
                      { label: '30 fps (Standard)', value: '30' },
                      { label: '60 fps (Smooth)', value: '60' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>Quality</label>
                  <Select
                    value={settings.videoBitrate}
                    onChange={(v) => { setSettings((s) => ({ ...s, videoBitrate: v })); setActivePreset(null); }}
                    options={[
                      { label: 'Draft (2 Mbps)', value: '2M' },
                      { label: 'Standard (5 Mbps)', value: '5M' },
                      { label: 'High (10 Mbps)', value: '10M' },
                      { label: 'Ultra (20 Mbps)', value: '20M' },
                      { label: 'Max (35 Mbps)', value: '35M' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: C.textDim, display: 'block', marginBottom: 4 }}>Codec</label>
                  <Select
                    value={settings.format}
                    onChange={(v) => { setSettings((s) => ({ ...s, format: v as 'mp4' | 'webm' })); setActivePreset(null); }}
                    options={[
                      { label: 'H.264 / MP4', value: 'mp4' },
                      { label: 'VP9 / WebM', value: 'webm' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div style={{
                background: C.surface2, borderRadius: 6, padding: '10px 12px',
                marginBottom: 16, border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Duration</span>
                  <span style={{ fontSize: 10, color: C.text, fontFamily: FONT_FAMILY_MONO }}>{formatTime(duration)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Total Frames</span>
                  <span style={{ fontSize: 10, color: C.text, fontFamily: FONT_FAMILY_MONO }}>{totalFrames.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Output</span>
                  <span style={{ fontSize: 10, color: C.text, fontFamily: FONT_FAMILY_MONO }}>
                    {settings.width}×{settings.height} @ {settings.fps}fps
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Est. File Size</span>
                  <span style={{ fontSize: 10, color: C.accent2, fontFamily: FONT_FAMILY_MONO }}>~{estFileSizeMB} MB</span>
                </div>
              </div>

              {error && (
                <div style={{ background: '#2d1111', border: `1px solid ${C.red}44`, borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 10, color: C.red }}>
                  {error}
                </div>
              )}

              <Button
                onClick={handleExport}
                style={{
                  width: '100%', padding: '10px 0',
                  background: C.accent, color: '#fff',
                  fontWeight: 600, fontSize: 12, border: 'none', borderRadius: 6,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Icon d={Icons.download} size={14} color="#fff" />
                Export {settings.format.toUpperCase()}
              </Button>
            </>
          )}

          {/* Progress */}
          {isExporting && progress && (
            <div>
              <div style={{ fontSize: 11, color: C.text, marginBottom: 8, fontWeight: 500 }}>{progress.message}</div>
              <div style={{ height: 6, background: C.surface3, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  height: '100%', width: `${progress.percent}%`,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                  borderRadius: 3, transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: C.textDim }}>
                  {progress.phase === 'loading' && 'Loading FFmpeg...'}
                  {progress.phase === 'rendering' && `Frame ${progress.currentFrame} / ${progress.totalFrames}`}
                  {progress.phase === 'encoding' && 'Encoding...'}
                  {progress.phase === 'muxing' && 'Muxing audio...'}
                </span>
                <span style={{ fontSize: 10, color: C.accent2, fontFamily: FONT_FAMILY_MONO }}>{progress.percent}%</span>
              </div>
              <Button
                onClick={handleCancel}
                style={{
                  width: '100%', padding: '8px 0', background: 'transparent', color: C.red,
                  border: `1px solid ${C.red}44`, borderRadius: 6, cursor: 'pointer', fontSize: 11,
                }}
              >
                Cancel Export
              </Button>
            </div>
          )}

          {/* Done */}
          {progress?.phase === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><Icon d={Icons.download} size={32} color={C.green} /></div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>Export Complete</div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 16 }}>Your video has been downloaded.</div>
              <Button onClick={handleClose} style={{
                padding: '8px 24px', background: C.accent, color: '#fff', border: 'none',
                borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
