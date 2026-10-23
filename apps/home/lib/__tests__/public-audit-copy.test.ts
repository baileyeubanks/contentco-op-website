import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));
import { CONTENT_VIDEO_VERSION, heroVideo, heroVideoMobile, weatherVanePoster } from "@/app/hero-video-config";
import HomePage from "@/app/page";
import SuitePage from "@/app/suite/page";
import { BriefClientPage } from "@/app/brief/brief-client";

type Check = { label: string; required: string[]; normalizedRequired?: string[]; forbidden: string[] };
const source = readFileSync(path.resolve(__dirname, "../../scripts/audit-public-runtime.mjs"), "utf8");
// Evaluate only the audit's literal data table, never its network/SSH runner.
const checks = runInNewContext(source.slice(source.indexOf("const htmlChecks = ["), source.indexOf("const sourceFileChecks = [")) + ";htmlChecks") as Check[];
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const pages = [
  { label: "homepage copy", render: async () => renderToStaticMarkup(await HomePage({})) },
  { label: "brief copy", render: async () => renderToStaticMarkup(React.createElement(BriefClientPage)) },
  { label: "suite copy", render: async () => renderToStaticMarkup(React.createElement(SuitePage)) },
];

describe("public audit expectations match rendered current pages", () => {
  for (const { label, render } of pages) {
    it(label, async () => {
      const check = checks.find(check => check.label === label)!;
      const html = await render();
      for (const marker of check.required) expect(html, `${label}: ${marker}`).toContain(marker);
      for (const marker of check.forbidden) expect(html, `${label}: forbidden ${marker}`).not.toContain(marker);
    });
  }
  it("probes the current desktop/mobile hero renditions and poster", () => {
    const table = source.slice(source.indexOf("const heroMediaPaths = ["), source.indexOf("const curlAttempts"));
    const paths = runInNewContext(table + ";heroMediaPaths", { contentVideoVersion: CONTENT_VIDEO_VERSION });
    expect(paths).toEqual([heroVideo, heroVideoMobile, weatherVanePoster]);
  });
  it("keeps concrete checks for each corrected behavior, rather than dropping them", () => {
    const expected: Record<string, string[]> = {
      "homepage copy": ["weather-vane-wide-poster.jpg"],
      "brief copy": ["Name, email, and company are all we need to follow up.", "leave the default"],
      "suite copy": ["Open Co-VideoPro"],
    };
    for (const [label, markers] of Object.entries(expected)) {
      const check = checks.find(check => check.label === label)!;
      for (const marker of markers) expect(check.required).toContain(marker);
    }
  });
});
