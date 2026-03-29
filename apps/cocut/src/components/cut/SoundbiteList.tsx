import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore } from '../../store/cutStore';
import { formatTime } from '../../utils/formatTime';

export function SoundbiteList() {
  const soundbites = useCutStore((s) => s.soundbites);
  const deleteSoundbite = useCutStore((s) => s.deleteSoundbite);
  const seekToTime = useCutStore((s) => s.seekToTime);
  const setMarkerIn = useCutStore((s) => s.setMarkerIn);
  const setMarkerOut = useCutStore((s) => s.setMarkerOut);
  const setShowExportModal = useCutStore((s) => s.setShowExportModal);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);

  const jumpToClip = (start: number, end: number) => {
    seekToTime(start);
    setMarkerIn(start);
    setMarkerOut(end);
  };

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: C.surface,
        borderLeft: `1px solid ${C.border}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
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
            flex: 1,
          }}
        >
          soundbites
          {soundbites.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: C.accent,
                color: '#fff',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {soundbites.length}
            </span>
          )}
        </span>

        {soundbites.length > 0 && (
          <Button small onClick={() => setShowExportModal(true)} title="Export all (⌘E)">
            <Icon d={Icons.download} size={11} />
            Export
          </Button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {soundbites.length === 0 ? (
          <div
            style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: C.textMuted,
              fontSize: 11,
              fontFamily: FONT_FAMILY,
              lineHeight: 1.8,
            }}
          >
            No clips saved yet.
            <br />
            <span style={{ fontSize: 10 }}>
              Press <kbd style={{ color: C.accent2 }}>I</kbd> /{' '}
              <kbd style={{ color: C.orange }}>O</kbd> to mark,
              <br />
              then <kbd style={{ color: C.text }}>Enter</kbd> to save.
            </span>
          </div>
        ) : (
          <div style={{ padding: '6px 0' }}>
            {soundbites.map((sb, idx) => (
              <div
                key={sb.id}
                style={{
                  padding: '8px 14px',
                  borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = C.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
                onClick={() => jumpToClip(sb.start, sb.end)}
              >
                {/* Number + label */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: C.accent,
                      fontFamily: FONT_FAMILY_MONO,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: C.text,
                      fontFamily: FONT_FAMILY,
                      fontWeight: 600,
                      flex: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {sb.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSoundbite(sb.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.textMuted,
                      padding: 0,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    title="Delete clip"
                  >
                    <Icon d={Icons.trash} size={11} />
                  </button>
                </div>

                {/* Timestamps */}
                <div
                  style={{
                    fontSize: 9,
                    color: C.accent2,
                    fontFamily: FONT_FAMILY_MONO,
                    marginBottom: sb.text ? 4 : 0,
                  }}
                >
                  {formatTime(sb.start)} → {formatTime(sb.end)}{' '}
                  <span style={{ color: C.textMuted }}>
                    ({formatTime(sb.end - sb.start)})
                  </span>
                </div>

                {/* Text excerpt */}
                {sb.text && (
                  <div
                    style={{
                      fontSize: 10,
                      color: C.textDim,
                      fontFamily: FONT_FAMILY,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    "{sb.text}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <Button
          small
          accent
          onClick={() => setShowSaveModal(true)}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <Icon d={Icons.plus} size={11} /> New Clip
        </Button>
        {soundbites.length > 0 && (
          <Button small onClick={() => setShowExportModal(true)}>
            <Icon d={Icons.download} size={11} />
          </Button>
        )}
      </div>
    </div>
  );
}
