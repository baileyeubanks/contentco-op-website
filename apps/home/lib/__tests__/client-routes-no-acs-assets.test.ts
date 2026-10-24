import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, test } from "vitest";

// Blaze rulings 2026-10-08 02:17 and 02:32: the CCO client routes must not render
// Astro Cleaning Services (ACS) brand assets. The header mark is the Content Co-op
// aperture (6-blade swirl, mark only, never the lockup), alt "Content Co-op". The
// mark keeps its own logo blue #0d5487 on light grounds and the mono cream mark on
// dark grounds; Sapphire #1e4d8c is for UI accents only and never colours the mark.
// This test walks every file under app/client/** plus every local module those
// files import (relative, "@/..." and "@contentco-op/<pkg>/..." paths,
// transitively) and fails if any asset reference points at an ACS asset, then
// decodes every mark asset those routes reference and fails on a Sapphire fill.

const homeDir = path.resolve(__dirname, "../..");
const repoDir = path.resolve(homeDir, "../..");
const clientDir = path.join(homeDir, "app/client");
const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"];

// Light ground (white header in app/client/layout.tsx): logo-blue mark from main.
const APERTURE_MARK = "/brand/assets/cco/logos/optimized/spiral-hq-400.png";
// Dark ground (#1B4F72 quote header): mono cream mark (same file as PR #21's export).
const APERTURE_MARK_CREAM = "/brand/assets/cco/logos/aperture/aperture-mark-cream.svg";
const LOGO_BLUE = "0d5487";
const CREAM = "f3ebdf";
const SAPPHIRE = "1e4d8c";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return SOURCE_EXTENSIONS.includes(path.extname(entry.name)) ? [full] : [];
  });
}

function resolveFile(base: string): string | null {
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext), ...SOURCE_EXTENSIONS.map((ext) => path.join(base, "index" + ext))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith(".")) return resolveFile(path.resolve(path.dirname(fromFile), specifier));
  if (specifier.startsWith("@/")) return resolveFile(path.join(homeDir, specifier.slice(2)));
  const workspace = specifier.match(/^@contentco-op\/([^/]+)(?:\/(.*))?$/);
  if (workspace) {
    for (const group of ["packages", "apps", "services"]) {
      const pkgDir = path.join(repoDir, group, workspace[1]);
      if (fs.existsSync(pkgDir)) return resolveFile(path.join(pkgDir, workspace[2] ?? "src/index"));
    }
  }
  return null; // third-party package: not part of the CCO client route source
}

