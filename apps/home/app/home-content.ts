import {
  CONTENT_VIDEO_VERSION,
  heroVideo as currentHeroVideo,
  heroVideoMobile as currentHeroVideoMobile,
  heroPoster as currentHeroPoster,
  isCurrentHeroMedia,
} from "./hero-video-config";

export type MosaicTile = {
  type: "photo" | "video";
  src: string;
  alt: string;
  label: string;
  tag: string;
  /** CSS object-position override for crop variety — e.g. "center 20%" */
  crop?: string;
};

export type GalleryImage = {
  src: string;
  alt: string;
  label: string;
  tag: string;
};

export type HeroScene = {
  id: string;
  clip: string;
  label: string;
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  lede: string;
  subtitle: string;
  emphasis: string;
};

const PUBLIC_MEDIA_BASE = "/media";
const CC_VIDEO_BASE = "/cc/video";

export function videoAsset(filename: string) {
  if (isCurrentHeroMedia(filename)) {
    return `${PUBLIC_MEDIA_BASE}/${filename}?v=${CONTENT_VIDEO_VERSION}`;
  }

  return `${CC_VIDEO_BASE}/${filename}?v=${CONTENT_VIDEO_VERSION}`;
}

export const heroVideo = currentHeroVideo;
export const heroVideoMobile = currentHeroVideoMobile;
export const heroPoster = currentHeroPoster;

const heroClipIds = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 35, 36, 37, 38,
] as const;

const heroNarratives = [
  {
    kicker: "Industrial Storytelling",
    headlineLead: "Crews, control rooms,",
    headlineAccent: "and the real work.",
    lede:
      "From refinery floors to field teams, the work starts with footage that already feels true under scrutiny.",
    subtitle:
      "Operators. assets. environments. production-ready footage that carries the story from first impression to final approval.",
    emphasis: "Field credibility",
  },
  {
    kicker: "Field-To-Boardroom Flow",
    headlineLead: "Field capture,",
    headlineAccent: "without the fluff.",
    lede:
      "The strongest industrial work starts with believable footage, not staged atmosphere. Every scene is built to feel operationally honest.",
    subtitle:
      "No stock-feeling gloss. No generic energy montage. Just signal-rich scenes that land with weight.",
    emphasis: "Operational honesty",
  },
  {
    kicker: "Real Operating Context",
    headlineLead: "Plants, people,",
    headlineAccent: "and operating reality.",
    lede:
      "This reel is built from environments where the message has to stay accurate under pressure, not just look cinematic for three seconds.",
    subtitle:
      "Infrastructure. energy. heavy industry. The work only earns trust when the screen feels true to the environment.",
    emphasis: "Built for trust",
  },
  {
    kicker: "Narrative Discipline",
    headlineLead: "Capture first,",
    headlineAccent: "then shape the signal.",
    lede:
      "Strategy, production, edit, approvals, and delivery all get easier when the footage already contains the right signal.",
    subtitle:
      "The homepage should feel like the same production system that later produces scripts, edits, reviews, and delivery.",
    emphasis: "End-to-end system",
  },
  {
    kicker: "Production Credibility",
    headlineLead: "Access, pressure,",
    headlineAccent: "and polished output.",
    lede:
      "The point is not just visual style. It is turning complex environments into footage that survives executive review and client approvals.",
    subtitle:
      "This is brand work that can hold up in real operating environments, not a disconnected mood piece.",
    emphasis: "Production-grade",
  },
  {
    kicker: "Content Co-Op",
    headlineLead: "Real crews,",
    headlineAccent: "clearer signal.",
    lede:
      "The home page now leads with the same archive, discipline, and visual confidence that drives the actual work.",
    subtitle:
      "Industrial stories shaped for teams who need clarity, credibility, and speed at the same time.",
    emphasis: "Maximum signal",
  },
] as const;

export const heroScenes: readonly HeroScene[] = heroClipIds.map((id, index) => {
  const narrative = heroNarratives[index % heroNarratives.length];
  return {
    id: `hero-${id}`,
    clip: videoAsset(`hero-${id}.mp4`),
    label: `Archive ${String(id).padStart(2, "0")}`,
    ...narrative,
  };
});

export const boardroomBleedImages: readonly string[] = [
  "/cc/photos/gallery-control-room.jpg",
  "/cc/photos/gallery-machinist-cnc.jpg",
  "/cc/photos/gallery-fire-gear-rack.jpg",
  "/cc/photos/gallery-crew-refinery.jpg",
];

