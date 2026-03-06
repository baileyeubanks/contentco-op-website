import { useRef, useCallback } from 'react';
import { C } from '../../theme/colors';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { useUIStore } from '../../store/uiStore';
import { useElementStore } from '../../store/elementStore';
import { usePlaybackStore } from '../../store/playbackStore';
import { useMediaStore } from '../../store/mediaStore';
import { useTimelineStore } from '../../store/timelineStore';
// Canvas size now driven by uiStore (dynamic composition)
import { clamp } from '../../utils/math';
import { getAnimTransform, getExitAnimTransform } from '../../utils/animation';
import { createVideoElement, createImageElement, createAudioElement } from '../../utils/elementFactory';
import { registerVideo, unregisterVideo } from '../../hooks/usePlayback';
import { SubtitleOverlay } from '../subtitles/SubtitleOverlay';
import type { Element } from '../../types';

export function CanvasViewport() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const showGrid = useUIStore((s) => s.showGrid);
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const selectElement = useElementStore((s) => s.selectElement);
  const updateElement = useElementStore((s) => s.updateElement);
  const deselectAll = useElementStore((s) => s.deselectAll);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const canvasWidth = useUIStore((s) => s.canvasWidth);
  const canvasHeight = useUIStore((s) => s.canvasHeight);
  const canvasBgColor = useUIStore((s) => s.canvasBgColor);

  const dragRef = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const resizeRef = useRef<{ id: string } | null>(null);

  const getCanvasPos = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    // Walk up DOM tree to find element with data-elid
    let node = e.target as HTMLElement | null;
    let elId: string | undefined;
    while (node && node !== canvasRef.current) {
      if (node.dataset?.elid) {
        elId = node.dataset.elid;
        break;
      }
      node = node.parentElement;
    }
    const pos = getCanvasPos(e);

    if (elId) {
      const el = elements.find((el) => el.id === elId);
      if (el && !el.locked) {
        selectElement(elId, e.shiftKey);
        dragRef.current = { id: elId, startX: pos.x - el.x, startY: pos.y - el.y };
      } else if (el) {
        selectElement(elId, e.shiftKey);
      }
    } else if (e.target === canvasRef.current) {
      deselectAll();
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const pos = getCanvasPos(e);
      updateElement(dragRef.current.id, {
        x: Math.round(pos.x - dragRef.current.startX),
        y: Math.round(pos.y - dragRef.current.startY),
      });
    }
    if (resizeRef.current) {
      const pos = getCanvasPos(e);
      const el = elements.find((el) => el.id === resizeRef.current!.id);
      if (el) {
        updateElement(resizeRef.current.id, {
          width: Math.max(20, Math.round(pos.x - el.x)),
          height: Math.max(20, Math.round(pos.y - el.y)),
        });
      }
    }
  };

  const onMouseUp = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  const renderElement = (el: Element, idx: number) => {
    if (!el.visible) return null;

    const isInTime = currentTime >= el.startTime && currentTime < el.startTime + el.duration;
    if (!isInTime && isPlaying) return null;

    let animStyle: React.CSSProperties = {};
    if (el.animation !== 'none' && isInTime) {
      const elapsed = currentTime - el.startTime;
      const progress = clamp(elapsed / el.animDuration, 0, 1);
      animStyle = getAnimTransform(el.animation, progress, el.easing);
    }

    // Exit animation
    if (el.animationExit !== 'none' && isInTime) {
      const elEnd = el.startTime + el.duration;
      const timeToEnd = elEnd - currentTime;
      if (timeToEnd <= el.animExitDuration) {
        const exitProgress = clamp(1 - timeToEnd / el.animExitDuration, 0, 1);
        const exitStyle = getExitAnimTransform(el.animationExit, exitProgress, el.easing);
        animStyle = { ...animStyle, ...exitStyle };
      }
    }

    const isSelected = selectedIds.has(el.id);

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      transform: `rotate(${el.rotation}deg)`,
      opacity: animStyle.opacity !== undefined ? animStyle.opacity : el.opacity,
      borderRadius: el.borderRadius,
      filter: el.filter !== 'none' ? el.filter : undefined,
      mixBlendMode: el.blendMode as React.CSSProperties['mixBlendMode'],
      boxShadow: el.shadow ? '0 8px 32px rgba(0,0,0,0.5)' : undefined,
      cursor: el.locked ? 'default' : 'move',
      outline: isSelected ? `2px solid ${C.accent}` : 'none',
      outlineOffset: 2,
      zIndex: idx,
      transition: dragRef.current?.id === el.id ? 'none' : 'opacity 0.05s',
      ...animStyle,
      userSelect: 'none',
    };

    if (el.type === 'text') {
      return (
        <div
          key={el.id}
          data-elid={el.id}
          style={{
            ...baseStyle,
            color: el.color,
            fontSize: el.fontSize,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight,
            textAlign: el.textAlign,
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
            lineHeight: 1.2,
            overflow: 'hidden',
            clipPath: (animStyle as Record<string, string>).clipPath,
          }}
        >
          {el.content}
        </div>
      );
    }

    if (el.type === 'shape' || el.type === 'circle') {
      return (
        <div
          key={el.id}
          data-elid={el.id}
          style={{
            ...baseStyle,
            background: el.fill,
            border: el.stroke !== 'none' ? `${el.strokeWidth}px solid ${el.stroke}` : 'none',
          }}
        />
      );
    }

    if (el.type === 'image') {
      return (
        <div
          key={el.id}
          data-elid={el.id}
          style={{
            ...baseStyle,
            background: el.src ? `url(${el.src}) center/cover` : C.surface3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.textDim,
            fontSize: 11,
            border: el.src ? 'none' : `1px dashed ${C.border2}`,
          }}
        >
          {!el.src && (
            <>
              <Icon d={Icons.image} size={20} color={C.textDim} />
              <span style={{ marginLeft: 6 }}>Image</span>
            </>
          )}
        </div>
      );
    }

    if (el.type === 'video') {
      if (el.src) {
        return (
          <div key={el.id} data-elid={el.id} style={baseStyle}>
            <video
              ref={(ref) => {
                if (ref) registerVideo(el.id, ref);
                else unregisterVideo(el.id);
              }}
              src={el.src}
              muted={el.muted}
              playsInline
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                objectFit: el.objectFit,
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      }
      return (
        <div
          key={el.id}
          data-elid={el.id}
          style={{
            ...baseStyle,
            background: '#1a1a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.textDim,
            fontSize: 11,
            border: `1px dashed ${C.border2}`,
          }}
        >
          <Icon d={Icons.film} size={24} color={C.pink} />
          <span style={{ marginLeft: 8 }}>Video Clip</span>
        </div>
      );
    }

    return null;
  };

  const selectedEl = elements.find((e) => selectedIds.has(e.id) && !e.locked);
  const openContextMenu = useUIStore((s) => s.openContextMenu);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.03 : 0.03;
        setZoom(zoom + delta);
      }
    },
    [zoom, setZoom],
  );

  // Drop media onto canvas
  const onCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const assetId = e.dataTransfer.getData('application/coedit-asset');
      if (!assetId) return;
      const asset = useMediaStore.getState().getAsset(assetId);
      if (!asset) return;

      const pos = getCanvasPos(e as unknown as React.MouseEvent);
      const ct = usePlaybackStore.getState().currentTime;
      const addTrack = useTimelineStore.getState().addTrack;

      if (asset.type === 'video') {
        const trackId = addTrack('video');
        const dur = asset.duration || 10;
        useElementStore.getState().addElement(
          createVideoElement({
            name: asset.name,
            mediaAssetId: asset.id,
            src: asset.blobKey,
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            startTime: ct,
            duration: dur,
            trimOut: dur,
            width: asset.width || 1920,
            height: asset.height || 1080,
            trackId,
          }),
        );
        const projDur = usePlaybackStore.getState().duration;
        if (ct + dur > projDur) usePlaybackStore.getState().setDuration(ct + dur + 5);
      } else if (asset.type === 'image') {
        const trackId = addTrack('graphic');
        useElementStore.getState().addElement(
          createImageElement({
            name: asset.name,
            mediaAssetId: asset.id,
            src: asset.blobKey,
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            startTime: ct,
            duration: 5,
            width: asset.width ? Math.min(asset.width, 800) : 400,
            height: asset.height ? Math.min(asset.height, 600) : 300,
            trackId,
          }),
        );
      } else if (asset.type === 'audio') {
        const trackId = addTrack('audio');
        const dur = asset.duration || 10;
        useElementStore.getState().addElement(
          createAudioElement({
            name: asset.name,
            mediaAssetId: asset.id,
            src: asset.blobKey,
            startTime: ct,
            duration: dur,
            trimOut: dur,
            trackId,
          }),
        );
        const projDur = usePlaybackStore.getState().duration;
        if (ct + dur > projDur) usePlaybackStore.getState().setDuration(ct + dur + 5);
      }
    },
    [getCanvasPos],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Walk up DOM tree to find element with data-elid (handles clicks on child nodes like <video>, <span>)
      let node = e.target as HTMLElement | null;
      let elId: string | null = null;
      while (node && node !== e.currentTarget) {
        if (node.dataset?.elid) {
          elId = node.dataset.elid;
          break;
        }
        node = node.parentElement;
      }
      if (elId) selectElement(elId);
      openContextMenu(e.clientX, e.clientY, elId, elId ? 'element' : 'canvas');
    },
    [openContextMenu, selectElement],
  );

  const displayScale = zoom;

  return (
    <div
      style={{ flex: 1, background: '#060a10', position: 'relative', overflow: 'hidden' }}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/coedit-asset')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onCanvasDrop}
    >
      <div
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${displayScale})`,
          transformOrigin: 'center center',
          width: canvasWidth,
          height: canvasHeight,
          background: canvasBgColor,
          borderRadius: 8,
          boxShadow: `0 0 60px rgba(0,0,0,0.5), 0 0 0 1px ${C.border}`,
          overflow: 'hidden',
          backgroundImage: showGrid
            ? `linear-gradient(${C.border}22 1px, transparent 1px), linear-gradient(90deg, ${C.border}22 1px, transparent 1px)`
            : 'none',
          backgroundSize: '40px 40px',
        }}
      >
        {elements.map((el, idx) => renderElement(el, idx))}
        <SubtitleOverlay />

        {/* Resize handle */}
        {selectedEl && (
          <div
            style={{
              position: 'absolute',
              left: selectedEl.x + selectedEl.width - 5,
              top: selectedEl.y + selectedEl.height - 5,
              width: 12,
              height: 12,
              background: C.accent,
              borderRadius: 2,
              cursor: 'nwse-resize',
              zIndex: 9999,
              border: `1px solid ${C.bg}`,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              resizeRef.current = { id: selectedEl.id };
            }}
          />
        )}
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 4 }}>
        <Button small onClick={() => setZoom(zoom - 0.05)} style={{ fontSize: 14, padding: '2px 8px' }}>
          -
        </Button>
        <span
          style={{
            fontSize: 10,
            color: C.textDim,
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <Button small onClick={() => setZoom(zoom + 0.05)} style={{ fontSize: 14, padding: '2px 8px' }}>
          +
        </Button>
        <Button small onClick={() => setZoom(0.5)} style={{ fontSize: 10 }}>
          Fit
        </Button>
      </div>
    </div>
  );
}
