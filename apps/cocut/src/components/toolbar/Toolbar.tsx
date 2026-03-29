import { useRef } from 'react';
import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { FONT_FAMILY, FONT_FAMILY_BRAND, TOOLBAR_HEIGHT } from '../../theme/tokens';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useUIStore, COMPOSITION_PRESETS, type AppMode } from '../../store/uiStore';
import { createElement } from '../../utils/elementFactory';
import { formatTime } from '../../utils/formatTime';
import { saveProject, exportProjectJSON, importProjectJSON } from '../../services/projectService';
import { supabase } from '../../lib/supabase';

export function Toolbar() {
  const addElement = useElementStore((s) => s.addElement);
  const elements = useElementStore((s) => s.elements);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const showGrid = useUIStore((s) => s.showGrid);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const toggleSubtitleEditor = useUIStore((s) => s.toggleSubtitleEditor);
  const showSubtitleEditor = useUIStore((s) => s.showSubtitleEditor);
  const toggleAutoCut = useUIStore((s) => s.toggleAutoCut);
  const showAutoCut = useUIStore((s) => s.showAutoCut);
  const setShowNewProjectDialog = useUIStore((s) => s.setShowNewProjectDialog);
  const appMode = useUIStore((s) => s.appMode);
  const setAppMode = useUIStore((s) => s.setAppMode);
  const canvasWidth = useUIStore((s) => s.canvasWidth);
  const canvasHeight = useUIStore((s) => s.canvasHeight);
  const setCanvasSize = useUIStore((s) => s.setCanvasSize);

  const { undo, redo } = useElementStore.temporal.getState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => { saveProject('My Project'); exportProjectJSON(); };
  const handleOpenProject = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await importProjectJSON(file);
    e.target.value = '';
  };

  const handleAdd = (type: string) => {
    const el = createElement(type, { startTime: currentTime });
    addElement(el);
  };

  const currentSizeKey = `${canvasWidth}x${canvasHeight}`;

  return (
    <div
      style={{
        height: TOOLBAR_HEIGHT,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 6,
        flexShrink: 0,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: C.accent,
            boxShadow: `0 0 10px ${C.accentGlow}`,
          }}
        />
        <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, color: C.text }}>
          co-cut
        </span>
        <span style={{ fontSize: 8, color: C.textDim, marginLeft: 2, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' as const }}>
          by content co-op
        </span>
      </div>

      {/* Mode toggle: Edit | Cut */}
      <div
        style={{
          display: 'flex',
          background: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: 2,
          gap: 2,
          marginRight: 4,
        }}
      >
        {(['edit', 'cut'] as AppMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setAppMode(mode)}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: FONT_FAMILY_BRAND,
              fontWeight: appMode === mode ? 700 : 400,
              background: appMode === mode ? C.accent : 'transparent',
              color: appMode === mode ? '#fff' : C.textDim,
              transition: 'all 0.15s',
              letterSpacing: 0.3,
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={() => setShowNewProjectDialog(true)} title="New project">
        <Icon d={Icons.zap} size={13} /> New
      </Button>
      <Button small onClick={handleSave} title="Save project (Ctrl+S)">
        <Icon d={Icons.download} size={13} /> Save
      </Button>
      <Button small onClick={handleOpenProject} title="Open project file">
        <Icon d={Icons.upload} size={13} /> Open
      </Button>
      <Button small onClick={() => useUIStore.getState().toggleProjectManager()} title="Cloud projects">
        <Icon d={Icons.cloud} size={13} /> Cloud
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      {/* Canvas size / aspect ratio */}
      <Select
        value={currentSizeKey}
        onChange={(v) => {
          const [w, h] = v.split('x').map(Number);
          setCanvasSize(w, h);
        }}
        options={COMPOSITION_PRESETS.map((p) => ({
          label: `${p.label} — ${p.platform}`,
          value: `${p.width}x${p.height}`,
        }))}
        style={{ fontSize: 10, minWidth: 160 }}
      />

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={() => handleAdd('text')}>
        <Icon d={Icons.text} size={13} /> Text
      </Button>
      <Button small onClick={() => handleAdd('shape')}>
        <Icon d={Icons.square} size={13} /> Rect
      </Button>
      <Button small onClick={() => handleAdd('circle')}>
        <Icon d={Icons.circle} size={13} /> Circle
      </Button>
      <Button small onClick={() => handleAdd('image')}>
        <Icon d={Icons.image} size={13} /> Image
      </Button>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={() => undo()}>
        <Icon d={Icons.undo} size={13} />
      </Button>
      <Button small onClick={() => redo()}>
        <Icon d={Icons.redo} size={13} />
      </Button>
      <Button small active={showGrid} onClick={toggleGrid}>
        <Icon d={Icons.grid} size={13} />
      </Button>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small active={showSubtitleEditor} onClick={toggleSubtitleEditor}>
        <Icon d={Icons.text} size={13} /> Subs
      </Button>
      <Button small active={showAutoCut} onClick={toggleAutoCut}>
        <Icon d={Icons.wand} size={13} /> Auto-Cut
      </Button>
      <Button small onClick={() => setExportDialogOpen(true)}>
        <Icon d={Icons.download} size={13} /> Export
      </Button>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 10, color: C.textDim }}>
        {elements.length} layers &bull; {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <div style={{ width: 1, height: 24, background: C.border, margin: '0 6px' }} />

      <Button small onClick={() => supabase.auth.signOut()} title="Sign out">
        <Icon d={Icons.logOut} size={13} /> Sign Out
      </Button>
    </div>
  );
}
