import { useEffect } from 'react';
import { useElementStore } from '../store/elementStore';
import { usePlaybackStore } from '../store/playbackStore';
import { useTimelineStore } from '../store/timelineStore';
import { useUIStore } from '../store/uiStore';
import { saveProject, exportProjectJSON } from '../services/projectService';

/**
 * Global keyboard shortcuts — modeled after Adobe Premiere Pro defaults.
 *
 * Tool shortcuts (V, B, N, R, U, Y) are handled in TimelinePanel so they
 * can update the tool state directly.
 */
export function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key;

      // ------- Playback: JKL shuttle + Space -------
      if (key === ' ') {
        e.preventDefault();
        usePlaybackStore.getState().togglePlay();
        return;
      }
      if (key === 'k' && !isMeta) {
        // K = pause (Premiere)
        e.preventDefault();
        usePlaybackStore.getState().pause();
        return;
      }
      if (key === 'l' && !isMeta) {
        // L = play forward / speed up
        e.preventDefault();
        const store = usePlaybackStore.getState();
        if (!store.isPlaying) {
          store.play();
        } else {
          const next = Math.min(store.playbackRate * 2, 8);
          store.setPlaybackRate(next);
        }
        return;
      }
      if (key === 'j' && !isMeta) {
        // J = shuttle reverse (play backward at increasing speed)
        e.preventDefault();
        const store = usePlaybackStore.getState();
        const rate = store.playbackRate;
        if (rate > 0) {
          store.setPlaybackRate(-1);
        } else {
          store.setPlaybackRate(Math.max(rate * 2, -8));
        }
        if (!store.isPlaying) store.play();
        return;
      }

      // ------- Frame step -------
      if (key === 'ArrowLeft' && !isMeta && !e.shiftKey) {
        // Check if any element is selected for nudging
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) {
          // No selection — step 1 frame backward (1/30s)
          e.preventDefault();
          const ct = usePlaybackStore.getState().currentTime;
          usePlaybackStore.getState().setCurrentTime(Math.max(0, ct - 1 / 30));
          return;
        }
      }
      if (key === 'ArrowRight' && !isMeta && !e.shiftKey) {
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) {
          e.preventDefault();
          const ct = usePlaybackStore.getState().currentTime;
          const dur = usePlaybackStore.getState().duration;
          usePlaybackStore.getState().setCurrentTime(Math.min(dur, ct + 1 / 30));
          return;
        }
      }
      // Shift+Left/Right = 5 frames
      if (key === 'ArrowLeft' && !isMeta && e.shiftKey) {
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) {
          e.preventDefault();
          const ct = usePlaybackStore.getState().currentTime;
          usePlaybackStore.getState().setCurrentTime(Math.max(0, ct - 5 / 30));
          return;
        }
      }
      if (key === 'ArrowRight' && !isMeta && e.shiftKey) {
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) {
          e.preventDefault();
          const ct = usePlaybackStore.getState().currentTime;
          const dur = usePlaybackStore.getState().duration;
          usePlaybackStore.getState().setCurrentTime(Math.min(dur, ct + 5 / 30));
          return;
        }
      }

      // ------- Go to start / end (Home / End) -------
      if (key === 'Home') {
        e.preventDefault();
        usePlaybackStore.getState().seek(0);
        return;
      }
      if (key === 'End') {
        e.preventDefault();
        usePlaybackStore.getState().seek(usePlaybackStore.getState().duration);
        return;
      }

      // ------- Delete selected elements -------
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length > 0) {
          useElementStore.getState().deleteElements(ids);
        }
        return;
      }

      // ------- Undo / Redo -------
      if (isMeta && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useElementStore.temporal.getState().undo();
        return;
      }
      if (isMeta && (key === 'Z' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useElementStore.temporal.getState().redo();
        return;
      }

      // ------- Duplicate (Ctrl+D) -------
      if (isMeta && key === 'd') {
        e.preventDefault();
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length > 0) {
          useElementStore.getState().duplicateElements(ids);
        }
        return;
      }

      // ------- Select all (Ctrl+A) -------
      if (isMeta && key === 'a') {
        e.preventDefault();
        useElementStore.getState().selectAll();
        return;
      }

      // ------- Save (Ctrl+S) — save project -------
      if (isMeta && key === 's') {
        e.preventDefault();
        saveProject('My Project');
        exportProjectJSON();
        return;
      }

      // ------- Escape = deselect + close context menu -------
      if (key === 'Escape') {
        useElementStore.getState().deselectAll();
        useUIStore.getState().closeContextMenu();
        return;
      }

      // ------- Nudge selected elements with arrow keys -------
      if (key.startsWith('Arrow')) {
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) return;
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const elements = useElementStore.getState().elements;
        ids.forEach((id) => {
          const el = elements.find((e) => e.id === id);
          if (!el || el.locked) return;
          const patch: Record<string, number> = {};
          if (key === 'ArrowLeft') patch.x = el.x - delta;
          if (key === 'ArrowRight') patch.x = el.x + delta;
          if (key === 'ArrowUp') patch.y = el.y - delta;
          if (key === 'ArrowDown') patch.y = el.y + delta;
          useElementStore.getState().updateElement(id, patch);
        });
        return;
      }

      // ------- Split at playhead (S — Premiere: Ctrl+K, but S is more intuitive) -------
      if (key === 's' && !isMeta) {
        // Only if not handled by the tool switcher in TimelinePanel
        // (TimelinePanel handles V, B, N, R, U, Y)
        return; // S is now Ctrl+S save; split is via toolbar/scissors button
      }

      // ------- Ripple trim shortcuts: Q (trim left to playhead) / W (trim right to playhead) -------
      if (key === 'q' && !isMeta) {
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) return;
        const ct = usePlaybackStore.getState().currentTime;
        ids.forEach((id) => {
          const el = useElementStore.getState().elements.find((e) => e.id === id);
          if (!el) return;
          if (ct <= el.startTime || ct >= el.startTime + el.duration) return;
          const trimAmount = ct - el.startTime;
          const patch: Record<string, number> = {
            startTime: ct,
            duration: el.duration - trimAmount,
          };
          if (el.type === 'video' || el.type === 'audio') {
            patch.trimIn = ((el as any).trimIn || 0) + trimAmount;
          }
          useElementStore.getState().updateElement(id, patch);
        });
        return;
      }
      if (key === 'w' && !isMeta) {
        const ids = [...useElementStore.getState().selectedIds];
        if (ids.length === 0) return;
        const ct = usePlaybackStore.getState().currentTime;
        ids.forEach((id) => {
          const el = useElementStore.getState().elements.find((e) => e.id === id);
          if (!el) return;
          if (ct <= el.startTime || ct >= el.startTime + el.duration) return;
          useElementStore.getState().updateElement(id, { duration: ct - el.startTime });
        });
        return;
      }

      // ------- Toggle grid (G) -------
      if (key === 'g' && !isMeta) {
        useUIStore.getState().toggleGrid();
        return;
      }

      // ------- Mark in / out (I / O) — set loop range -------
      if (key === 'i' && !isMeta) {
        const ct = usePlaybackStore.getState().currentTime;
        const range = usePlaybackStore.getState().loopRange;
        usePlaybackStore.getState().setLoopRange({ start: ct, end: range?.end ?? usePlaybackStore.getState().duration });
        return;
      }
      if (key === 'o' && !isMeta) {
        const ct = usePlaybackStore.getState().currentTime;
        const range = usePlaybackStore.getState().loopRange;
        usePlaybackStore.getState().setLoopRange({ start: range?.start ?? 0, end: ct });
        return;
      }

      // ------- Zoom timeline (+/-) -------
      if ((key === '=' || key === '+') && !isMeta) {
        const { timelineZoom, setTimelineZoom } = useTimelineStore.getState();
        setTimelineZoom(timelineZoom + 20);
        return;
      }
      if (key === '-' && !isMeta) {
        const { timelineZoom, setTimelineZoom } = useTimelineStore.getState();
        setTimelineZoom(timelineZoom - 20);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
