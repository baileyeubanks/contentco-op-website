/**
 * SubtitlePresets — Predefined subtitle animation styles
 * Styles: default, karaoke, typewriter, bounce
 * Stored as JSON-serializable configs
 */

export type SubtitlePresetStyle = 'default' | 'karaoke' | 'typewriter' | 'bounce';

export interface SubtitlePresetConfig {
  style: SubtitlePresetStyle;
  label: string;
  description: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
  animation: 'none' | 'fadeIn' | 'typewriter' | 'bounceIn';
  animDuration: number;
  highlightColor?: string;
  letterDelay?: number;
}

export const SUBTITLE_PRESETS: SubtitlePresetConfig[] = [
  {
    style: 'default',
    label: 'Default',
    description: 'Clean white text on dark background',
    fontSize: 32,
    fontFamily: 'sans-serif',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    position: 'bottom',
    animation: 'fadeIn',
    animDuration: 0.3,
  },
  {
    style: 'karaoke',
    label: 'Karaoke',
    description: 'Word-by-word highlight as audio plays',
    fontSize: 36,
    fontFamily: 'sans-serif',
    color: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.7)',
    position: 'bottom',
    animation: 'none',
    animDuration: 0,
    highlightColor: '#FBBC04',
  },
  {
    style: 'typewriter',
    label: 'Typewriter',
    description: 'Appears letter by letter',
    fontSize: 30,
    fontFamily: "'Courier New', monospace",
    color: '#ffffff',
    backgroundColor: 'transparent',
    position: 'bottom',
    animation: 'typewriter',
    animDuration: 0.05,
    letterDelay: 50,
  },
  {
    style: 'bounce',
    label: 'Bounce',
    description: 'Pops in with bounce animation',
    fontSize: 40,
    fontFamily: 'sans-serif',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'center',
    animation: 'bounceIn',
    animDuration: 0.6,
  },
];

/**
 * Get a preset config by style name
 */
export function getSubtitlePreset(style: SubtitlePresetStyle): SubtitlePresetConfig {
  return SUBTITLE_PRESETS.find((p) => p.style === style) || SUBTITLE_PRESETS[0];
}

/**
 * Render subtitle text with preset animation
 */
interface PresetSubtitleProps {
  text: string;
  preset: SubtitlePresetConfig;
  progress: number; // 0-1 for animation progress
  wordIndex?: number; // for karaoke: which word is highlighted
}

export function PresetSubtitle({ text, preset, progress, wordIndex }: PresetSubtitleProps) {
  const baseStyle: React.CSSProperties = {
    fontSize: preset.fontSize * 0.5, // scale for viewport
    fontFamily: preset.fontFamily,
    color: preset.color,
    background: preset.backgroundColor,
    padding: '6px 16px',
    borderRadius: 4,
    display: 'inline-block',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    fontWeight: 600,
    lineHeight: 1.4,
    maxWidth: '80%',
  };

  // Default: fade in
  if (preset.style === 'default') {
    const opacity = Math.min(progress / 0.3, 1);
    return <span style={{ ...baseStyle, opacity }}>{text}</span>;
  }

  // Karaoke: highlight words progressively
  if (preset.style === 'karaoke') {
    const words = text.split(' ');
    const highlightIdx = wordIndex ?? Math.floor(progress * words.length);
    return (
      <span style={baseStyle}>
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              color: i <= highlightIdx ? (preset.highlightColor || '#FBBC04') : preset.color,
              transition: 'color 0.15s ease',
              marginRight: 6,
            }}
          >
            {word}
          </span>
        ))}
      </span>
    );
  }

  // Typewriter: reveal characters
  if (preset.style === 'typewriter') {
    const chars = Math.floor(progress * text.length);
    const visible = text.slice(0, chars);
    return (
      <span style={baseStyle}>
        {visible}
        <span style={{ opacity: Math.sin(Date.now() / 300) > 0 ? 1 : 0, color: preset.color }}>|</span>
      </span>
    );
  }

  // Bounce: scale up with overshoot
  if (preset.style === 'bounce') {
    let scale = 0;
    if (progress < 0.4) {
      scale = (progress / 0.4) * 1.2;
    } else if (progress < 0.6) {
      scale = 1.2 - ((progress - 0.4) / 0.2) * 0.3;
    } else if (progress < 0.8) {
      scale = 0.9 + ((progress - 0.6) / 0.2) * 0.15;
    } else {
      scale = 1.05 - ((progress - 0.8) / 0.2) * 0.05;
    }
    return (
      <span style={{ ...baseStyle, transform: `scale(${scale})`, display: 'inline-block' }}>
        {text}
      </span>
    );
  }

  return <span style={baseStyle}>{text}</span>;
}
