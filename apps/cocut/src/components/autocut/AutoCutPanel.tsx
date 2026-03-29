import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { useElementStore } from '../../store/elementStore';
// playbackStore available for future seek-to-region
import { uid } from '../../utils/uid';
import {
  analyzeWaveform,
  detectRegions,
  applyPadding,
  getRegionStats,
  DEFAULT_AUTOCUT_SETTINGS,
  type AutoCutSettings,
  type SpeechRegion,
  type WaveformData,
} from '../../services/vadAnalyzer';
import type { Element, VideoElement } from '../../types';
import { formatTime } from '../../utils/formatTime';

export function AutoCutPanel() {
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const deleteElements = useElementStore((s) => s.deleteElements);
  const addElement = useElementStore((s) => s.addElement);

  const [settings, setSettings] = useState<AutoCutSettings>({ ...DEFAULT_AUTOCUT_SETTINGS });
  const [regions, setRegions] = useState<SpeechRegion[] | null>(null);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [applied, setApplied] = useState(false);

  // Find selected video/audio element
  const selectedEl = elements.find(
    (e) => selectedIds.has(e.id) && (e.type === 'video' || e.type === 'audio'),
  );
  const src = selectedEl ? (selectedEl as any).src : null;

  const handleAnalyze = async () => {
    if (!src || !selectedEl) return;

    setAnalyzing(true);
    setProgress(0);
    setRegions(null);
    setApplied(false);

    try {
      const wf = await analyzeWaveform(src, setProgress);
      setWaveform(wf);

      const rawRegions = detectRegions(wf, settings);
      const paddedRegions = applyPadding(rawRegions, settings, wf.duration);
      setRegions(paddedRegions);
    } catch (err: any) {
      console.error('Auto-cut analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!regions || !selectedEl) return;

    // Get speech regions only
    const speechRegions = regions.filter((r) => r.type === 'speech');
    if (speechRegions.length === 0) return;

    // Strategy: Create new clip elements for each speech region
    // This preserves the original element as a "source" pattern
    const origEl = selectedEl as VideoElement;

    // Delete original
    deleteElements([origEl.id]);

    // Create a new element for each speech segment
    let timeOffset = origEl.startTime;

    for (const region of speechRegions) {
      const regionDuration = region.end - region.start;

      const newEl: VideoElement = {
        ...origEl,
        id: uid(),
        name: `${origEl.name} [${formatTime(region.start)}]`,
        startTime: timeOffset,
        duration: regionDuration,
        trimIn: (origEl.trimIn || 0) + region.start,
        trimOut: (origEl.trimIn || 0) + region.end,
      };

      addElement(newEl as Element);
      timeOffset += regionDuration;
    }

    setApplied(true);
  };

  const stats = regions ? getRegionStats(regions) : null;

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: `1px solid ${C.border}`,
          gap: 8,
        }}
      >
        <Icon d={Icons.wand} size={14} color={C.accent} />
        <span
          style={{
            fontFamily: FONT_FAMILY_BRAND,
            fontSize: 12,
            fontWeight: 600,
            flex: 1,
          }}
        >
          Auto-Cut
        </span>
      </div>

      <div style={{ padding: '10px 14px' }}>
        {/* No selection */}
        {!selectedEl && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px 0',
              color: C.textDim,
              fontSize: 10,
            }}
          >
            Select a video or audio clip to analyze
          </div>
        )}

        {/* Has selection */}
        {selectedEl && (
          <>
            {/* Settings */}
            {!regions && !analyzing && (
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: C.textDim,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Settings
                </div>

                <div style={{ marginBottom: 8 }}>
                  <NumberInput
                    label="Min Silence"
                    value={settings.minSilenceDuration}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, minSilenceDuration: v }))
                    }
                    min={100}
                    max={3000}
                    step={50}
                    unit="ms"
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <NumberInput
                    label="Pad Before"
                    value={settings.paddingBefore}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, paddingBefore: v }))
                    }
                    min={0}
                    max={500}
                    step={10}
                    unit="ms"
                  />
                  <NumberInput
                    label="Pad After"
                    value={settings.paddingAfter}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, paddingAfter: v }))
                    }
                    min={0}
                    max={500}
                    step={10}
                    unit="ms"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <NumberInput
                    label="Threshold"
                    value={settings.thresholdDb}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, thresholdDb: v }))
                    }
                    min={-60}
                    max={-10}
                    step={1}
                    unit="dB"
                  />
                </div>

                <Button
                  small
                  accent
                  onClick={handleAnalyze}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Icon d={Icons.wand} size={12} /> Analyze Audio
                </Button>
              </div>
            )}

            {/* Progress */}
            {analyzing && (
              <div>
                <div
                  style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}
                >
                  Analyzing audio...
                </div>
                <div
                  style={{
                    height: 4,
                    background: C.surface3,
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                      borderRadius: 2,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: C.accent2,
                    fontFamily: FONT_FAMILY_MONO,
                    textAlign: 'center',
                  }}
                >
                  {progress}%
                </div>
              </div>
            )}

            {/* Results */}
            {regions && stats && !applied && (
              <div>
                {/* Waveform visualization with markers */}
                <div
                  style={{
                    height: 60,
                    background: C.surface2,
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    marginBottom: 10,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {regions.map((region, i) => {
                    const totalDur = waveform?.duration || 1;
                    const left = (region.start / totalDur) * 100;
                    const width = ((region.end - region.start) / totalDur) * 100;

                    return (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 0,
                          bottom: 0,
                          background:
                            region.type === 'speech'
                              ? `${C.green}30`
                              : `${C.red}20`,
                          borderLeft:
                            i > 0
                              ? `1px solid ${region.type === 'speech' ? C.green : C.red}44`
                              : 'none',
                        }}
                      />
                    );
                  })}

                  {/* Waveform overlay */}
                  {waveform && (
                    <canvas
                      ref={(canvas) => {
                        if (!canvas || !waveform) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;

                        canvas.width = canvas.offsetWidth * 2;
                        canvas.height = canvas.offsetHeight * 2;

                        const w = canvas.width;
                        const h = canvas.height;
                        ctx.clearRect(0, 0, w, h);

                        // Draw waveform
                        ctx.strokeStyle = C.accent2;
                        ctx.lineWidth = 1;
                        ctx.beginPath();

                        for (let x = 0; x < w; x++) {
                          const dataIdx = Math.floor((x / w) * waveform.rms.length);
                          const val = Math.min(waveform.rms[dataIdx] * 10, 1);
                          const barH = val * h * 0.8;
                          ctx.moveTo(x, h / 2 - barH / 2);
                          ctx.lineTo(x, h / 2 + barH / 2);
                        }

                        ctx.stroke();
                      }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                      }}
                    />
                  )}

                  {/* Legend */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 6,
                      display: 'flex',
                      gap: 8,
                      fontSize: 8,
                    }}
                  >
                    <span style={{ color: C.green }}>Speech</span>
                    <span style={{ color: C.red }}>Silence</span>
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    background: C.surface2,
                    borderRadius: 6,
                    padding: '8px 10px',
                    border: `1px solid ${C.border}`,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontSize: 9, color: C.textDim }}>
                      Speech segments
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: C.green,
                        fontFamily: FONT_FAMILY_MONO,
                      }}
                    >
                      {stats.speechCount} ({formatTime(stats.speechDuration)})
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontSize: 9, color: C.textDim }}>
                      Silence to remove
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: C.red,
                        fontFamily: FONT_FAMILY_MONO,
                      }}
                    >
                      {stats.silenceCount} ({formatTime(stats.silenceDuration)})
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 9, color: C.textDim }}>
                      Time saved
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: C.accent2,
                        fontFamily: FONT_FAMILY_MONO,
                        fontWeight: 600,
                      }}
                    >
                      {stats.removedPercent}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    small
                    accent
                    onClick={handleApply}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Icon d={Icons.wand} size={12} /> Apply Auto-Cut
                  </Button>
                  <Button
                    small
                    onClick={() => {
                      setRegions(null);
                      setWaveform(null);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}

            {/* Applied success */}
            {applied && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <Icon d={Icons.wand} size={24} color={C.green} />
                <div
                  style={{
                    fontSize: 11,
                    color: C.text,
                    fontWeight: 600,
                    marginTop: 6,
                    marginBottom: 4,
                  }}
                >
                  Auto-Cut Applied
                </div>
                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8 }}>
                  {stats?.silenceCount} silence segments removed.
                  <br />
                  Use Ctrl+Z to undo.
                </div>
                <Button
                  small
                  onClick={() => {
                    setRegions(null);
                    setWaveform(null);
                    setApplied(false);
                  }}
                >
                  Analyze Again
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