const IMPORT_RE = /(?:import|export)\s+(?:[^"'`;]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

function collectClientRouteFiles(): string[] {
  const seen = new Set<string>();
  const queue = walk(clientDir);
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(file, match[1] ?? match[2] ?? match[3]);
      if (resolved && !resolved.includes(`${path.sep}node_modules${path.sep}`) && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen].sort();
}

// A string literal or CSS url() whose value looks like a static asset path.
const QUOTED_RE = /(["'`])((?:(?!\1)[^\n\\]|\\.)*)\1|url\(\s*([^)"'\s]+)\s*\)/g;
const ASSET_LIKE_RE = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?|eps|ai|pdf|woff2?|ttf|otf|mp4|webm|mov)(?:[?#]|$)|^\/?(?:brand|cc|logos|images?|img|assets|media|static|public)\//i;
// ACS tokens, case-insensitive, bounded so "Astronomy", "races" or "acsii" never match.
const ACS_ASSET_TOKEN_RE = /(?<![a-z0-9])(?:logo[-_]?texas|astro(?:[-_]?cleanings?)?|acs(?=[-_/.])|acs$)(?![a-z0-9])/i;

function assetReferences(source: string): string[] {
  const refs: string[] = [];
  for (const match of source.matchAll(QUOTED_RE)) {
    const value = (match[2] ?? match[3] ?? "").trim();
    if (value && ASSET_LIKE_RE.test(value)) refs.push(value);
  }
  return refs;
}

function acsAssetHits(files: string[]) {
  return files.flatMap((file) =>
    assetReferences(fs.readFileSync(file, "utf8"))
      .filter((ref) => ref.split(/[/?#]/).some((segment) => ACS_ASSET_TOKEN_RE.test(segment)))
      .map((ref) => `${path.relative(repoDir, file)}: ${ref}`),
  );
}

// ---- mark colour extraction (SVG fills/strokes; 8-bit RGB/RGBA non-interlaced PNG) ----
function nearHex(hex: string, target: string, tolerance = 6) {
  const a = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [0, 2, 4].map((i) => parseInt(target.slice(i, i + 2), 16));
  return a.every((value, i) => Math.abs(value - b[i]) <= tolerance);
}

function svgColours(source: string): Set<string> {
  const colours = new Set<string>();
  for (const match of source.matchAll(/(?:fill|stroke|stop-color|color)\s*[=:]\s*["']?\s*(#[0-9a-f]{3,8}|[a-z]+)/gi)) {
    let value = match[1].toLowerCase();
    if (value === "none" || value === "currentcolor" || value === "transparent") continue;
    if (/^#[0-9a-f]{3}$/.test(value)) value = "#" + [...value.slice(1)].map((c) => c + c).join("");
    colours.add(value.replace(/^#/, "").slice(0, 6));
  }
  return colours;
}

function pngColours(buffer: Buffer): Set<string> {
  expect(buffer.subarray(1, 4).toString("latin1")).toBe("PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("latin1");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8], "bit depth").toBe(8);
      expect([2, 6], "colour type").toContain(data[9]);
      expect(data[12], "interlace").toBe(0);
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const prev = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  const counts = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = prev[x];
      const upLeft = x >= channels ? prev[x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      row[x] = (line[x] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const i = x * channels;
      if (channels === 4 && row[i + 3] < 200) continue; // ignore transparent and anti-aliased edge pixels
      const hex = [row[i], row[i + 1], row[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    row.copy(prev);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  // Colours that make up at least 1% of the opaque mark area are its fills.
  return new Set([...counts].filter(([, n]) => n / total >= 0.01).map(([hex]) => hex));
}

function markColours(file: string): Set<string> {
  const buffer = fs.readFileSync(file);
  if (file.endsWith(".svg")) return svgColours(buffer.toString("utf8"));
  if (file.endsWith(".png")) return pngColours(buffer);
  throw new Error(`unsupported mark asset type: ${file}`);
}

describe("CCO client routes carry no ACS brand assets", () => {
  const files = collectClientRouteFiles();

  test("the scan covers app/client/** and the components it imports", () => {
    const rel = files.map((file) => path.relative(repoDir, file));
    expect(rel).toContain("apps/home/app/client/layout.tsx");
    expect(rel).toContain("apps/home/app/client/quote/[id]/quote-summary.tsx");
    expect(rel).toContain("packages/ui/src/atlantis/Card.tsx");
  });

  test("no ACS asset path (logo-texas, astro, astrocleanings, acs-/acs/) is referenced", () => {
    expect(acsAssetHits(files)).toEqual([]);
  });

  test("the header marks are the Content Co-op aperture on the right ground, with honest alt text", () => {
    const expectations: Array<[string, string]> = [
      ["app/client/layout.tsx", APERTURE_MARK],
      ["app/client/quote/[id]/quote-summary.tsx", APERTURE_MARK_CREAM],
    ];
    for (const [rel, mark] of expectations) {
      const source = fs.readFileSync(path.join(homeDir, rel), "utf8");
      expect(source).toContain(`src="${mark}"`);
      expect(source).toContain('alt="Content Co-op"');
      expect(source).not.toMatch(/lockup/i);
      expect(fs.existsSync(path.join(homeDir, "public", mark))).toBe(true);
    }
  });

  test("no mark asset on the client routes is filled Sapphire #1e4d8c", () => {
    const markRefs = [...new Set(files.flatMap((file) => assetReferences(fs.readFileSync(file, "utf8"))))].filter((ref) =>
      /aperture|spiral|mark|logo/i.test(ref),
    );
    expect(markRefs).toEqual(expect.arrayContaining([APERTURE_MARK, APERTURE_MARK_CREAM]));
    for (const ref of markRefs) {
      const colours = markColours(path.join(homeDir, "public", ref));
      expect(colours.size, ref).toBeGreaterThan(0);
      expect([...colours].filter((hex) => nearHex(hex, SAPPHIRE)), ref).toEqual([]);
      for (const hex of colours) expect([LOGO_BLUE, CREAM], `${ref} uses #${hex}`).toContain(hex);
    }
  });

  test("the mark elements are not recoloured in markup (no Sapphire, filters or tints)", () => {
    for (const rel of ["app/client/layout.tsx", "app/client/quote/[id]/quote-summary.tsx"]) {
      const source = fs.readFileSync(path.join(homeDir, rel), "utf8");
      const imageTags = [...source.matchAll(/<Image\b[\s\S]*?\/>/g)].map((match) => match[0]);
      const markTags = imageTags.filter((tag) => tag.includes(APERTURE_MARK) || tag.includes(APERTURE_MARK_CREAM));
      expect(markTags, rel).toHaveLength(1);
      expect(markTags[0]).not.toMatch(new RegExp(`${SAPPHIRE}|filter|invert|hue-rotate|sepia|saturate|brightness|mix-blend`, "i"));
    }
  });

  test("the token matcher is bounded", () => {
    for (const hit of ["logo-texas.png", "LOGO_TEXAS.PNG", "astro-mark.svg", "AstroCleanings-badge.webp", "acs", "acs-logo.png", "Astro"]) {
      expect(ACS_ASSET_TOKEN_RE.test(hit), hit).toBe(true);
    }
    for (const miss of ["astronomy.png", "races.png", "spiral-hq-400.png", "facs-logo.png", "acsii.png", "texas-map.png"]) {
      expect(ACS_ASSET_TOKEN_RE.test(miss), miss).toBe(false);
    }
  });
});
