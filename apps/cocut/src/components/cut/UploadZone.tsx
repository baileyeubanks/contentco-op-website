import { useRef, useState, useCallback } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { useCutStore } from '../../store/cutStore';
import { transcribeViaAPI } from '../../services/whisperService';

const ACCEPTED_TYPES = [
  'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/wave', 'audio/webm', 'audio/ogg',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
];

export function UploadZone() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setAudio = useCutStore((s) => s.setAudio);
  const setTranscribing = useCutStore((s) => s.setTranscribing);
  const setTranscript = useCutStore((s) => s.setTranscript);
  const transcribing = useCutStore((s) => s.transcribing);
  const transcribeProgress = useCutStore((s) => s.transcribeProgress);
  const transcribePhase = useCutStore((s) => s.transcribePhase);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|mp4|m4a|wav|webm|ogg|mov)$/i)) {
        setError('Unsupported file type. Please upload an audio or video file.');
        return;
      }

      const url = URL.createObjectURL(file);
      setAudio(url, file.name);

      const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        // No API key — load file but skip transcription
        setTranscript(null);
        return;
      }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setTranscribing(true, 0, 'Starting...');

      try {
        const result = await transcribeViaAPI(
          url,
          (p) => setTranscribing(true, p.percent, p.message),
          ctrl.signal,
        );
        setTranscript(result);
      } catch (err: any) {
        if (err.message === 'Transcription cancelled') return;
        setError(err.message ?? 'Transcription failed');
      } finally {
        setTranscribing(false);
      }
    },
    [setAudio, setTranscribing, setTranscript],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.bg,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !transcribing && fileInputRef.current?.click()}
        style={{
          width: 480,
          height: 260,
          border: `2px dashed ${dragging ? C.accent : C.border2}`,
          borderRadius: 16,
          background: dragging ? `${C.accent}10` : C.surface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          cursor: transcribing ? 'default' : 'pointer',
          transition: 'all 0.15s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Transcription progress overlay */}
        {transcribing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `${C.bg}e0`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: FONT_FAMILY_BRAND,
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
              }}
            >
              Transcribing...
            </div>
            <div
              style={{
                width: 220,
                height: 3,
                background: C.surface3,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${transcribeProgress}%`,
                  background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: C.textDim }}>{transcribePhase}</div>
          </div>
        )}

        {/* Drop icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={Icons.upload} size={24} color={C.accent2} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONT_FAMILY_BRAND,
              fontSize: 15,
              fontWeight: 700,
              color: C.text,
              marginBottom: 6,
            }}
          >
            drop your interview here
          </div>
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
            audio or video · mp3, mp4, m4a, wav, webm
            <br />
            <span style={{ color: C.textMuted }}>up to 25MB for auto-transcription</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: C.accent2,
            fontWeight: 500,
            letterSpacing: 0.3,
          }}
        >
          click to browse
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '8px 14px',
            background: `${C.error}18`,
            border: `1px solid ${C.error}44`,
            borderRadius: 8,
            fontSize: 11,
            color: C.error,
            maxWidth: 480,
          }}
        >
          {error}
        </div>
      )}

      {/* No API key hint */}
      {!(import.meta as any).env?.VITE_OPENAI_API_KEY && (
        <div
          style={{
            marginTop: 12,
            fontSize: 10,
            color: C.textMuted,
            textAlign: 'center',
          }}
        >
          Add <code style={{ color: C.accent2 }}>VITE_OPENAI_API_KEY</code> to .env for auto-transcription
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.mov"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  );
}
