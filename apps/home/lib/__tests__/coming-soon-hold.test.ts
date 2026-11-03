import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import sitemap from "@/app/sitemap";
import manifest from "@/lib/content/portfolio-manifest.json";
import heldElPaso from "@/lib/content/held/el-paso-water.json";
import { portfolioPublicStudies } from "@/lib/content/portfolio";
import { COMING_SOON_STUDY_IDS } from "@/lib/content/coming-soon";
import { COMING_SOON_MEDIA_PATHS } from "@/lib/content/coming-soon-media";

const held = [...COMING_SOON_STUDY_IDS];

describe("coming-soon hold (El Paso Water)", () => {
  it("blocks the held film's media paths, and only those", () => {
    const media = [heldElPaso.entry.video, heldElPaso.entry.preview].filter(Boolean);
    expect(media.length).toBe(2);
    expect(new Set(media)).toEqual(new Set(COMING_SOON_MEDIA_PATHS));
  });

  it("ships only a shell in the bundled manifest: no film, no story copy", () => {
    for (const id of held) {
      const entry = manifest.entries.find((candidate) => candidate.id === id) as Record<string, unknown> | undefined;
      expect(entry, id).toBeDefined();
      expect(entry?.video).toBeUndefined();
      expect(entry?.preview).toBeUndefined();
      for (const field of ["scope", "headline", "summary", "mandate", "execution", "outcome"]) expect(entry?.[field], field).toBe("");
    }
    expect(JSON.stringify(manifest)).not.toContain(heldElPaso.entry.summary);
  });

  it("keeps the card listed but strips film, preview and story copy", () => {
    for (const id of held) {
      const study = portfolioPublicStudies.find((entry) => entry.id === id);
      expect(study, id).toBeDefined();
      expect(study?.thumbnail).toBeTruthy();
      expect(study?.video).toBeUndefined();
      expect(study?.preview).toBeUndefined();
      expect(study?.remoteMediaUrl).toBeNull();
      expect(study?.summary).toBe("");
      expect(study?.headline).toBe("");
      expect(study?.gallery).toEqual([]);
    }
  });

  it("404s the held film files through the real proxy, case-insensitively", async () => {
    for (const path of COMING_SOON_MEDIA_PATHS) {
      for (const variant of [path, path.toUpperCase(), `${path}/`]) {
        const res = await proxy(new NextRequest(`http://127.0.0.1:4100${variant}`, { headers: { host: "contentco-op.com" } }));
        expect(res.status, variant).toBe(404);
        expect(res.headers.get("cache-control")).toBe("no-store");
      }
    }
    const other = await proxy(new NextRequest("http://127.0.0.1:4100/cc/portfolio-cdn/thumb_jumbotron.jpg", { headers: { host: "contentco-op.com" } }));
    expect(other.status).toBe(200);
  });

  it("leaves held studies out of the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const id of held) expect(urls.some((url) => url.endsWith(`/portfolio/${id}`))).toBe(false);
    expect(urls.some((url) => url.endsWith("/portfolio/citgo-lcr"))).toBe(true);
  });
});
