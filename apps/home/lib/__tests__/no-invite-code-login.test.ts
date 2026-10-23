import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Bug hunt 2026-10-23 (CCO-SITE-BUGS.md #2): /api/auth/login minted a full operator session for any
// caller-supplied email once the shared invite code matched; the password was never checked.
// No page posts to it, so the route must not exist and nothing may mint invite sessions from a form.
const appDir = resolve(__dirname, "../../app");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return /^route\.(ts|tsx|js)$/.test(name) ? [path] : [];
  });
}

describe("operator sign-in has no invite-code bypass", () => {
  it("does not ship /api/auth/login", () => {
    expect(existsSync(join(appDir, "api/auth/login/route.ts"))).toBe(false);
  });

  it("every route that mints an operator session verifies a password first", () => {
    const unverified = routeFiles(appDir).filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source.includes("createInviteSession(") &&
        !source.includes("verifyRootOperatorCredentials(") &&
        !source.includes("signInWithPassword(")
      );
    });
    expect(unverified).toEqual([]);
  });
});
