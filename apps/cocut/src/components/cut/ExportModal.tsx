import { useState } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useCutStore } from '../../store/cutStore';
import { formatTime } from '../../utils/formatTime';

export function ExportModal() {
  const soundbites = useCutStore((s) => s.soundbites);
  const fileName = useCutStore((s) => s.fileName);
  const setShowExportModal = useCutStore((s) => s.setShowExportModal);
  const [copied, setCopied] = useState(false);

  const exportData = {
    source: fileName ?? 'untitled',
    exportedAt: new Date().toISOString(),
    soundbites: soundbites.map((sb, i) => ({
      index: i + 1,
      label: sb.label,
      start: parseFloat(sb.start.toFixed(3)),
      end: parseFloat(sb.end.toFixed(3)),
      duration: parseFloat((sb.end - sb.start).toFixed(3)),
      start_tc: formatTime(sb.start),
      end_tc: formatTime(sb.end),
      text: sb.text,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = fileName?.replace(/\.[^/.]+$/, '') ?? 'soundbites';
    a.href = url;
    a.download = `${baseName}-soundbites.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && setShowExportModal(false)}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          width: 560,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon d={Icons.download} size={14} color={C.accent} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>
            export soundbites
          </span>
          <span style={{ fontSize: 10, color: C.textMuted }}>
            {soundbites.length} clip{soundbites.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowExportModal(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.textDim,
              padding: 4,
              lineHeight: 1,
            }}
          >
            <Icon d={Icons.close} size={14} />
          </button>
        </div>

        {/* Clip summary */}
        <div
          style={{
            padding: '10px 18px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 140,
            overflowY: 'auto',
          }}
        >
          {soundbites.map((sb, i) => (
            <div
              key={sb.id}
              style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 10 }}
            >
              <span style={{ color: C.accent, fontFamily: FONT_FAMILY_MONO, width: 18, flexShrink: 0 }}>
                {i + 1}.
              </span>
              <span style={{ color: C.text, fontWeight: 600, minWidth: 120 }}>{sb.label}</span>
              <span style={{ color: C.textDim, fontFamily: FONT_FAMILY_MONO }}>
                {formatTime(sb.start)} → {formatTime(sb.end)}
              </span>
            </div>
          ))}
        </div>

        {/* JSON preview */}
        <pre
          style={{
            flex: 1,
            margin: 0,
            padding: '12px 18px',
            overflowY: 'auto',
            background: C.bg,
            color: C.textDim,
            fontSize: 10,
            fontFamily: FONT_FAMILY_MONO,
            lineHeight: 1.7,
          }}
        >
          {json}
        </pre>

        {/* Actions */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button small onClick={handleCopy}>
            <Icon d={Icons.copy} size={11} />
            {copied ? 'Copied!' : 'Copy JSON'}
          </Button>
          <Button small accent onClick={handleDownload}>
            <Icon d={Icons.download} size={11} />
            Download .json
          </Button>
        </div>
      </div>
    </div>
  );
}
