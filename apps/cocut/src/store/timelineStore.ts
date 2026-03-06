import { create } from 'zustand';
import type { Track, TrackType } from '../types';
import { uid } from '../utils/uid';
import { TRACK_HEIGHT } from '../theme/tokens';

interface TimelineState {
  tracks: Track[];
  timelineZoom: number;
  scrollX: number;
  snapEnabled: boolean;
}

interface TimelineActions {
  addTrack: (type: TrackType, name?: string) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  reorderTracks: (fromIdx: number, toIdx: number) => void;
  setTimelineZoom: (z: number) => void;
  setScrollX: (x: number) => void;
  toggleSnap: () => void;
  setTracks: (tracks: Track[]) => void;
}

export type TimelineStore = TimelineState & TimelineActions;

export const useTimelineStore = create<TimelineStore>()((set) => ({
  tracks: [],
  timelineZoom: 80, // pixels per second
  scrollX: 0,
  snapEnabled: true,

  addTrack: (type, name) => {
    const id = uid();
    const defaultNames: Record<TrackType, string> = {
      video: 'Video',
      audio: 'Audio',
      text: 'Text',
      graphic: 'Graphic',
      subtitle: 'Subtitle',
    };
    const track: Track = {
      id,
      type,
      name: name || defaultNames[type],
      height: TRACK_HEIGHT,
      muted: false,
      locked: false,
      visible: true,
    };
    set((s) => ({ tracks: [...s.tracks, track] }));
    return id;
  },

  removeTrack: (id) =>
    set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),

  updateTrack: (id, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  reorderTracks: (fromIdx, toIdx) =>
    set((s) => {
      const next = [...s.tracks];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return { tracks: next };
    }),

  setTimelineZoom: (z) => set({ timelineZoom: Math.max(20, Math.min(400, z)) }),
  setScrollX: (x) => set({ scrollX: x }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setTracks: (tracks) => set({ tracks }),
}));
