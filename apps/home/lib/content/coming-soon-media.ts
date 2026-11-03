// Media of held films (see coming-soon.ts). The files are removed from public/,
// but older releases and edge caches knew these URLs, so proxy.ts answers 404
// for them until the replacement film ships. Imported by proxy.ts only.

export const COMING_SOON_MEDIA_PATHS: ReadonlySet<string> = new Set([
  "/cc/portfolio-cdn/el_paso_water_schneider_v15_web.mp4",
  "/cc/portfolio-cdn/preview_el_paso_water_v15.mp4",
]);

/** Expects the proxy's normalized (decoded, lowercased, no trailing slash) pathname. */
export function isComingSoonMediaPath(pathname: string) {
  return COMING_SOON_MEDIA_PATHS.has(pathname);
}
