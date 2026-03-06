import { useRef, useState, useCallback, useEffect } from 'react';
import { C, ELEMENT_COLORS } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { TRACK_HEIGHT, LAYER_PANEL_WIDTH, FONT_FAMILY, FONT_FAMILY_MONO } from '../../theme/tokens';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import { useUIStore, type TimelineTool } from '../../store/uiStore';
import { clamp } from '../../utils/math';
import { formatTime } from '../../utils/formatTime';
import { uid } from '../../utils/uid';
import { createVideoElement, createImageElement, createAudioElement } from '../../utils/elementFactory';
import type { Element } from '../../types';

type DragMode = null | 'move' | 'trim-left' | 'trim-right' | 'slip';

const TRIM_HANDLE_WIDTH = 7;

const TOOL_CONFIG: Record<TimelineTool, { label: string; icon: string; key: string; tip: string }> = {
  select: { label: 'Select', icon: Icons.cursor, key: 'V', tip: 'Select / Move (V)' },
  blade: { label: 'Blade', icon: Icons.blade, key: 'B', tip: 'Blade / Razor Cut (B)' },
  ripple: { label: 'Ripple', icon: Icons.ripple, key: 'R', tip: 'Ripple Edit (R)' },
  roll: { label: 'Roll', icon: Icons.roll, key: 'N', tip: 'Roll Edit (N)' },
  slide: { label: 'Slide', icon: Icons.slideEdit, key: 'U', tip: 'Slide (U)' },
  slip: { label: 'Slip', icon: Icons.slipEdit, key: 'Y', tip: 'Slip (Y)' },
};

