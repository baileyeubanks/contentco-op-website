import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Two-argument `new URL(<path>, req.url)` is the live `/os/logout` defect
 * (`https://0.0.0.0:4100/...`). Query parsing via `new URL(req.url)` is fine.
 */
const twoArgRequestUrl = /new URL\(\s*[^)]*?,\s*(?:req|request)\.url\s*\)/;
const redirectFromRequestUrl = /NextResponse\.redirect\(\s*new URL\([^)]*(?:req|request)\.url/;

describe("static guard: no request-derived redirect origins", () => {
  const appRoot = path.resolve(__dirname, "../..");

  function walk(dir: string, out: string[] = []) {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  const sources = [
    ...walk(path.join(appRoot, "app")),
    ...walk(path.join(appRoot, "lib")),
    path.join(appRoot, "proxy.ts"),
  ];

  test("no handler builds a redirect origin from request.url", () => {
    const hits: string[] = [];
    for (const file of sources) {
      const relative = path.relative(appRoot, file);
      if (relative === "lib/request-origin.ts") continue;
      const text = readFileSync(file, "utf8");
      if (twoArgRequestUrl.test(text) || redirectFromRequestUrl.test(text)) {
        hits.push(relative);
      }
    }
    expect(hits).toEqual([]);
  });

  test("logout uses publicRedirectUrl (the invite-code login was removed 2026-10-23)", () => {
    const logout = readFileSync(path.join(appRoot, "app/os/logout/route.ts"), "utf8");
    expect(logout).toMatch(/publicRedirectUrl\(/);
    expect(logout).not.toMatch(/new URL\(\s*"\/os".*req\.url/);
  });
});
