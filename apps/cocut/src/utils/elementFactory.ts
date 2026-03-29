import { uid } from './uid';
import { C } from '../theme/colors';
import type { Element, TextElement, ShapeElement, ImageElement, VideoElement, AudioElement, SubtitleElement, SubtitleCue } from '../types';

const baseDefaults = {
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  startTime: 0,
  duration: 10,
  animation: 'none' as const,
  animationExit: 'none' as const,
  animDuration: 0.6,
  animExitDuration: 0.6,
  easing: 'ease-out' as const,
  filter: 'none',
  blendMode: 'normal' as const,
  shadow: false,
  borderRadius: 0,
  trackId: '',
};

export function createTextElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    ...baseDefaults,
    id: uid(),
    type: 'text',
    name: overrides.content?.slice(0, 20) || 'Text',
    x: 160 + Math.random() * 200,
    y: 100 + Math.random() * 120,
    width: 200,
    height: 60,
    content: 'Your Text',
    fontSize: 32,
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    ...overrides,
  };
}

export function createShapeElement(
  shapeType: 'shape' | 'circle' = 'shape',
  overrides: Partial<ShapeElement> = {},
): ShapeElement {
  return {
    ...baseDefaults,
    id: uid(),
    type: shapeType,
    name: shapeType === 'circle' ? 'Circle' : 'Rectangle',
    x: 160 + Math.random() * 200,
    y: 100 + Math.random() * 120,
    width: 150,
    height: 150,
    fill: shapeType === 'circle' ? C.green : C.accent,
    stroke: 'none',
    strokeWidth: 2,
    borderRadius: shapeType === 'circle' ? 999 : 0,
    ...overrides,
  };
}

export function createImageElement(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    ...baseDefaults,
    id: uid(),
    type: 'image',
    name: overrides.name || 'Image',
    x: 160 + Math.random() * 200,
    y: 100 + Math.random() * 120,
    width: 320,
    height: 180,
    mediaAssetId: '',
    src: '',
    objectFit: 'cover',
    ...overrides,
  };
}

export function createVideoElement(overrides: Partial<VideoElement> = {}): VideoElement {
  return {
    ...baseDefaults,
    id: uid(),
    type: 'video',
    name: overrides.name || 'Video',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    mediaAssetId: '',
    src: '',
    trimIn: 0,
    trimOut: overrides.duration || 10,
    playbackRate: 1,
    volume: 1,
    muted: false,
    objectFit: 'contain',
    ...overrides,
  };
}

export function createAudioElement(overrides: Partial<AudioElement> = {}): AudioElement {
  return {
    ...baseDefaults,
    id: uid(),
    type: 'audio',
    name: overrides.name || 'Audio',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    mediaAssetId: '',
    src: '',
    trimIn: 0,
    trimOut: overrides.duration || 10,
    volume: 1,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    pan: 0,
    ...overrides,
  };
}

export function createSubtitleElement(
  cues: SubtitleCue[] = [],
  overrides: Partial<SubtitleElement> = {},
): SubtitleElement {
  return {
    ...baseDefaults,
    id: uid(),
    type: 'subtitle',
    name: 'Subtitles',
    x: 160,
    y: 900,
    width: 1600,
    height: 120,
    cues,
    fontSize: 48,
    fontFamily: 'Arial',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    position: 'bottom',
    ...overrides,
  };
}

export function createElement(type: string, overrides: Partial<Element> = {}): Element {
  switch (type) {
    case 'text': return createTextElement(overrides as Partial<TextElement>);
    case 'shape': return createShapeElement('shape', overrides as Partial<ShapeElement>);
    case 'circle': return createShapeElement('circle', overrides as Partial<ShapeElement>);
    case 'image': return createImageElement(overrides as Partial<ImageElement>);
    case 'video': return createVideoElement(overrides as Partial<VideoElement>);
    case 'audio': return createAudioElement(overrides as Partial<AudioElement>);
    case 'subtitle': return createSubtitleElement([], overrides as Partial<SubtitleElement>);
    default: return createTextElement(overrides as Partial<TextElement>);
  }
}
