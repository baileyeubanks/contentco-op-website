export const CONTENT_VIDEO_VERSION = "20260609a";

// Delivery renditions encoded from apps/home/media/cco-hero-supreme-master-2160-hevc.mp4.
// The master is an upscaled-1080p HEVC file, so 1080p H.264 is the highest real
// quality we can serve — and it plays in every browser (the HEVC original did not).
export const HERO_VIDEO_FILENAME = "hero-loop/cco-hero-supreme-1080.mp4";
export const HERO_VIDEO_MOBILE_FILENAME = "hero-loop/cco-hero-supreme-720.mp4";
export const HERO_POSTER_FILENAME = "hero-loop/cco-hero-poster.jpg";

export function heroMediaAsset(filename: string) {
  return `/media/${filename}?v=${CONTENT_VIDEO_VERSION}`;
}

export function isCurrentHeroMedia(filename: string) {
  return (
    filename === HERO_VIDEO_FILENAME ||
    filename === HERO_VIDEO_MOBILE_FILENAME ||
    filename === HERO_POSTER_FILENAME
  );
}

export const heroVideo = heroMediaAsset(HERO_VIDEO_FILENAME);
export const heroVideoMobile = heroMediaAsset(HERO_VIDEO_MOBILE_FILENAME);
export const heroPoster = heroMediaAsset(HERO_POSTER_FILENAME);
