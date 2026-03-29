export type TrackType = 'video' | 'audio' | 'text' | 'graphic' | 'subtitle';

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  height: number;
  muted: boolean;
  locked: boolean;
  visible: boolean;
}

export interface TimeRange {
  start: number;
  end: number;
}
