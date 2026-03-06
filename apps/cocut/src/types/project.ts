import type { Element } from './element';
import type { Track } from './timeline';

export interface ProjectState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  resolution: { width: number; height: number };
  fps: number;
  tracks: Track[];
  elements: Element[];
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  waveformData?: number[];
  blobKey: string;
}