// ── All unique photos ────────────────────────────────────────
const PHOTOS: readonly GalleryImage[] = [
  { src: "/cc/photos/gallery-control-room.jpg", alt: "BP control room operator monitoring screens", label: "Whiting Refinery", tag: "Production" },
  { src: "/cc/photos/gallery-drone-platform.jpg", alt: "DJI Inspire drone on offshore platform", label: "Aerial Unit", tag: "BTS" },
  { src: "/cc/photos/gallery-crew-refinery.jpg", alt: "CC crew prepping gimbal at refinery", label: "BP Whiting", tag: "BTS" },
  { src: "/cc/photos/gallery-crew-field-shoot.jpg", alt: "CC crew shooting in tall grass", label: "Fowler Ridge", tag: "BTS" },
  { src: "/cc/photos/gallery-machinist-cnc.jpg", alt: "Machinist operating CNC mill", label: "Precision MFG", tag: "Industrial" },
  { src: "/cc/photos/gallery-fire-gear-rack.jpg", alt: "Fire gear rack with American flag patch", label: "First Response", tag: "Safety" },
  { src: "/cc/photos/gallery-kodiak-crew.jpg", alt: "Kodiak field crew in hard hats", label: "Permian Basin", tag: "Upstream" },
  { src: "/cc/photos/gallery-lineman-boom.jpg", alt: "Lineman with boom mic reflector", label: "Wind Farm", tag: "Production" },
  { src: "/cc/photos/gallery-campus-sunflare.jpg", alt: "Corporate campus walkway at golden hour", label: "BP Houston", tag: "Corporate" },
  { src: "/cc/photos/gallery-ceraweek-speaker.jpg", alt: "CeraWeek conference speaker", label: "CeraWeek", tag: "Events" },
  { src: "/cc/photos/fowler-wind-turbine.jpg", alt: "Wind turbine blade assembly at Fowler Ridge", label: "Fowler Ridge", tag: "Wind" },
  { src: "/cc/photos/whiting-refinery-sunset.jpg", alt: "Whiting Refinery skyline at golden hour", label: "Whiting Refinery", tag: "Downstream" },
  { src: "/cc/photos/gallery-wind-turbine-crane.jpg", alt: "Wind turbine crane lift at height", label: "Crane Lift", tag: "Wind" },
  { src: "/cc/photos/gallery-refinery-mountains.jpg", alt: "Refinery with snow-capped mountains", label: "Cherry Point", tag: "Downstream" },
  { src: "/cc/photos/gallery-helipad-sunset.jpg", alt: "Offshore helipad at golden hour", label: "Atlantis", tag: "Offshore" },
  { src: "/cc/photos/gallery-aerial-solar.jpg", alt: "Aerial view of solar farm", label: "Solar Array", tag: "Renewables" },
  { src: "/cc/photos/gallery-bp-tower-drone.jpg", alt: "BP tower drone shot at dusk", label: "Houston HQ", tag: "Corporate" },
  { src: "/cc/photos/gallery-desert-tanks.jpg", alt: "Desert storage tanks at golden hour", label: "Permian Basin", tag: "Upstream" },
  { src: "/cc/photos/gallery-refinery-pink-sunset.jpg", alt: "Refinery skyline with pink sunset and steam", label: "Whiting", tag: "Downstream" },
  { src: "/cc/photos/gallery-gas-station-sunset.jpg", alt: "Gas station at sunset", label: "Retail", tag: "Downstream" },
  { src: "/cc/photos/seagull-rope-access.jpg", alt: "Rope access workers on offshore platform", label: "Project Seagull", tag: "Offshore" },
  { src: "/cc/photos/bailey-red-camera.jpg", alt: "Bailey Eubanks with RED cinema camera", label: "On Set", tag: "BTS" },
  { src: "/cc/photos/gallery-pipe-whip-fast.jpg", alt: "Fast pipe whip safety training", label: "Safety Training", tag: "Safety" },
  { src: "/cc/photos/solar-panel-workers.jpg", alt: "Solar panel installation crew", label: "Solar Install", tag: "Renewables" },
  { src: "/cc/photos/gallery-schneider-epc-houston.jpg", alt: "Schneider Electric EPC Houston panel discussion with executives on stage", label: "EPC Houston 2026", tag: "Events" },
];

