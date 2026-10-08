import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { organizationJsonLd, SOCIAL_IMAGE_ALT, SOCIAL_IMAGE_PATH } from "../seo";

const home = path.resolve(import.meta.dirname, "../..");
const assets = path.join(home, "public/brand/assets/cco/logos/aperture");
const assetUrl = "/brand/assets/cco/logos/aperture/";
const read = (file: string) => readFileSync(file, "utf8");

function pngSize(file: string) {
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.toString("ascii", 12, 16)).toBe("IHDR");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("Content Co-op aperture branding", () => {
  it.each([
    ["header", path.resolve(home, "../../packages/ui/src/nav.tsx")],
    ["footer", path.join(home, "app/components/public-footer.tsx")],
  ])("uses the mark alone in the %s", (_label, file) => {
    const source = read(file);
    expect(source).toContain(`${assetUrl}aperture-mark.svg`);
    expect(source).toContain('alt="Content Co-op"');
    expect(source).not.toMatch(/lockup|LockUp_|contentco-op-logo/i);
  });

  it("advertises the mark-only social image and organization logo", () => {
    expect(SOCIAL_IMAGE_PATH).toBe("/cc/social/og-aperture-1200x630.png");
    expect(SOCIAL_IMAGE_ALT).toBe("Content Co-op");
    expect(new URL(organizationJsonLd.logo).pathname).toBe(`${assetUrl}aperture-mark-512.png`);
    expect(pngSize(path.join(home, "public", SOCIAL_IMAGE_PATH))).toEqual([1200, 630]);
  });

  it.each([
    ["aperture-mark", "#1e4d8c"],
    ["aperture-mark-cream", "#f3ebdf"],
    ["aperture-mark-currentcolor", "currentColor"],
  ])("exports accessible %s SVG with the original viewBox", (name, colour) => {
    const svg = read(path.join(assets, `${name}.svg`));
    expect(svg).toContain('viewBox="0 93 888 774"');
    expect(svg).toContain('role="img" aria-label="Content Co-op"');
    expect(svg).toContain("<title>Content Co-op</title>");
    expect(svg).toContain(`fill="${colour}"`);
    expect(svg).not.toContain("#" + ["0d", "54", "87"].join(""));
    expect(svg).not.toContain("#" + ["4c", "8e", "f5"].join(""));
  });

  it.each([512, 192, 32, 16])("exports both transparent square variants at %i px", (size) => {
    for (const name of ["aperture-mark", "aperture-mark-cream"]) {
      const file = path.join(assets, `${name}-${size}.png`);
      expect(pngSize(file)).toEqual([size, size]);
      expect(readFileSync(file)[25]).toBe(6); // RGBA IHDR colour type
    }
  });

  it("keeps the app and PWA icon dimensions", () => {
    expect(pngSize(path.join(home, "app/icon.png"))).toEqual([512, 512]);
    expect(pngSize(path.join(home, "app/apple-icon.png"))).toEqual([180, 180]);
    for (const size of [192, 512, 1204]) {
      expect(pngSize(path.join(home, `public/pwa/icon-${size}.png`))).toEqual([size, size]);
    }
  });

  it("keeps mark masks and CCO documents free of the lockup", () => {
    const css = read(path.join(home, "app/globals.css"));
    expect(css).toContain(`${assetUrl}aperture-mark-currentcolor.svg`);
    expect(css).not.toMatch(/lockup|LockUp_|contentco-op-logo/i);
    const documents = read(path.join(home, "lib/os-document-renderer.ts"));
    expect(documents).toContain(`${assetUrl}aperture-mark-512.png`);
    expect(documents).toContain('/brand/assets/acs/exports/logo-dark.png');
    expect(documents).not.toContain("contentco-op-logo.png");
    expect(readdirSync(assets).filter((file) => file.endsWith(".png"))).toHaveLength(8);
  });
});
