import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * G3 copy rules (2026-10-08): the public contact is service@contentco-op.com
 * and Bailey's public title is "Founder" (including structured data).
 */
const appRoot = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(appRoot, rel), "utf8");

const VISITOR_FACING_FILES = [
  "app/api/chat/domain-config.ts",
  "app/api/chat/route.ts",
  "app/page.tsx",
  "app/home-copy.ts",
  "lib/seo.ts",
  "lib/gemini.ts",
  "lib/os-document-renderer.ts",
  "lib/cco-public-intake.ts",
  "app/brief/brief-client.tsx",
  "public/brandcentral/index.html",
  "public/brandcentral/cc.html",
  "brandcentral/index.html",
];

describe("G3: public copy", () => {
  test("visitor-facing copy does not show a bailey@ address", () => {
    for (const rel of VISITOR_FACING_FILES) {
      const src = read(rel);
      const shown = rel === "lib/cco-public-intake.ts"
        // The operator alert roster is internal; only the visitor receipt is public.
        ? src.replace(/DEFAULT_CCO_ADMIN_ALERT_EMAILS = \[[^\]]*\]/, "")
        : src;
      expect(shown, rel).not.toMatch(/bailey@contentco-op\.com/);
    }
  });

  test("Bailey's title is Founder in structured data and on the home page", async () => {
    expect(read("lib/seo.ts")).toMatch(/jobTitle: "Founder",/);
    const { FOUNDER } = await import("../../app/home-copy");
    expect(FOUNDER.title).toBe("Founder");
    expect(read("app/page.tsx")).not.toMatch(/Executive Producer/);
    expect(read("lib/gemini.ts")).not.toMatch(/Director\/Producer/);
    expect(read("lib/quote-payload-builder.ts")).toMatch(/seller_title: "Founder, Content Co-op"/);
  });
});
