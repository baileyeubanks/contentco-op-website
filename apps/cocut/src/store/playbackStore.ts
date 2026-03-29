import { create } from 'zustand';
import type { TimeRange } from '../types';

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  loopEnabled: boolean;
  loopRange: TimeRange | null;
  duration: number;
}

interface PlaybackActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setDuration: (d: number) => void;
  toggleLoop: () => void;
  setLoopRange: (range: TimeRange | null) => void;
}

export type PlaybackStore = PlaybackState & PlaybackActions;

export const usePlaybackStore = create<PlaybackStore>()((set) => ({
  isPlaying: false,
  currentTime: 0,
  playbackRate: 1,
  loopEnabled: false,
  loopRange: null,
  duration: 30,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentTime: 0 }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  seek: (time) => set({ currentTime: Math.max(0, time), isPlaying: false }),

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),

  setPlaybackRate: (rate) => set({ playbackRate: rate }),

  setDuration: (d) => set({ duration: d }),

  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),

  setLoopRange: (range) => set({ loopRange: range }),
}));
