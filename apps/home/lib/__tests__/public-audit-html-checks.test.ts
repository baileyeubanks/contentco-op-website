import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
// @ts-expect-error -- plain .mjs script module without type declarations
import { htmlChecks, readHeroVideoMarker } from "../../scripts/public-audit-html-checks.mjs";

// audit-public-runtime.mjs is the final step of publish:live. Each `required`
// marker must be in what the page renders today; a stale marker fails the
// audit (exit 1) after the live swap even when nothing is wrong, as
// "cco-hero-supreme" and "Request access" did on the 2026-10-08 hotfix publish.
type HtmlCheck = { label: string; url: string; required: string[]; normalizedRequired?: string[]; forbidden: string[] };
const checks = htmlChecks as HtmlCheck[];

const appRoot = path.resolve(__dirname, "../..");
const sourceRoots = ["app", "lib", "content"].map((dir) => path.join(appRoot, dir));
const sourceExtensions = /\.(tsx?|mjs|js|json|md|txt|css)$/;

function readSources(): string[] {
  const texts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__" && entry.name !== "node_modules") walk(full);
      } else if (sourceExtensions.test(entry.name)) {
        texts.push(fs.readFileSync(full, "utf8"));
      }
    }
  };
  for (const root of sourceRoots) if (fs.existsSync(root)) walk(root);
  return texts;
}

// Markers the page builds from two source values rather than one literal.
const composedMarkers: Record<string, string[]> = {
  // lib/seo.ts builds `${study.client} ${display title}` from lib/content/portfolio-manifest.json
  "Metallic Products Family-Built": ['"client": "Metallic Products"', '"title": "Family-Built"'],
};

function check(label: string): HtmlCheck {
  const found = checks.find((item) => item.label === label);
  if (!found) throw new Error(`audit check ${label} missing`);
  return found;
}

describe("publish:live final audit copy markers match the current source", () => {
  test("the two retired markers are gone", () => {
    const required = checks.flatMap((item) => [...item.required, ...(item.normalizedRequired ?? [])]);
    expect(required).not.toContain("cco-hero-supreme");
    expect(required).not.toContain("Request access");
  });

  test("homepage requires the configured hero video, which app/page.tsx renders", () => {
    const config = fs.readFileSync(path.join(appRoot, "app/hero-video-config.ts"), "utf8");
    const page = fs.readFileSync(path.join(appRoot, "app/page.tsx"), "utf8");
    const marker = readHeroVideoMarker();
    expect(marker).toMatch(/^cco-hero-[a-z0-9-]+\.mp4$/);
    expect(config).toContain(`HERO_VIDEO_FILENAME = "hero-loop/${marker}"`);
    expect(page).toMatch(/nextSrc=\{heroVideo\}/);
    expect(check("homepage copy").required).toContain(marker);
  });

  test("suite requires its current card CTA, rendered by app/suite/page.tsx", () => {
    const suite = fs.readFileSync(path.join(appRoot, "app/suite/page.tsx"), "utf8");
    for (const marker of check("suite copy").required) {
      expect(suite, marker).toContain(marker);
    }
    expect(check("suite copy").required).toContain("Open Co-VideoPro");
  });

  test("every required marker exists in the app source", () => {
    const sources = readSources();
    const missing: string[] = [];
    for (const item of checks) {
      for (const marker of [...item.required, ...(item.normalizedRequired ?? [])]) {
        const parts = composedMarkers[marker] ?? [marker];
        if (!parts.every((part) => sources.some((text) => text.includes(part)))) {
          missing.push(`${item.label}: ${marker}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
