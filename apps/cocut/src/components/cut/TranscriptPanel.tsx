import { useEffect, useRef } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY } from '../../theme/tokens';
import { useCutStore } from '../../store/cutStore';
import type { WhisperWord } from '../../services/whisperService';

export function TranscriptPanel() {
  const transcript = useCutStore((s) => s.transcript);
  const currentTime = useCutStore((s) => s.currentTime);
  const transcribing = useCutStore((s) => s.transcribing);
  const transcribeProgress = useCutStore((s) => s.transcribeProgress);
  const transcribePhase = useCutStore((s) => s.transcribePhase);
  const markers = useCutStore((s) => s.markers);
  const seekToTime = useCutStore((s) => s.seekToTime);

  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const words: WhisperWord[] = transcript?.words ?? [];

  // Find the current active word index
  const activeIdx = words.findIndex((w) => currentTime >= w.start && currentTime < w.end);

  // Auto-scroll to keep active word visible
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const word = activeWordRef.current;
      const wordTop = word.offsetTop;
      const scrollTop = container.scrollTop;
      const containerH = container.clientHeight;

      const threshold = containerH * 0.6;
      if (wordTop - scrollTop > threshold) {
        container.scrollTo({ top: wordTop - containerH / 2, behavior: 'smooth' });
      }
    }
  }, [activeIdx]);

  const isInRange = (word: WhisperWord) => {
    const { in: inPt, out: outPt } = markers;
    if (inPt === null || outPt === null) return false;
    return word.start >= inPt && word.end <= outPt;
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: C.textDim,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase' as const,
            fontFamily: FONT_FAMILY,
          }}
        >
          Transcript
        </span>
        {transcript && (
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_FAMILY, marginLeft: 'auto' }}>
            {words.length} words
          </span>
        )}
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Transcribing state */}
        {transcribing && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>
              {transcribePhase || 'Transcribing...'}
            </div>
            <div
              style={{
                width: '80%',
                margin: '0 auto',
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
          </div>
        )}

        {/* No transcript yet */}
        {!transcribing && !transcript && (
          <div
            style={{
              textAlign: 'center',
              paddingTop: 60,
              fontSize: 11,
              color: C.textMuted,
              lineHeight: 1.8,
            }}
          >
            Transcript will appear here after transcription.
            <br />
            <span style={{ fontSize: 10 }}>
              Add <code style={{ color: C.accent2 }}>VITE_OPENAI_API_KEY</code> to enable.
            </span>
          </div>
        )}

        {/* Word-level transcript */}
        {!transcribing && words.length > 0 && (
          <p
            style={{
              margin: 0,
              lineHeight: 2.2,
              fontSize: 14,
              color: C.text,
            }}
          >
            {words.map((w, i) => {
              const isActive = i === activeIdx;
              const inRange = isInRange(w);

              return (
                <span
                  key={i}
                  ref={isActive ? activeWordRef : undefined}
                  onClick={() => seekToTime(w.start)}
                  title={`${w.start.toFixed(2)}s`}
                  style={{
                    display: 'inline-block',
                    padding: '1px 3px',
                    marginRight: 1,
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    background: isActive
                      ? C.accent
                      : inRange
                      ? `${C.accent}28`
                      : 'transparent',
                    color: isActive ? '#fff' : inRange ? C.accent2 : C.text,
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 14,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </p>
        )}

        {/* Full text fallback when no word timestamps */}
        {!transcribing && transcript && words.length === 0 && transcript.text && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: C.text,
              lineHeight: 1.8,
            }}
          >
            {transcript.text}
          </p>
        )}
      </div>
    </div>
  );
}
