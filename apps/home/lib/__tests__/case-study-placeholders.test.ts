import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
}));
import CaseStudyPage from "@/app/portfolio/[id]/page";
import { portfolioPublicStudies } from "@/lib/content/portfolio";
import { isComingSoonStudy } from "@/lib/content/coming-soon";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const PLACEHOLDERS = ["Project cut", "Live event environment", "Houston-led production", "Industrial field site", "Gulf Coast operations"];

describe("case study pages never print placeholder copy", () => {
  const studies = portfolioPublicStudies.filter((study) => !isComingSoonStudy(study.id));
  it("renders every public case study without placeholders or a LEAD tag in related items", async () => {
    for (const study of studies) {
      const html = renderToStaticMarkup(await CaseStudyPage({ params: Promise.resolve({ id: study.id }) }));
      for (const text of PLACEHOLDERS) expect(html, `${study.id}: ${text}`).not.toContain(text);
      if (study.id !== "carwash-lead-drummond") expect(html, `${study.id}: related`).not.toContain("LEAD — Charles Drummond");
      // Runtime row only appears with a real m:ss duration.
      const runtime = html.match(/<dt>Runtime<\/dt><dd>([^<]*)<\/dd>/);
      if (runtime) expect(runtime[1], study.id).toMatch(/\d:\d{2}/);
    }
  });
});
