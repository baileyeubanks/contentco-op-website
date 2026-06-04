export const CONTENT_VIDEO_VERSION = "20260529k";

export const HERO_VIDEO_FILENAME = "hero-loop/cco-hero-supreme.mp4";
export const HERO_VIDEO_STREAM_PREFIX = "hero-loop/cco-hero-supreme-hls/";
export const HERO_VIDEO_STREAM_FILENAME = `${HERO_VIDEO_STREAM_PREFIX}index.m3u8`;

export function heroMediaAsset(filename: string) {
  return `/media/${filename}?v=${CONTENT_VIDEO_VERSION}`;
}

export function isCurrentHeroMedia(filename: string) {
  return filename === HERO_VIDEO_FILENAME || filename.startsWith(HERO_VIDEO_STREAM_PREFIX);
}

export const heroVideo = heroMediaAsset(HERO_VIDEO_FILENAME);
export const heroVideoStream = heroMediaAsset(HERO_VIDEO_STREAM_FILENAME);