// ── Crop variants for reuse — same photo, different crop ─────
const CROP_VARIANTS: readonly MosaicTile[] = [
  { type: "photo", ...PHOTOS[0], crop: "center 30%", label: "Control Room Detail" },
  { type: "photo", ...PHOTOS[2], crop: "left center", label: "Gimbal Prep" },
  { type: "photo", ...PHOTOS[4], crop: "center 80%", label: "CNC Detail" },
  { type: "photo", ...PHOTOS[6], crop: "right center", label: "Field Crew" },
  { type: "photo", ...PHOTOS[7], crop: "center 20%", label: "Boom Op" },
  { type: "photo", ...PHOTOS[9], crop: "center 40%", label: "Stage" },
  { type: "photo", ...PHOTOS[10], crop: "center 70%", label: "Blade Assembly" },
  { type: "photo", ...PHOTOS[11], crop: "left 40%", label: "Golden Hour" },
  { type: "photo", ...PHOTOS[12], crop: "center 30%", label: "Crane Top" },
  { type: "photo", ...PHOTOS[13], crop: "right 60%", label: "Mountain View" },
  { type: "photo", ...PHOTOS[14], crop: "center 80%", label: "Helipad" },
  { type: "photo", ...PHOTOS[15], crop: "center 20%", label: "Panels" },
  { type: "photo", ...PHOTOS[16], crop: "center 70%", label: "Tower Dusk" },
  { type: "photo", ...PHOTOS[17], crop: "left 50%", label: "Tank Farm" },
  { type: "photo", ...PHOTOS[18], crop: "right 30%", label: "Pink Sky" },
  { type: "photo", ...PHOTOS[19], crop: "center 60%", label: "Retail" },
  { type: "photo", ...PHOTOS[20], crop: "center 40%", label: "Rope Access" },
  { type: "photo", ...PHOTOS[1], crop: "center 70%", label: "Drone Close" },
  { type: "photo", ...PHOTOS[3], crop: "right 40%", label: "Tall Grass" },
  { type: "photo", ...PHOTOS[5], crop: "left 50%", label: "Gear Rack" },
  { type: "photo", ...PHOTOS[8], crop: "center 80%", label: "Campus Walk" },
  { type: "photo", ...PHOTOS[21], crop: "center 30%", label: "RED Camera" },
  { type: "photo", ...PHOTOS[22], crop: "center center", label: "Pipe Whip" },
  { type: "photo", ...PHOTOS[23], crop: "center 40%", label: "Solar Crew" },
];

// ── 20 video tiles ───────────────────────────────────────────
const VIDEO_TILES: readonly MosaicTile[] = Array.from({ length: 20 }, (_, i) => ({
  type: "video" as const,
  src: `${PUBLIC_MEDIA_BASE}/hero/hero-${i + 1}.mp4`,
  alt: `Field production clip ${i + 1}`,
  label: "",
  tag: "Film",
}));

// ── Build the mosaic: 24 photos + 24 crop variants + 20 videos = 68 tiles ──
// Interleave: every ~3 photos, drop in a video
function buildMosaic(): MosaicTile[] {
  const photos: MosaicTile[] = PHOTOS.map((p) => ({ type: "photo", ...p }));
  const allPhotos = [...photos, ...CROP_VARIANTS];
  const videos = [...VIDEO_TILES];
  const result: MosaicTile[] = [];

  let photoIdx = 0;
  let videoIdx = 0;

  while (photoIdx < allPhotos.length || videoIdx < videos.length) {
    // Drop 3 photos then 1 video
    for (let j = 0; j < 3 && photoIdx < allPhotos.length; j++) {
      result.push(allPhotos[photoIdx++]);
    }
    if (videoIdx < videos.length) {
      result.push(videos[videoIdx++]);
    }
  }

  return result;
}

export const mosaicTiles: readonly MosaicTile[] = buildMosaic();

const HOME_WALL_PHOTOS: readonly GalleryImage[] = Array.from({ length: 59 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    src: `/cc/photos/home-wall/cco-new-${number}.jpg`,
    alt: `Content Co-op field production photo ${number}`,
    label: `Field Archive ${number}`,
    tag: "Field",
  };
});

// Legacy export for backward compat
export const galleryImages = [...PHOTOS, ...HOME_WALL_PHOTOS] as const;
