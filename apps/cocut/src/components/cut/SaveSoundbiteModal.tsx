import { useState, useEffect, useRef } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore } from '../../store/cutStore';
import { formatTime } from '../../utils/formatTime';

export function SaveSoundbiteModal() {
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const markers = useCutStore((s) => s.markers);
  const saveSoundbite = useCutStore((s) => s.saveSoundbite);
  const setShowSaveModal = useCutStore((s) => s.setShowSaveModal);

  const dur =
    markers.in !== null && markers.out !== null ? markers.out - markers.in : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!label.trim()) return;
    saveSoundbite(label.trim());
    setLabel('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setShowSaveModal(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 8000,
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => e.target === e.currentTarget && setShowSaveModal(false)}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          width: 340,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          fontFamily: FONT_FAMILY,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon d={Icons.wand} size={13} color={C.accent} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1 }}>
            save soundbite
          </span>
          <button
            onClick={() => setShowSaveModal(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.textDim,
              padding: 2,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '14px 16px' }}>
          {/* Timestamp display */}
          {markers.in !== null && markers.out !== null && (
            <div
              style={{
                fontSize: 10,
                color: C.accent2,
                fontFamily: FONT_FAMILY_MONO,
                marginBottom: 12,
                padding: '5px 8px',
                background: C.surface2,
                borderRadius: 5,
                border: `1px solid ${C.border}`,
              }}
            >
              {formatTime(markers.in)} → {formatTime(markers.out)}
              {dur !== null && (
                <span style={{ color: C.textMuted, marginLeft: 8 }}>
                  ({formatTime(dur)})
                </span>
              )}
            </div>
          )}

          {/* Label input */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 9,
                color: C.textDim,
                marginBottom: 5,
                letterSpacing: 0.4,
                textTransform: 'uppercase' as const,
              }}
            >
              Clip Label
            </div>
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Opening hook, Key stat, Best quote..."
              style={{
                width: '100%',
                background: C.surface2,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 12,
                padding: '7px 10px',
                outline: 'none',
                fontFamily: FONT_FAMILY,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button small onClick={() => setShowSaveModal(false)} style={{ flex: 1, justifyContent: 'center' }}>
              Cancel
            </Button>
            <Button
              small
              accent
              onClick={handleSave}
              disabled={!label.trim()}
              style={{ flex: 2, justifyContent: 'center' }}
            >
              <Icon d={Icons.plus} size={11} /> Save Clip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
