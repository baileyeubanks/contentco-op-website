import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * G2 (2026-10-08): GET /api/client/portal stays deleted, matching live since
 * Sep 9 (190cb8b, CCO-ROUTE-GATE-001). It was a token-gated service-role read
 * of contacts, quotes, jobs, invoices and payments.
 */
const appRoot = path.resolve(__dirname, "../..");
const ROUTE_DIR = path.join(appRoot, "app", "api", "client", "portal");
const SCAN_ROOTS = ["app", "lib", "proxy.ts", "next.config.ts", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const REFERENCE = /api\/client\/portal(?![A-Za-z0-9_-])/;

function collectSources(target: string, out: string[] = []): string[] {
  if (!existsSync(target)) return out;
  if (statSync(target).isFile()) {
    if (SOURCE_EXT.test(target)) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    collectSources(path.join(target, entry.name), out);
  }
  return out;
}

describe("G2: /api/client/portal is removed", () => {
  test("the route handler and its directory are gone", () => {
    expect(existsSync(path.join(ROUTE_DIR, "route.ts"))).toBe(false);
    expect(existsSync(path.join(ROUTE_DIR, "route.js"))).toBe(false);
    expect(existsSync(ROUTE_DIR)).toBe(false);
  });

  test("no application source imports, fetches or links to it", () => {
    const sources = SCAN_ROOTS.flatMap((root) => collectSources(path.join(appRoot, root)));
    expect(sources.length).toBeGreaterThan(50);
    const offenders = sources
      .filter((file) => REFERENCE.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(appRoot, file));
    expect(offenders).toEqual([]);
  });
});
