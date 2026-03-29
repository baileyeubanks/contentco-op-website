import { create } from 'zustand';

export type PanelTab = 'properties' | 'animate' | 'filters';

// NLE editing tools
export type TimelineTool = 'select' | 'blade' | 'ripple' | 'roll' | 'slide' | 'slip';

// Top-level app mode: edit = full NLE, cut = soundbite interview engine
export type AppMode = 'edit' | 'cut';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetId: string | null;
  targetType: 'element' | 'clip' | 'canvas' | 'media' | null;
}

// Composition presets with platform labels
export interface CompositionPreset {
  label: string;
  width: number;
  height: number;
  platform?: string;
}

export const COMPOSITION_PRESETS: CompositionPreset[] = [
  { label: '1920 × 1080', width: 1920, height: 1080, platform: 'YouTube / Full HD' },
  { label: '1080 × 1920', width: 1080, height: 1920, platform: 'TikTok / Reels / Shorts' },
  { label: '1080 × 1080', width: 1080, height: 1080, platform: 'Instagram Feed / X' },
  { label: '1080 × 1350', width: 1080, height: 1350, platform: 'Instagram Feed (4:5)' },
  { label: '3840 × 2160', width: 3840, height: 2160, platform: '4K UHD' },
  { label: '1280 × 720', width: 1280, height: 720, platform: 'HD 720p' },
  { label: '2560 × 1080', width: 2560, height: 1080, platform: 'Cinematic 21:9' },
  { label: '1440 × 1080', width: 1440, height: 1080, platform: 'Standard 4:3' },
];

interface UIState {
  appMode: AppMode;
  activeTab: PanelTab;
  showGrid: boolean;
  showMediaBin: boolean;
  showSubtitleEditor: boolean;
  showAutoCut: boolean;
  showNewProjectDialog: boolean;
  showProjectManager: boolean;
  contextMenu: ContextMenuState;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasBgColor: string;
  exportDialogOpen: boolean;
  timelineTool: TimelineTool;
}

interface UIActions {
  setAppMode: (mode: AppMode) => void;
  setActiveTab: (tab: PanelTab) => void;
  toggleGrid: () => void;
  toggleMediaBin: () => void;
  toggleSubtitleEditor: () => void;
  toggleAutoCut: () => void;
  setShowNewProjectDialog: (show: boolean) => void;
  toggleProjectManager: () => void;
  openContextMenu: (x: number, y: number, targetId: string | null, targetType: ContextMenuState['targetType']) => void;
  closeContextMenu: () => void;
  setZoom: (z: number) => void;
  setCanvasSize: (width: number, height: number) => void;
  setCanvasBgColor: (color: string) => void;
  setExportDialogOpen: (open: boolean) => void;
  setTimelineTool: (tool: TimelineTool) => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()((set) => ({
  appMode: 'edit',
  activeTab: 'properties',
  showGrid: true,
  showMediaBin: true,
  showSubtitleEditor: false,
  showAutoCut: false,
  showNewProjectDialog: false,
  showProjectManager: false,
  contextMenu: { visible: false, x: 0, y: 0, targetId: null, targetType: null },
  zoom: 0.5,
  canvasWidth: 1920,
  canvasHeight: 1080,
  canvasBgColor: '#111827',
  exportDialogOpen: false,
  timelineTool: 'select',

  setAppMode: (mode) => set({ appMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleMediaBin: () => set((s) => ({ showMediaBin: !s.showMediaBin })),
  toggleSubtitleEditor: () => set((s) => ({ showSubtitleEditor: !s.showSubtitleEditor })),
  toggleAutoCut: () => set((s) => ({ showAutoCut: !s.showAutoCut })),
  setShowNewProjectDialog: (show) => set({ showNewProjectDialog: show }),
  toggleProjectManager: () => set((s) => ({ showProjectManager: !s.showProjectManager })),

  openContextMenu: (x, y, targetId, targetType) =>
    set({ contextMenu: { visible: true, x, y, targetId, targetType } }),

  closeContextMenu: () =>
    set((s) => ({ contextMenu: { ...s.contextMenu, visible: false } })),

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(3, z)) }),
  setCanvasSize: (width, height) => set({ canvasWidth: width, canvasHeight: height }),
  setCanvasBgColor: (color) => set({ canvasBgColor: color }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setTimelineTool: (tool) => set({ timelineTool: tool }),
}));