export function TimelinePanel() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const selectElement = useElementStore((s) => s.selectElement);
  const updateElement = useElementStore((s) => s.updateElement);
  const addElement = useElementStore((s) => s.addElement);
  const deleteElements = useElementStore((s) => s.deleteElements);

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const stop = usePlaybackStore((s) => s.stop);
  const seek = usePlaybackStore((s) => s.seek);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);

  const timelineZoom = useTimelineStore((s) => s.timelineZoom);
  const setTimelineZoom = useTimelineStore((s) => s.setTimelineZoom);
  const snapEnabled = useTimelineStore((s) => s.snapEnabled);
  const toggleSnap = useTimelineStore((s) => s.toggleSnap);

  const timelineTool = useUIStore((s) => s.timelineTool);
  const setTimelineTool = useUIStore((s) => s.setTimelineTool);

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);
  const [bladePreviewTime, setBladePreviewTime] = useState<number | null>(null);
  const [bladePreviewTrack, setBladePreviewTrack] = useState<number>(-1);
  const dragStartRef = useRef<{
    mouseX: number;
    startTime: number;
    duration: number;
    trimIn: number;
  }>({ mouseX: 0, startTime: 0, duration: 0, trimIn: 0 });

  const totalWidth = Math.max(duration * timelineZoom, 800);
  const rulerMarks = Math.ceil(duration) + 1;

  const pxToTime = (px: number) => px / timelineZoom;
  const timeToPx = (t: number) => t * timelineZoom;

  // Snap time to nearest edge if snap is enabled
  const snapTime = useCallback(
    (t: number, ignoreId?: string): number => {
      if (!snapEnabled) return t;
      const SNAP_THRESHOLD = pxToTime(8);
      let best = t;
      let bestDist = SNAP_THRESHOLD;

      // Snap to playhead
      if (Math.abs(t - currentTime) < bestDist) {
        best = currentTime;
        bestDist = Math.abs(t - currentTime);
      }

      // Snap to clip edges
      elements.forEach((el) => {
        if (el.id === ignoreId) return;
        const start = el.startTime;
        const end = el.startTime + el.duration;
        if (Math.abs(t - start) < bestDist) {
          best = start;
          bestDist = Math.abs(t - start);
        }
        if (Math.abs(t - end) < bestDist) {
          best = end;
          bestDist = Math.abs(t - end);
        }
      });

      // Snap to ruler marks (whole seconds)
      const nearestSecond = Math.round(t);
      if (Math.abs(t - nearestSecond) < bestDist) {
        best = nearestSecond;
      }

      return best;
    },
    [snapEnabled, currentTime, elements, timelineZoom],
  );

  const scrub = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left + timelineRef.current.scrollLeft, 0, totalWidth);
    const t = pxToTime(x);
    setCurrentTime(clamp(t, 0, duration));
  };

  const getLabel = (el: Element) => {
    if (el.type === 'text') return el.content.slice(0, 20);
    return el.name || el.type;
  };

  // Blade tool: cut clip at mouse position
  const bladeClip = (el: Element, mouseTime: number) => {
    if (mouseTime <= el.startTime || mouseTime >= el.startTime + el.duration) return;
    const splitPoint = mouseTime - el.startTime;
    updateElement(el.id, { duration: splitPoint });
    const secondHalf = {
      ...el,
      id: uid(),
      name: el.name + ' (2)',
      startTime: mouseTime,
      duration: el.duration - splitPoint,
    } as Element;
    if (secondHalf.type === 'video' || secondHalf.type === 'audio') {
      (secondHalf as any).trimIn = ((el as any).trimIn || 0) + splitPoint;
    }
    addElement(secondHalf);
  };

  // Clip drag handlers
  const onClipMouseDown = (e: React.MouseEvent, el: Element, mode: DragMode) => {
    e.stopPropagation();

    // Blade tool — cut immediately on click
    if (timelineTool === 'blade') {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const mouseTime = pxToTime(x);
      bladeClip(el, mouseTime);
      return;
    }

    selectElement(el.id);
    setDragMode(mode);
    setDragId(el.id);
    dragStartRef.current = {
      mouseX: e.clientX,
      startTime: el.startTime,
      duration: el.duration,
      trimIn: (el as any).trimIn || 0,
    };
  };

  const onTimelineMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Blade preview
      if (timelineTool === 'blade' && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
        const mouseTime = pxToTime(x);
        setBladePreviewTime(mouseTime);

        // Determine which track row the cursor is over
        const headerH = 20; // ruler height
        const scrollTop = timelineRef.current.scrollTop;
        const relY = e.clientY - rect.top + scrollTop - headerH;
        const trackIdx = Math.floor(relY / TRACK_HEIGHT);
        setBladePreviewTrack(trackIdx);
      }

      if (!dragMode || !dragId) return;
      const el = useElementStore.getState().elements.find((e) => e.id === dragId);
      if (!el) return;

      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaTime = pxToTime(deltaX);

      if (dragMode === 'move') {
        let newStart = Math.max(0, dragStartRef.current.startTime + deltaTime);
        newStart = snapTime(newStart, dragId);
        // Also snap end
        const newEnd = snapTime(newStart + el.duration, dragId);
        if (newEnd !== newStart + el.duration) {
          newStart = newEnd - el.duration;
        }
        updateElement(dragId, { startTime: Math.max(0, newStart) });
      } else if (dragMode === 'trim-left') {
        const rawStart = dragStartRef.current.startTime + deltaTime;
        const minStart = 0;
        const maxStart = dragStartRef.current.startTime + dragStartRef.current.duration - 0.1;
        let newStart = clamp(rawStart, minStart, maxStart);
        newStart = snapTime(newStart, dragId);
        newStart = clamp(newStart, minStart, maxStart);
        const newDuration = dragStartRef.current.duration - (newStart - dragStartRef.current.startTime);
        updateElement(dragId, { startTime: newStart, duration: Math.max(0.1, newDuration) });
        if (el.type === 'video' || el.type === 'audio') {
          const trimDelta = newStart - dragStartRef.current.startTime;
          updateElement(dragId, { trimIn: Math.max(0, dragStartRef.current.trimIn + trimDelta) });
        }
      } else if (dragMode === 'trim-right') {
        const rawDuration = dragStartRef.current.duration + deltaTime;
        let newDuration = Math.max(0.1, rawDuration);
        const newEnd = snapTime(el.startTime + newDuration, dragId);
        newDuration = newEnd - el.startTime;
        updateElement(dragId, { duration: Math.max(0.1, newDuration) });
      } else if (dragMode === 'slip') {
        // Slip: change trimIn without moving clip or changing duration
        if (el.type === 'video' || el.type === 'audio') {
          const newTrimIn = Math.max(0, dragStartRef.current.trimIn + deltaTime);
          updateElement(dragId, { trimIn: newTrimIn } as any);
        }
      }
    },
    [dragMode, dragId, updateElement, snapTime, timelineTool],
  );

  const onTimelineMouseUp = () => {
    setDragMode(null);
    setDragId(null);
  };

  // Split selected clips at playhead
  const splitAtPlayhead = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    ids.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (!el) return;
      if (currentTime <= el.startTime || currentTime >= el.startTime + el.duration) return;
      const splitPoint = currentTime - el.startTime;
      updateElement(el.id, { duration: splitPoint });
      const secondHalf = {
        ...el,
        id: uid(),
        name: el.name + ' (2)',
        startTime: currentTime,
        duration: el.duration - splitPoint,
      } as Element;
      if (secondHalf.type === 'video' || secondHalf.type === 'audio') {
        (secondHalf as any).trimIn = ((el as any).trimIn || 0) + splitPoint;
      }
      addElement(secondHalf);
    });
  };

  // Timeline wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setTimelineZoom(timelineZoom + delta);
    }
  };

  // Handle drop from media bin
  const onTimelineDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const assetId = e.dataTransfer.getData('application/coedit-asset');
      if (!assetId) return;
      const asset = useMediaStore.getState().getAsset(assetId);
      if (!asset) return;

      // Calculate drop time position
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const dropTime = Math.max(0, pxToTime(x));

      const addTrack = useTimelineStore.getState().addTrack;
      const addElement = useElementStore.getState().addElement;
      const { duration: projDuration, setDuration } = usePlaybackStore.getState();

      if (asset.type === 'video') {
        const trackId = addTrack('video');
        const dur = asset.duration || 10;
        addElement(
          createVideoElement({
            name: asset.name,
            mediaAssetId: asset.id,
            src: asset.blobKey,
            startTime: dropTime,
            duration: dur,
            trimOut: dur,
            width: asset.width || 1920,
            height: asset.height || 1080,
            trackId,
          }),
        );
        if (dropTime + dur > projDuration) setDuration(dropTime + dur + 5);
      } else if (asset.type === 'image') {
        const trackId = addTrack('graphic');
        addElement(
          createImageElement({
            name: asset.name,
            mediaAssetId: asset.id,
            src: asset.blobKey,
            startTime: dropTime,
            duration: 5,
            width: asset.width ? Math.min(asset.width, 800) : 400,
            height: asset.height ? Math.min(asset.height, 600) : 300,
            trackId,
          }),
        );
      } else if (asset.type === 'audio') {
        const trackId = addTrack('audio');
        const dur = asset.duration || 10;
        addElement(
          createAudioElement({
            name: asset.name,
            mediaAssetId: asset.id,
            src: asset.blobKey,
            startTime: dropTime,
            duration: dur,
            trimOut: dur,
            trackId,
          }),
        );
        if (dropTime + dur > projDuration) setDuration(dropTime + dur + 5);
      }
    },
    [timelineZoom],
  );

  // Tool keyboard shortcuts (within timeline area)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const toolKeys: Record<string, TimelineTool> = {
        v: 'select',
        b: 'blade',
        r: 'ripple',
        n: 'roll',
        u: 'slide',
        y: 'slip',
      };
      const key = e.key.toLowerCase();
      if (toolKeys[key] && !e.metaKey && !e.ctrlKey) {
        setTimelineTool(toolKeys[key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTimelineTool]);

  const getCursorForTool = (): string => {
    switch (timelineTool) {
      case 'blade':
        return 'crosshair';
      case 'ripple':
      case 'roll':
        return 'col-resize';
      case 'slide':
      case 'slip':
        return 'ew-resize';
      default:
        return 'default';
    }
  };

  return (
    <div
      style={{
        height: 240,
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Transport bar */}
      <div
        style={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 4,
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        {/* Transport controls */}
        <Button small onClick={() => seek(0)} title="Go to start">
          <Icon d={Icons.skipBack} size={12} />
        </Button>
        <Button small active={isPlaying} onClick={togglePlay} title="Play/Pause (Space)">
          <Icon d={isPlaying ? Icons.pause : Icons.play} size={12} color={isPlaying ? '#fff' : C.green} />
        </Button>
        <Button small onClick={stop} title="Stop">
          <Icon d={Icons.stop} size={12} />
        </Button>

        <div
          style={{
            background: C.surface2,
            borderRadius: 4,
            padding: '2px 10px',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: FONT_FAMILY_MONO,
            fontSize: 12,
            fontWeight: 600,
            color: isPlaying ? C.green : C.text,
            minWidth: 80,
            textAlign: 'center',
            border: `1px solid ${C.border}`,
          }}
        >
          {formatTime(currentTime)}
        </div>
        <span style={{ fontSize: 9, color: C.textDim }}>/ {formatTime(duration)}</span>

        <div style={{ width: 1, height: 20, background: C.border, margin: '0 2px' }} />

        {/* Tool palette */}
        {(Object.entries(TOOL_CONFIG) as [TimelineTool, typeof TOOL_CONFIG['select']][]).map(
          ([tool, config]) => (
            <Button
              key={tool}
              small
              active={timelineTool === tool}
              onClick={() => setTimelineTool(tool)}
              title={config.tip}
            >
              <Icon d={config.icon} size={12} />
            </Button>
          ),
        )}

        <div style={{ width: 1, height: 20, background: C.border, margin: '0 2px' }} />

        <Button small onClick={splitAtPlayhead} title="Split at playhead (S)">
          <Icon d={Icons.scissors} size={12} />
        </Button>

        <Button small active={snapEnabled} onClick={toggleSnap} title="Snap to edges">
          <Icon d={Icons.magnet} size={12} />
          {snapEnabled && (
            <span style={{ fontSize: 8, marginLeft: 2, color: C.accent2 }}>ON</span>
          )}
        </Button>

        <div style={{ flex: 1 }} />

        <Button small onClick={() => setTimelineZoom(timelineZoom - 20)} title="Zoom out">
          <Icon d={Icons.minus} size={10} />
        </Button>
        <span
          style={{
            fontFamily: FONT_FAMILY_MONO,
            fontSize: 9,
            color: C.textDim,
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {timelineZoom}px/s
        </span>
        <Button small onClick={() => setTimelineZoom(timelineZoom + 20)} title="Zoom in">
          <Icon d={Icons.plus} size={10} />
        </Button>
      </div>

      {/* Timeline tracks */}
      <div
        style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
        onMouseMove={onTimelineMouseMove}
        onMouseUp={onTimelineMouseUp}
        onMouseLeave={() => {
          onTimelineMouseUp();
          setBladePreviewTime(null);
        }}
      >
        {/* Track labels */}
        <div
          style={{
            width: LAYER_PANEL_WIDTH,
            borderRight: `1px solid ${C.border}`,
            overflowY: 'auto',
            flexShrink: 0,
            background: C.surface,
          }}
        >
          {elements.map((el) => {
            const isSelected = selectedIds.has(el.id);
            return (
              <div
                key={el.id}
                onClick={() => selectElement(el.id)}
                style={{
                  height: TRACK_HEIGHT,
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontSize: 10,
                  color: isSelected ? C.text : C.textDim,
                  background: isSelected ? C.surface2 : 'transparent',
                  gap: 5,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 1,
                    background: ELEMENT_COLORS[el.type] || C.accent,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}
                >
                  {getLabel(el)}
                </span>
                {el.locked && (
                  <Icon d={Icons.lock} size={8} color={C.textMuted} />
                )}
                <span
                  style={{ fontSize: 8, color: C.textMuted, cursor: 'pointer', padding: 2, lineHeight: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteElements([el.id]);
                  }}
                  title="Delete"
                >
                  ✕
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeline area */}
        <div
          ref={timelineRef}
          style={{
            flex: 1,
            position: 'relative',
            overflowX: 'auto',
            overflowY: 'auto',
            cursor: getCursorForTool(),
          }}
          onWheel={onWheel}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/coedit-asset')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={onTimelineDrop}
          onMouseDown={(e) => {
            if (!dragMode) scrub(e);
          }}
        >
          <div style={{ minWidth: totalWidth, position: 'relative' }}>
            {/* Time ruler */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                height: 20,
                background: C.surface2,
                borderBottom: `1px solid ${C.border}`,
                zIndex: 5,
              }}
            >
              {Array.from({ length: rulerMarks }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: timeToPx(i),
                    fontSize: 8,
                    fontFamily: FONT_FAMILY_MONO,
                    color: C.textMuted,
                    top: 4,
                    transform: 'translateX(-50%)',
                    userSelect: 'none',
                  }}
                >
                  {i}s
                </div>
              ))}
              {/* Half-second marks */}
              {Array.from({ length: Math.ceil(duration * 2) }).map((_, i) => {
                const t = i * 0.5;
                if (Number.isInteger(t)) return null;
                return (
                  <div
                    key={`h-${i}`}
                    style={{
                      position: 'absolute',
                      left: timeToPx(t),
                      bottom: 0,
                      width: 1,
                      height: 4,
                      background: C.border,
                    }}
                  />
                );
              })}
            </div>

            {/* Clips */}
            <div>
              {elements.map((el, trackIdx) => {
                const left = timeToPx(el.startTime);
                const width = Math.max(timeToPx(el.duration), 8);
                const color = ELEMENT_COLORS[el.type] || C.accent;
                const isSelected = selectedIds.has(el.id);
                const isHovered = hoveredClip === el.id;
                const isDragging = dragId === el.id;

                return (
                  <div
                    key={el.id}
                    style={{
                      height: TRACK_HEIGHT,
                      position: 'relative',
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {/* Clip body */}
                    <div
                      style={{
                        position: 'absolute',
                        left,
                        width,
                        top: 4,
                        height: TRACK_HEIGHT - 8,
                        background: isSelected
                          ? `linear-gradient(180deg, ${color}cc, ${color}88)`
                          : isHovered
                            ? `linear-gradient(180deg, ${color}66, ${color}44)`
                            : `linear-gradient(180deg, ${color}44, ${color}22)`,
                        borderRadius: 4,
                        border: isSelected
                          ? `1.5px solid ${color}`
                          : isHovered
                            ? `1px solid ${color}88`
                            : `1px solid ${color}33`,
                        cursor:
                          timelineTool === 'blade'
                            ? 'crosshair'
                            : isDragging && dragMode === 'move'
                              ? 'grabbing'
                              : 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: TRIM_HANDLE_WIDTH + 4,
                        paddingRight: TRIM_HANDLE_WIDTH + 4,
                        fontSize: 10,
                        color: '#fff',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        transition: isDragging ? 'none' : 'background 0.1s, border-color 0.1s',
                        boxShadow: isSelected ? `0 0 12px ${color}33` : 'none',
                      }}
                      onMouseDown={(e) => {
                        if (timelineTool === 'slip') {
                          e.stopPropagation();
                          onClipMouseDown(e, el, 'slip');
                        } else {
                          onClipMouseDown(e, el, 'move');
                        }
                      }}
                      onMouseEnter={() => setHoveredClip(el.id)}
                      onMouseLeave={() => setHoveredClip(null)}
                    >
                      {/* Left trim handle */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: TRIM_HANDLE_WIDTH,
                          cursor: 'ew-resize',
                          background: isSelected || isHovered ? `${color}66` : 'transparent',
                          borderRadius: '4px 0 0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onClipMouseDown(e, el, 'trim-left');
                        }}
                      >
                        {(isSelected || isHovered) && (
                          <div
                            style={{
                              width: 2,
                              height: 12,
                              background: '#ffffff66',
                              borderRadius: 1,
                            }}
                          />
                        )}
                      </div>

                      {/* Clip content */}
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: 10,
                          fontWeight: 500,
                          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        }}
                      >
                        {getLabel(el)}
                      </span>
                      {el.animation !== 'none' && (
                        <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 8 }}>
                          ◆
                        </span>
                      )}

                      {/* Right trim handle */}
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: TRIM_HANDLE_WIDTH,
                          cursor: 'ew-resize',
                          background: isSelected || isHovered ? `${color}66` : 'transparent',
                          borderRadius: '0 4px 4px 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onClipMouseDown(e, el, 'trim-right');
                        }}
                      >
                        {(isSelected || isHovered) && (
                          <div
                            style={{
                              width: 2,
                              height: 12,
                              background: '#ffffff66',
                              borderRadius: 1,
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Blade preview line */}
                    {timelineTool === 'blade' &&
                      bladePreviewTime !== null &&
                      bladePreviewTrack === trackIdx &&
                      bladePreviewTime > el.startTime &&
                      bladePreviewTime < el.startTime + el.duration && (
                        <div
                          style={{
                            position: 'absolute',
                            left: timeToPx(bladePreviewTime),
                            top: 4,
                            bottom: 4,
                            width: 2,
                            background: C.red,
                            zIndex: 8,
                            pointerEvents: 'none',
                            opacity: 0.8,
                            boxShadow: `0 0 6px ${C.red}66`,
                          }}
                        />
                      )}
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div
              style={{
                position: 'absolute',
                left: timeToPx(currentTime),
                top: 0,
                bottom: 0,
                width: 2,
                background: C.red,
                zIndex: 10,
                pointerEvents: 'none',
                boxShadow: `0 0 8px ${C.red}66`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: -5,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `8px solid ${C.red}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
