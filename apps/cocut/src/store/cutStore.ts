import { create } from 'zustand';
import type { TranscriptionResult } from '../services/whisperService';

export interface Soundbite {
  id: string;
  label: string;
  start: number;
  end: number;
  text: string;
}

export interface CutMarkers {
  in: number | null;
  out: number | null;
}

interface CutState {
  // Media
  audioUrl: string | null;
  fileName: string | null;
  duration: number;

  // Playback
  currentTime: number;
  isPlaying: boolean;

  // Transcription
  transcript: TranscriptionResult | null;
  transcribing: boolean;
  transcribeProgress: number;
  transcribePhase: string;

  // Markers
  markers: CutMarkers;

  // Soundbites
  soundbites: Soundbite[];

  // UI
  showExportModal: boolean;
  showSaveModal: boolean;
}

interface CutActions {
  setAudio: (url: string, fileName: string) => void;
  clearAudio: () => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  setDuration: (d: number) => void;
  setTranscript: (t: TranscriptionResult | null) => void;
  setTranscribing: (v: boolean, progress?: number, phase?: string) => void;
  setMarkerIn: (t: number | null) => void;
  setMarkerOut: (t: number | null) => void;
  saveSoundbite: (label: string) => void;
  deleteSoundbite: (id: string) => void;
  seekToTime: (t: number) => void;
  setShowExportModal: (v: boolean) => void;
  setShowSaveModal: (v: boolean) => void;
}

export type CutStore = CutState & CutActions;

// Seek callback — registered by InterviewWaveform audio element
let _seekCallback: ((t: number) => void) | null = null;
let _playCallback: ((v: boolean) => void) | null = null;

export function registerSeekCallback(cb: (t: number) => void) {
  _seekCallback = cb;
}

export function registerPlayCallback(cb: (v: boolean) => void) {
  _playCallback = cb;
}

export const useCutStore = create<CutStore>()((set, get) => ({
  audioUrl: null,
  fileName: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  transcript: null,
  transcribing: false,
  transcribeProgress: 0,
  transcribePhase: '',
  markers: { in: null, out: null },
  soundbites: [],
  showExportModal: false,
  showSaveModal: false,

  setAudio: (url, fileName) =>
    set({
      audioUrl: url,
      fileName,
      transcript: null,
      markers: { in: null, out: null },
      soundbites: [],
      currentTime: 0,
      isPlaying: false,
      duration: 0,
    }),

  clearAudio: () =>
    set({
      audioUrl: null,
      fileName: null,
      transcript: null,
      markers: { in: null, out: null },
      soundbites: [],
      currentTime: 0,
      isPlaying: false,
      duration: 0,
    }),

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (v) => {
    set({ isPlaying: v });
    _playCallback?.(v);
  },
  setDuration: (d) => set({ duration: d }),
  setTranscript: (t) => set({ transcript: t }),
  setTranscribing: (v, progress = 0, phase = '') =>
    set({ transcribing: v, transcribeProgress: progress, transcribePhase: phase }),

  setMarkerIn: (t) => set((s) => ({ markers: { ...s.markers, in: t } })),
  setMarkerOut: (t) => set((s) => ({ markers: { ...s.markers, out: t } })),

  saveSoundbite: (label) => {
    const { markers, transcript, currentTime, duration } = get();
    const inPt = markers.in ?? 0;
    const outPt = markers.out ?? Math.min(currentTime + 5, duration);
    if (inPt >= outPt) return;

    const words = transcript?.words ?? [];
    const text = words
      .filter((w) => w.start >= inPt && w.end <= outPt)
      .map((w) => w.word)
      .join(' ')
      .trim();

    const sb: Soundbite = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      start: inPt,
      end: outPt,
      text,
    };

    set((s) => ({
      soundbites: [...s.soundbites, sb],
      markers: { in: null, out: null },
      showSaveModal: false,
    }));
  },

  deleteSoundbite: (id) =>
    set((s) => ({ soundbites: s.soundbites.filter((b) => b.id !== id) })),

  seekToTime: (t) => {
    set({ currentTime: t });
    _seekCallback?.(t);
  },

  setShowExportModal: (v) => set({ showExportModal: v }),
  setShowSaveModal: (v) => set({ showSaveModal: v }),
}));
