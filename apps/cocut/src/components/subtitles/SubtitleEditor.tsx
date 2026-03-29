import { useState, useRef } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { NumberInput } from '../ui/NumberInput';
import { ColorInput } from '../ui/ColorInput';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
// uiStore available for panel state
import { createSubtitleElement } from '../../utils/elementFactory';
import { uid } from '../../utils/uid';
import {
  parseSubtitles,
  generateSRT,
  generateVTT,
  whisperToCues,
} from '../../services/subtitleParser';
import {
  transcribe,
  type TranscriptionProgress,
} from '../../services/whisperService';
import type { SubtitleElement, SubtitleCue, Element } from '../../types';
import { formatTime } from '../../utils/formatTime';

export function SubtitleEditor() {
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const updateElement = useElementStore((s) => s.updateElement);
  const addElement = useElementStore((s) => s.addElement);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);

  const [transcribeProgress, setTranscribeProgress] = useState<TranscriptionProgress | null>(null);
  const [editingCueId, setEditingCueId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Find subtitle element - either selected or first subtitle
  const subtitleEl = elements.find(
    (e) => e.type === 'subtitle' && selectedIds.has(e.id),
  ) as SubtitleElement | undefined;

  const anySubtitle = elements.find((e) => e.type === 'subtitle') as SubtitleElement | undefined;
  const active = subtitleEl || anySubtitle;

  // Find first video element for transcription source
  const videoEl = elements.find((e) => e.type === 'video' && (e as any).src);

  const isTranscribing =
    transcribeProgress !== null &&
    transcribeProgress.phase !== 'done' &&
    transcribeProgress.phase !== 'error';

  const handleTranscribe = async () => {
    if (!videoEl) return;
    const src = (videoEl as any).src;
    if (!src) return;

    abortRef.current = new AbortController();

    try {
      const result = await transcribe(src, setTranscribeProgress, abortRef.current.signal);

      if (result.words.length > 0) {
        const cues = whisperToCues(result.words);
        if (active) {
          updateElement(active.id, { cues } as Partial<Element>);
        } else {
          const el = createSubtitleElement(cues, {
            duration: result.duration,
          });
          addElement(el);
        }
      }
    } catch (err: any) {
      if (err.message !== 'Transcription cancelled') {
        setTranscribeProgress({
          phase: 'error',
          percent: 0,
          message: err.message,
        });
      }
    }
  };

  const handleImportSRT = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const cues = parseSubtitles(text);

      if (active) {
        updateElement(active.id, { cues } as Partial<Element>);
      } else {
        const el = createSubtitleElement(cues);
        addElement(el);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportSRT = () => {
    if (!active) return;
    const srt = generateSRT(active.cues);
    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportVTT = () => {
    if (!active) return;
    const vtt = generateVTT(active.cues);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.vtt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddCue = () => {
    if (!active) {
      const el = createSubtitleElement([
        { id: uid(), startTime: currentTime, endTime: currentTime + 3, text: 'New subtitle' },
      ]);
      addElement(el);
      return;
    }

    const newCue: SubtitleCue = {
      id: uid(),
      startTime: currentTime,
      endTime: currentTime + 3,
      text: 'New subtitle',
    };
    const cues = [...active.cues, newCue].sort((a, b) => a.startTime - b.startTime);
    updateElement(active.id, { cues } as Partial<Element>);
    setEditingCueId(newCue.id);
  };

  const handleUpdateCue = (cueId: string, patch: Partial<SubtitleCue>) => {
    if (!active) return;
    const cues = active.cues.map((c) => (c.id === cueId ? { ...c, ...patch } : c));
    updateElement(active.id, { cues } as Partial<Element>);
  };

  const handleDeleteCue = (cueId: string) => {
    if (!active) return;
    const cues = active.cues.filter((c) => c.id !== cueId);
    updateElement(active.id, { cues } as Partial<Element>);
  };

  const handleMergeCues = (cueId: string) => {
    if (!active) return;
    const idx = active.cues.findIndex((c) => c.id === cueId);
    if (idx < 0 || idx >= active.cues.length - 1) return;

    const current = active.cues[idx];
    const next = active.cues[idx + 1];
    const merged: SubtitleCue = {
      id: current.id,
      startTime: current.startTime,
      endTime: next.endTime,
      text: current.text + ' ' + next.text,
    };

    const cues = active.cues.filter((c) => c.id !== next.id).map((c) => (c.id === current.id ? merged : c));
    updateElement(active.id, { cues } as Partial<Element>);
  };

  const handleSplitCue = (cueId: string) => {
    if (!active) return;
    const cue = active.cues.find((c) => c.id === cueId);
    if (!cue) return;

    const midTime = (cue.startTime + cue.endTime) / 2;
    const words = cue.text.split(' ');
    const midWord = Math.ceil(words.length / 2);

    const first: SubtitleCue = {
      id: cue.id,
      startTime: cue.startTime,
      endTime: midTime,
      text: words.slice(0, midWord).join(' '),
    };
    const second: SubtitleCue = {
      id: uid(),
      startTime: midTime,
      endTime: cue.endTime,
      text: words.slice(midWord).join(' '),
    };

    const idx = active.cues.findIndex((c) => c.id === cueId);
    const cues = [...active.cues];
    cues.splice(idx, 1, first, second);
    updateElement(active.id, { cues } as Partial<Element>);
  };

  // Find the active cue at current time
  const activeCue = active?.cues.find(
    (c) => currentTime >= c.startTime && currentTime <= c.endTime,
  );

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
        <Icon d={Icons.text} size={14} color={C.accent} />
        <span
          style={{
            fontFamily: FONT_FAMILY_BRAND,
            fontSize: 12,
            fontWeight: 600,
            flex: 1,
          }}
        >
          Subtitles
        </span>
        <Button small onClick={handleAddCue}>
          + Cue
        </Button>
      </div>

      <div style={{ padding: '10px 14px' }}>
        {/* Transcribe + Import */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <Button
            small
            accent={!!videoEl}
            onClick={handleTranscribe}
            style={{
              flex: 1,
              opacity: videoEl ? 1 : 0.4,
              cursor: videoEl ? 'pointer' : 'not-allowed',
            }}
          >
            <Icon d={Icons.wand} size={11} />
            {isTranscribing ? 'Transcribing...' : 'Transcribe'}
          </Button>
          <Button small onClick={handleImportSRT}>
            <Icon d={Icons.upload} size={11} /> Import
          </Button>
          {active && active.cues.length > 0 && (
            <>
              <Button small onClick={handleExportSRT}>
                SRT
              </Button>
              <Button small onClick={handleExportVTT}>
                VTT
              </Button>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Transcription progress */}
        {isTranscribing && transcribeProgress && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>
              {transcribeProgress.message}
            </div>
            <div
              style={{
                height: 4,
                background: C.surface3,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${transcribeProgress.percent}%`,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )}

        {/* Style controls (when subtitle element exists) */}
        {active && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Style
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <NumberInput
                label="Size"
                value={active.fontSize}
                onChange={(v) => updateElement(active.id, { fontSize: v } as Partial<Element>)}
                min={12}
                max={120}
                unit="px"
              />
              <ColorInput
                value={active.color}
                onChange={(v) => updateElement(active.id, { color: v } as Partial<Element>)}
              />
              <Select
                value={active.position}
                onChange={(v) =>
                  updateElement(active.id, { position: v } as Partial<Element>)
                }
                options={[
                  { label: 'Bottom', value: 'bottom' },
                  { label: 'Center', value: 'center' },
                  { label: 'Top', value: 'top' },
                ]}
              />
            </div>
          </div>
        )}

        {/* Active cue highlight */}
        {activeCue && (
          <div
            style={{
              background: `${C.accent}15`,
              border: `1px solid ${C.accent}33`,
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 10,
              fontSize: 13,
              color: C.text,
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            {activeCue.text}
          </div>
        )}

        {/* Cue list */}
        {active && active.cues.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {active.cues.map((cue) => (
              <div
                key={cue.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  padding: '6px 8px',
                  marginBottom: 2,
                  borderRadius: 4,
                  background:
                    cue.id === activeCue?.id
                      ? `${C.accent}15`
                      : cue.id === editingCueId
                        ? C.surface2
                        : 'transparent',
                  cursor: 'pointer',
                  border: `1px solid ${cue.id === activeCue?.id ? C.accent + '33' : 'transparent'}`,
                }}
                onClick={() => setCurrentTime(cue.startTime)}
              >
                {/* Timestamp */}
                <div style={{ minWidth: 80, flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: FONT_FAMILY_MONO,
                      color: C.accent2,
                    }}
                  >
                    {formatTime(cue.startTime)}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontFamily: FONT_FAMILY_MONO,
                      color: C.textMuted,
                    }}
                  >
                    {formatTime(cue.endTime)}
                  </div>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingCueId === cue.id ? (
                    <textarea
                      autoFocus
                      value={cue.text}
                      onChange={(e) => handleUpdateCue(cue.id, { text: e.target.value })}
                      onBlur={() => setEditingCueId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          setEditingCueId(null);
                        }
                      }}
                      rows={2}
                      style={{
                        width: '100%',
                        background: C.surface3,
                        color: C.text,
                        border: `1px solid ${C.accent}44`,
                        borderRadius: 3,
                        padding: 4,
                        fontSize: 10,
                        fontFamily: FONT_FAMILY,
                        resize: 'none',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: 10,
                        color: C.text,
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCueId(cue.id);
                      }}
                    >
                      {cue.text}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textMuted,
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSplitCue(cue.id);
                    }}
                    title="Split cue"
                  >
                    ✂
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textMuted,
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMergeCues(cue.id);
                    }}
                    title="Merge with next"
                  >
                    ⊕
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.red,
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCue(cue.id);
                    }}
                    title="Delete cue"
                  >
                    ✕
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {(!active || active.cues.length === 0) && !isTranscribing && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px 0',
              color: C.textDim,
              fontSize: 10,
            }}
          >
            <div style={{ marginBottom: 6 }}>No subtitles yet</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>
              Import SRT/VTT, add cues manually,
              <br />
              or transcribe from a video clip
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
