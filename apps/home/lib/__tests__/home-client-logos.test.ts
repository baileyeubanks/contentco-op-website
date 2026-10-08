import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  CCO_MARKETING_APPROVED_CLIENTS,
  HOME_CLIENT_LOGOS,
  HOME_LOGO_STRIP_PENDING_REVIEW,
} from "../../app/home-client-logos";

// Bailey's rule: the home page logo strip shows only clients approved for
// Content Co-op marketing. Approved: Schneider Electric, ICA, bp, CITGO.
// ABB and Copart are LinkedIn-only. Shell, Maersk and Conexon are not approved.
const NOT_APPROVED_FOR_WEBSITE = ["Shell", "Maersk", "Conexon", "ABB", "Copart"];

const appDir = path.resolve(__dirname, "../../app");
const page = fs.readFileSync(path.join(appDir, "page.tsx"), "utf8");

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

describe("home logo strip shows approved clients only", () => {
  test("the approved list is exactly Bailey's four CCO marketing clients", () => {
    expect([...CCO_MARKETING_APPROVED_CLIENTS].sort()).toEqual(["BP", "CITGO", "ICA", "Schneider Electric"]);
  });

  test("every strip entry is approved or on the frozen pending-review list", () => {
    const allowed = new Set([...CCO_MARKETING_APPROVED_CLIENTS, ...HOME_LOGO_STRIP_PENDING_REVIEW].map(normalize));
    const offenders = HOME_CLIENT_LOGOS.filter((logo) => !allowed.has(normalize(logo.alt))).map((logo) => logo.alt);
    expect(offenders).toEqual([]);
  });

  test("pending-review list never grows and never overlaps the approved list", () => {
    expect(HOME_LOGO_STRIP_PENDING_REVIEW.length).toBeLessThanOrEqual(7);
    const approved = new Set(CCO_MARKETING_APPROVED_CLIENTS.map(normalize));
    for (const name of HOME_LOGO_STRIP_PENDING_REVIEW) expect(approved.has(normalize(name))).toBe(false);
  });

  test("Shell, Maersk, Conexon, ABB and Copart never appear by name or asset", () => {
    for (const logo of HOME_CLIENT_LOGOS) {
      const haystack = normalize(`${logo.alt} ${logo.src}`);
      for (const banned of NOT_APPROVED_FOR_WEBSITE) {
        expect(haystack.includes(normalize(banned)), `${logo.alt} (${logo.src}) matches ${banned}`).toBe(false);
      }
    }
  });

  test("the home page renders the strip only from this list", () => {
    expect(page).toContain('import { HOME_CLIENT_LOGOS } from "./home-client-logos";');
    expect(page).toContain("{HOME_CLIENT_LOGOS.map(");
    expect(page).not.toMatch(/\/cc\/logos\//);
    for (const banned of NOT_APPROVED_FOR_WEBSITE) {
      expect(page).not.toMatch(new RegExp(`alt:\\s*["']${banned}["']`, "i"));
    }
  });

  test("strip has no empty slots: unique, sized entries wide enough to fill a 1440px ticker", () => {
    const alts = HOME_CLIENT_LOGOS.map((logo) => normalize(logo.alt));
    expect(new Set(alts).size).toBe(alts.length);
    for (const logo of HOME_CLIENT_LOGOS) {
      expect(logo.src).toMatch(/^\/cc\/logos\/[a-z0-9-]+\.(svg|png)$/);
      expect(fs.existsSync(path.resolve(__dirname, "../../public", `.${logo.src}`))).toBe(true);
      for (const n of [logo.width, logo.height, logo.mobileWidth, logo.mobileHeight]) expect(n).toBeGreaterThan(0);
    }
    // One ticker track (logos + 72px gaps + 2x40px padding) must cover the
    // 1440px viewport so the two-copy marquee never shows a blank stretch.
    const track = HOME_CLIENT_LOGOS.reduce((sum, logo) => sum + logo.width, 0) + 72 * (HOME_CLIENT_LOGOS.length - 1) + 80;
    expect(track).toBeGreaterThanOrEqual(1440);
  });
});
