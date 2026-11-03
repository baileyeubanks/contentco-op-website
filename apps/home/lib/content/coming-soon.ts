// Approved films held back until their release is cleared (Bailey, 2026-11-03:
// El Paso Water is being re-cut and must not leak before launch). The portfolio
// keeps the card with a "Coming soon" banner and the case-study page shows a
// hold. The full entry waits in lib/content/held/; the manifest carries a shell.
// Client-safe: proxy-only media paths live in coming-soon-media.ts.

export const COMING_SOON_STUDY_IDS: ReadonlySet<string> = new Set(["el-paso-water"]);

export function isComingSoonStudy(id: string) {
  return COMING_SOON_STUDY_IDS.has(id);
}
