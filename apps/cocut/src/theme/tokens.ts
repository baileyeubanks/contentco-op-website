export const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_FAMILY_BRAND = "'Space Grotesk', 'Inter', sans-serif";
export const FONT_FAMILY_MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export const FONT_FAMILIES = [
  'Inter', 'Space Grotesk', 'Georgia', 'Courier New', 'Arial Black',
  'Trebuchet MS', 'Impact', 'Palatino', 'Garamond', 'Verdana', 'Roboto',
] as const;

export const TRACK_HEIGHT = 44;
export const LAYER_PANEL_WIDTH = 180;
export const PROPERTIES_PANEL_WIDTH = 260;
export const TOOLBAR_HEIGHT = 44;
export const TIMELINE_MIN_HEIGHT = 200;
export const MEDIA_BIN_HEIGHT = 180;

export const Z_INDEX = {
  canvas: 1,
  grid: 2,
  elements: 10,
  selection: 100,
  resizeHandles: 101,
  playhead: 200,
  contextMenu: 1000,
  modal: 2000,
  tooltip: 3000,
} as const;

export const DEFAULT_FPS = 30;
export const DEFAULT_RESOLUTION = { width: 1920, height: 1080 };
export const CANVAS_RESOLUTION = { width: 1920, height: 1080 };
