export const C = {
  // Backgrounds — near-black with subtle blue undertone
  bg: '#060a10',
  surface: '#0c1118',
  surface2: '#131a24',
  surface3: '#1a2332',
  canvasBg: '#111827',

  // Borders
  border: '#1e2d3d',
  border2: '#2a3f54',

  // Text
  text: '#e2e8f0',
  textDim: '#7b8fa3',
  textMuted: '#546578',

  // Primary — deep rich blue
  accent: '#2563eb',
  accent2: '#60a5fa',
  accentGlow: 'rgba(37,99,235,0.25)',
  accentDark: '#1d4ed8',

  // Hover/interactive
  surfaceHover: '#172033',

  // Semantic
  green: '#22c55e',
  orange: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899',
  blue: '#3b82f6',
  teal: '#14b8a6',

  // Status
  success: '#22c55e',
  warning: '#fbbf24',
  error: '#dc2626',
} as const;

export const ELEMENT_COLORS: Record<string, string> = {
  text: C.accent2,
  shape: C.teal,
  circle: C.teal,
  image: C.orange,
  video: C.pink,
  audio: C.blue,
  subtitle: C.warning,
};
