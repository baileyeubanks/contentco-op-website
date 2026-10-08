import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { galleryImages } from "../../app/home-content";

// Bailey's rule: every homepage gallery tile is the same size and aspect ratio
// at every breakpoint, with no empty cells. The grid is 8 columns on desktop and
// 4 columns at <=980px, so the slot count must divide by both.
const appDir = path.resolve(__dirname, "../../app");
const page = fs.readFileSync(path.join(appDir, "page.tsx"), "utf8");
const css = fs.readFileSync(path.join(appDir, "globals.css"), "utf8");
const gallery = fs.readFileSync(path.join(appDir, "rotating-gallery.tsx"), "utf8");

function prop(name: string): number {
  const block = page.slice(page.indexOf("<RotatingGallery"));
  const match = block.match(new RegExp(`${name}=\\{(\\d+)\\}`));
  if (!match) throw new Error(`RotatingGallery ${name} prop missing`);
  return Number(match[1]);
}

describe("homepage gallery stays a uniform, fully filled grid", () => {
  test("slot count fills every row at 8 and 4 columns", () => {
    const columns = prop("columns");
    const rows = prop("rows");
    expect(columns).toBe(8);
    const slots = columns * rows;
    expect(slots % 8).toBe(0);
    expect(slots % 4).toBe(0);
    expect(galleryImages.length).toBeGreaterThanOrEqual(slots);
  });

  test("tiles are one fixed 16:9 size with no span or feature tiles", () => {
    expect(gallery).toContain('className="gallery gallery--uniform"');
    expect(gallery).not.toMatch(/gridColumn|gridRow|feature|gallery-item--|data-gallery-span/i);
    const galleryRules = css.match(/\.gallery(-item)?\s*\{[^}]*\}/g) ?? [];
    expect(galleryRules.length).toBeGreaterThan(0);
    for (const rule of galleryRules) {
      expect(rule).not.toMatch(/grid-(row|column)\s*:|span\s+\d/);
      if (rule.includes("grid-template-columns")) {
        expect(rule).toMatch(/minmax\(0,\s*1fr\)/);
      }
    }
    expect(css).toMatch(/\.gallery-item\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
  });

  test("gallery photo sources are unique", () => {
    const srcs = galleryImages.map((image) => image.src);
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});
