export type ElementType = 'text' | 'shape' | 'circle' | 'image' | 'video' | 'audio' | 'subtitle';

export type AnimationType =
  | 'none' | 'fadeIn' | 'fadeOut' | 'slideLeft' | 'slideRight' | 'slideUp'
  | 'scaleUp' | 'scaleDown' | 'rotateIn' | 'bounceIn' | 'typewriter' | 'blurIn' | 'glitch';

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  startTime: number;
  duration: number;
  animation: AnimationType;
  animationExit: AnimationType;
  animDuration: number;
  animExitDuration: number;
  easing: EasingType;
  filter: string;
  blendMode: BlendMode;
  shadow: boolean;
  borderRadius: number;
  trackId: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
}

export interface ShapeElement extends BaseElement {
  type: 'shape' | 'circle';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  mediaAssetId: string;
  src: string;
  objectFit: 'cover' | 'contain' | 'fill';
}

export interface VideoElement extends BaseElement {
  type: 'video';
  mediaAssetId: string;
  src: string;
  trimIn: number;
  trimOut: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  objectFit: 'cover' | 'contain' | 'fill';
}

export interface AudioElement extends BaseElement {
  type: 'audio';
  mediaAssetId: string;
  src: string;
  trimIn: number;
  trimOut: number;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  pan: number;
}

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitleElement extends BaseElement {
  type: 'subtitle';
  cues: SubtitleCue[];
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'top' | 'center' | 'bottom';
}

export type Element = TextElement | ShapeElement | ImageElement | VideoElement | AudioElement | SubtitleElement;

export const ANIMATIONS: { label: string; value: AnimationType }[] = [
  { label: 'None', value: 'none' },
  { label: 'Fade In', value: 'fadeIn' },
  { label: 'Fade Out', value: 'fadeOut' },
  { label: 'Slide Left', value: 'slideLeft' },
  { label: 'Slide Right', value: 'slideRight' },
  { label: 'Slide Up', value: 'slideUp' },
  { label: 'Scale Up', value: 'scaleUp' },
  { label: 'Scale Down', value: 'scaleDown' },
  { label: 'Rotate In', value: 'rotateIn' },
  { label: 'Bounce In', value: 'bounceIn' },
  { label: 'Typewriter', value: 'typewriter' },
  { label: 'Blur In', value: 'blurIn' },
  { label: 'Glitch', value: 'glitch' },
];

export const FILTERS: { label: string; value: string }[] = [
  { label: 'None', value: 'none' },
  { label: 'Grayscale', value: 'grayscale(100%)' },
  { label: 'Sepia', value: 'sepia(80%)' },
  { label: 'Blur', value: 'blur(2px)' },
  { label: 'Brightness', value: 'brightness(1.3)' },
  { label: 'Contrast', value: 'contrast(1.5)' },
  { label: 'Saturate', value: 'saturate(2)' },
  { label: 'Hue Rotate', value: 'hue-rotate(90deg)' },
  { label: 'Invert', value: 'invert(100%)' },
];

export const BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
export const EASING_TYPES: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bounce'];
